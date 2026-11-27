import { useEffect, useRef, useState } from "react";

export function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, "Code block omitted.") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1") // Remove inline code ticks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Markdown links to link text
    .replace(/[*_~#]/g, "") // Bold/italic/header symbols
    .replace(/https?:\/\/\S+/g, "") // Raw URLs
    .replace(/•|\*|–|—/g, " ") // Bullet points & dashes
    .replace(/\s+/g, " ")
    .trim();
}

export type VoiceState = "idle" | "listening" | "recording" | "transcribing" | "generating" | "speaking" | "error";
export type MicStatus = "uninitialized" | "requesting" | "ready" | "listening" | "recording" | "denied" | "unavailable" | "error";
export type PlaybackStatus = "idle" | "speaking" | "completed" | "failed" | "unsupported";
export type VoiceErrorCategory =
  | "microphone_permission"
  | "microphone_unavailable"
  | "microphone_error"
  | "transcription_error"
  | "generation_error"
  | "speech_playback_error"
  | null;

type SendVoiceMessage = (query: string, signal: AbortSignal) => Promise<string>;

interface LocalRecognition {
  processLocally: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(track: MediaStreamTrack): void;
  abort(): void;
}
interface RecognitionConstructor {
  new(): LocalRecognition;
  available?(options: { langs: string[]; processLocally: boolean }): Promise<string>;
}

export interface VoiceDiagnostics {
  micActive: boolean;
  recording: boolean;
  audioContextState: string;
  currentRms: number;
  noiseFloor: number;
  speechThreshold: number;
  speechDetected: boolean;
  lastTransitionReason: string;
  turnCount: number;
  lastError: string;
  lastReply: string;
}

export interface VoiceView {
  voiceState: VoiceState;
  isMuted: boolean;
  finalTranscript: string;
  errorMessage: string;
  audioLevel: number;
  micStatus: MicStatus;
  playbackStatus: PlaybackStatus;
  errorCategory: VoiceErrorCategory;
  lastAssistantReply: string;
}

const initialView: VoiceView = {
  voiceState: "idle",
  isMuted: false,
  finalTranscript: "",
  errorMessage: "",
  audioLevel: 0,
  micStatus: "uninitialized",
  playbackStatus: "idle",
  errorCategory: null,
  lastAssistantReply: "",
};

const recorderTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/aac",
];

function logDiagnostic(tag: string, message: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production" || typeof window !== "undefined" && (window as unknown as { __FRIDAY_DEBUG__?: boolean }).__FRIDAY_DEBUG__) {
    console.info(`[Friday Voice:${tag}] ${message}`, data ? data : "");
  }
}

// Each recording session owns its media resources, VAD analyser, recorder, timers and lifecycle.
class VoiceSession {
  private turn = new AbortController();
  private closed = false;
  private muted = false;
  private stream?: MediaStream;
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private recorder?: MediaRecorder;
  private recognition?: LocalRecognition;
  private localEngine?: RecognitionConstructor;
  private utterance?: SpeechSynthesisUtterance;
  private timer?: number;
  private meter?: number;
  private mime = "";
  private initializing = false;
  private turnCount = 0;
  private lastLevelEmit = 0;
  private currentCorrelationId = "";

  public diagnostics: VoiceDiagnostics = {
    micActive: false,
    recording: false,
    audioContextState: "uninitialized",
    currentRms: 0,
    noiseFloor: 0.0003,
    speechThreshold: 0.0016,
    speechDetected: false,
    lastTransitionReason: "created",
    turnCount: 0,
    lastError: "",
    lastReply: "",
  };

  constructor(
    private update: (patch: Partial<VoiceView>) => void,
    private send: SendVoiceMessage
  ) {}

  private cancelTurn() {
    this.turn.abort();
    clearTimeout(this.timer);
    clearInterval(this.meter);
    this.timer = undefined;
    this.meter = undefined;
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {}
    }
    this.recorder = undefined;
    this.recognition?.abort();
    this.recognition = undefined;
    if (this.utterance && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      delete (window as unknown as { __fridayUtterance?: SpeechSynthesisUtterance }).__fridayUtterance;
    }
    this.utterance = undefined;
    this.diagnostics.recording = false;
    this.diagnostics.speechDetected = false;
  }

  private transition(state: VoiceState, reason: string, patch: Partial<VoiceView> = {}) {
    if (this.closed) return;
    this.diagnostics.lastTransitionReason = reason;
    logDiagnostic("STATE", `${state} (reason: ${reason})`);
    this.update({ voiceState: state, ...patch });
  }

  private fail(message: string, reason = "error", category: VoiceErrorCategory = null) {
    this.cancelTurn();
    this.diagnostics.lastError = message;
    if (!this.closed) {
      this.transition("error", reason, {
        errorMessage: message,
        errorCategory: category,
        audioLevel: 0,
      });
    }
  }

  async open() {
    if (this.closed || this.initializing) return;
    this.initializing = true;
    this.update({ micStatus: "requesting", errorCategory: null, errorMessage: "" });

    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.getVoices();
        } catch {}
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        this.update({ micStatus: "unavailable" });
        throw new Error("Microphone access requires a supported browser and HTTPS.");
      }

      if (!this.stream || !this.stream.active || !this.stream.getAudioTracks().some(t => t.readyState === "live")) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
        });
        if (this.closed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        this.stream = stream;
        this.diagnostics.micActive = true;
        this.update({ micStatus: "ready" });

        for (const track of stream.getAudioTracks()) {
          track.enabled = !this.muted;
          track.onended = () => {
            this.stream = undefined;
            this.analyser = undefined;
            this.diagnostics.micActive = false;
            void this.context?.close().catch(() => {});
            this.context = undefined;
            this.update({ micStatus: "unavailable" });
            this.fail(
              "Microphone disconnected. Please reconnect your audio input and tap retry.",
              "mic_disconnected",
              "microphone_unavailable"
            );
          };
        }
      } else {
        this.update({ micStatus: "ready" });
      }

      this.mime = typeof MediaRecorder === "undefined"
        ? ""
        : recorderTypes.find(type => MediaRecorder.isTypeSupported(type)) || "";

      if (!this.mime) {
        if (!await this.enableLocalRecognition()) {
          this.update({ micStatus: "error" });
          throw new Error("This browser has no supported audio recorder or installed English speech recognizer.");
        }
      } else if (!this.analyser) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.context ??= new AudioCtx();
        if (this.context.state === "suspended") {
          await this.context.resume();
        }
        this.diagnostics.audioContextState = this.context.state;
        if (this.closed) return;

        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.2;
        this.context.createMediaStreamSource(this.stream).connect(this.analyser);
      }

      if (!this.muted && !this.closed) {
        this.listen();
      }
    } catch (error) {
      if (!this.closed) {
        const isPermission = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
        const isUnavailable = error instanceof DOMException && (error.name === "NotFoundError" || error.name === "DevicesNotFoundError");
        const category: VoiceErrorCategory = isPermission
          ? "microphone_permission"
          : isUnavailable
          ? "microphone_unavailable"
          : "microphone_error";

        this.update({ micStatus: isPermission ? "denied" : isUnavailable ? "unavailable" : "error" });
        this.fail(
          isPermission
            ? "Microphone access was denied. Please allow microphone permission in your browser settings and tap retry."
            : isUnavailable
            ? "No microphone was detected on this device. Please connect an audio input and tap retry."
            : error instanceof Error
            ? error.message
            : "Microphone setup failed. Check your audio settings and tap retry.",
          "init_failed",
          category
        );
      }
    } finally {
      this.initializing = false;
    }
  }

  // Fallback for browsers supporting localized on-device speech packs
  private async enableLocalRecognition() {
    const browser = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const engine = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!engine?.available || (await engine.available({ langs: ["en-US"], processLocally: true })) !== "available") {
      return false;
    }
    this.localEngine = engine;
    return true;
  }

  private listen() {
    if (this.closed || this.muted || !this.stream) return;
    this.cancelTurn();
    this.turn = new AbortController();
    const signal = this.turn.signal;
    this.turnCount++;
    this.diagnostics.turnCount = this.turnCount;
    const turnCorrelationId = `turn_${this.turnCount}_${Date.now().toString(36)}`;
    this.currentCorrelationId = turnCorrelationId;

    logDiagnostic("Stage A: STT", `[${turnCorrelationId}] Listening turn started, mic active`);

    this.transition("listening", `turn_${this.turnCount}_init`, {
      errorMessage: "",
      finalTranscript: "",
      audioLevel: 0,
    });

    try {
      if (this.localEngine) {
        const recognition = new this.localEngine();
        this.recognition = recognition;
        recognition.lang = "en-US";
        recognition.processLocally = true;
        let finalized = false;

        recognition.onstart = () => {
          if (!signal.aborted) this.transition("listening", "local_engine_start");
        };
        recognition.onresult = event => {
          if (signal.aborted || finalized) return;
          const text = event.results[0]?.[0]?.transcript.trim();
          if (!text) return;
          finalized = true;
          recognition.abort();
          void this.generate(text, signal);
        };
        recognition.onend = () => {
          if (!signal.aborted && !finalized) this.fail("No speech recognized. Retry when ready.", "no_speech_engine", "transcription_error");
        };
        recognition.onerror = () => {
          if (!signal.aborted && !finalized) this.fail("Local recognition failed. Retry when ready.", "local_engine_error", "transcription_error");
        };
        recognition.start(this.stream.getAudioTracks()[0]);
        return;
      }

      // MediaRecorder + Adaptive Calibrated VAD Engine
      const recorder = new MediaRecorder(this.stream, {
        mimeType: this.mime,
        audioBitsPerSecond: 64000,
      });
      const chunks: Blob[] = [];
      const analyser = this.analyser!;
      const samples = new Float32Array(analyser.fftSize);

      let speech = false;
      let speechFrames = 0;
      let speechStartTime = 0;
      let lastSpeechTime = 0;
      // Start with realistic initial noise floor calibrated for Realtek and digital array mics
      let noiseFloor = Math.max(0.0001, Math.min(0.005, this.diagnostics.noiseFloor || 0.0003));
      this.recorder = recorder;

      recorder.ondataavailable = event => {
        if (!signal.aborted && event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        if (!signal.aborted) {
          this.fail("Microphone recording failed. Retry when ready.", "recorder_error");
        }
      };

      recorder.onstop = () => {
        if (signal.aborted) return;
        clearInterval(this.meter);
        this.meter = undefined;
        this.recorder = undefined;
        this.diagnostics.recording = false;

        if (!speech) {
          // If silence timeout elapsed without speech, gracefully refresh the listening turn
          logDiagnostic("VAD", "Silence window completed without speech; rotating recorder cleanly");
          if (!this.closed && !this.muted) {
            this.listen();
          }
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (!blob.type.startsWith("audio/") || blob.size < 64 || blob.size > 3 * 1024 * 1024) {
          logDiagnostic("VAD", "Recording size out of bounds", { size: blob.size, mime: blob.type });
          this.fail("Recording is empty or too large. Try a shorter question.", "invalid_blob_size");
          return;
        }

        void this.transcribe(blob, signal);
      };

      // Watchdog: detect if recorder fails to start
      this.timer = window.setTimeout(() => {
        if (!signal.aborted && recorder.state !== "recording") {
          this.fail("The microphone did not start recording. Check your input device and retry.", "start_timeout");
        }
      }, 8000);

      recorder.onstart = () => {
        if (signal.aborted) return;
        clearTimeout(this.timer);
        this.diagnostics.recording = true;
        this.transition("listening", "recorder_ready");
        const start = performance.now();

        this.meter = window.setInterval(() => {
          if (signal.aborted || recorder.state !== "recording") return;

          analyser.getFloatTimeDomainData(samples);
          let sumSquares = 0;
          for (let i = 0; i < samples.length; i++) {
            sumSquares += samples[i] * samples[i];
          }
          const rms = Math.sqrt(sumSquares / samples.length);
          const now = performance.now();
          const elapsed = now - start;

          // Throttled UI audio level measurement (max ~15fps / 65ms)
          if (now - this.lastLevelEmit >= 65) {
            this.lastLevelEmit = now;
            const normalizedLevel = Math.min(100, Math.round((rms / 0.015) * 100));
            this.update({ audioLevel: normalizedLevel });
          }

          // Initial 180ms warmup window: calibrate ambient noise without false triggering on mic click
          if (elapsed < 180) {
            if (rms > 0.00005) {
              noiseFloor = Math.max(0.0001, Math.min(0.005, rms));
            }
            return;
          }

          // Adaptive Speech Threshold:
          // Low floor allows quiet speech (0.002) to trigger while room silence (0.0002) is well below
          const speechThreshold = Math.max(0.0016, noiseFloor * 2.3 + 0.0007);
          this.diagnostics.currentRms = rms;
          this.diagnostics.noiseFloor = noiseFloor;
          this.diagnostics.speechThreshold = speechThreshold;

          if (rms >= speechThreshold) {
            speechFrames = Math.min(10, speechFrames + 1);
            lastSpeechTime = now;

            // Speech onset confirmation (sustained energy over at least 2-3 frames ~60-75ms)
            if (!speech && speechFrames >= 3) {
              speech = true;
              speechStartTime = now;
              this.diagnostics.speechDetected = true;
              this.transition("recording", "speech_onset_detected");
            }
          } else {
            speechFrames = Math.max(0, speechFrames - 1);
            if (!speech) {
              // Update noise floor slowly during non-speech periods only
              if (rms < noiseFloor) {
                noiseFloor = noiseFloor * 0.90 + rms * 0.10;
              } else {
                noiseFloor = noiseFloor * 0.995 + rms * 0.005;
              }
              noiseFloor = Math.max(0.0001, Math.min(0.015, noiseFloor));
            }
          }

          // Speech Completion Logic:
          // If speech was detected and followed by 850ms of silence, or if user spoke for max 45s: stop and transcribe.
          // If no speech detected for 25s: rotate the recorder buffer cleanly.
          const speechSilenceElapsed = speech ? now - lastSpeechTime : 0;
          const speechDuration = speech ? now - speechStartTime : 0;

          if (
            (speech && speechSilenceElapsed >= 850) ||
            (speech && speechDuration >= 45000) ||
            (!speech && elapsed >= 25000)
          ) {
            clearInterval(this.meter);
            this.meter = undefined;
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }
        }, 25);
      };

      recorder.start(200);
    } catch {
      this.fail("Could not start recording. Check your microphone and retry.", "recorder_start_exception");
    }
  }

  private async transcribe(blob: Blob, signal: AbortSignal) {
    const turnId = this.currentCorrelationId;
    this.transition("transcribing", "audio_captured_uploading");
    logDiagnostic("Stage A: STT", `[${turnId}] Audio captured (${blob.size} bytes, ${blob.type}), uploading to /api/transcribe`);

    this.timer = window.setTimeout(() => {
      logDiagnostic("Stage A: STT", `[${turnId}] Transcription timed out after 16s watchdog`);
      this.fail("Transcription timed out. Please retry.", "transcribe_timeout", "transcription_error");
    }, 16000);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "audio/webm",
          "X-Friday-Correlation-Id": turnId,
        },
        body: blob,
        signal,
      });
      const data = await res.json();
      if (signal.aborted) return;

      if (!res.ok) {
        if (data.code === "no_speech") {
          logDiagnostic("Stage A: STT", `[${turnId}] No speech detected in audio clip; returning cleanly to listening`);
          this.listen();
          return;
        }
        if (data.code === "stt_unavailable" && (await this.enableLocalRecognition())) {
          logDiagnostic("Stage A: STT", `[${turnId}] STT unavailable; failing over to local speech engine`);
          if (!signal.aborted) this.listen();
          return;
        }
        logDiagnostic("Stage A: STT", `[${turnId}] Transcription rejected with HTTP ${res.status}: ${data.error || "error"}`);
        throw new Error(data.error || "Voice transcription failed. Please retry.");
      }

      const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
      if (!transcript) {
        throw new Error("No transcript was returned. Please retry.");
      }

      logDiagnostic("Stage A: STT", `[${turnId}] Transcription succeeded via ${data.model || "Gemini"}: "${transcript.slice(0, 50)}"`);
      clearTimeout(this.timer);
      this.timer = undefined;
      await this.generate(transcript, signal);
    } catch (error) {
      if (!signal.aborted) {
        logDiagnostic("Stage A: STT", `[${turnId}] Transcription failed: ${error instanceof Error ? error.message : "unknown"}`);
        this.fail(
          error instanceof Error ? error.message : "Transcription failed.",
          "transcribe_error",
          "transcription_error"
        );
      }
    }
  }

  private async generate(text: string, signal: AbortSignal) {
    const turnId = this.currentCorrelationId;
    this.transition("generating", "transcription_complete_requesting_reply", {
      finalTranscript: text,
      audioLevel: 0,
    });
    logDiagnostic("Stage B: SUBMIT", `[${turnId}] Submitting query to assistant: "${text.slice(0, 60)}"`);
    logDiagnostic("Stage C: AI", `[${turnId}] Requesting reply from Friday AI model...`);

    this.timer = window.setTimeout(() => {
      logDiagnostic("Stage C: AI", `[${turnId}] Generation watchdog timed out after 20s`);
      this.fail("Friday's reply timed out. Please retry.", "reply_timeout", "generation_error");
    }, 20000);

    try {
      const reply = await this.send(text, signal);
      if (signal.aborted) return;
      clearTimeout(this.timer);
      this.timer = undefined;

      logDiagnostic("Stage D: RESPONSE DELIVERY", `[${turnId}] Received text response (${reply.length} chars)`);
      this.diagnostics.lastReply = reply;
      this.update({ lastAssistantReply: reply });

      this.speakResponse(reply, signal);
    } catch (error) {
      if (!signal.aborted) {
        logDiagnostic("Stage C: AI", `[${turnId}] AI generation error: ${error instanceof Error ? error.message : "unknown"}`);
        this.fail(
          error instanceof Error ? error.message : "Friday could not complete the reply.",
          "generate_error",
          "generation_error"
        );
      }
    }
  }

  private speakResponse(reply: string, signal: AbortSignal) {
    const turnId = this.currentCorrelationId;
    const text = cleanTextForSpeech(reply);
    if (!text) {
      logDiagnostic("Stage D: RESPONSE DELIVERY", `[${turnId}] Reply text is empty after cleaning`);
      this.fail("Friday returned an empty reply.", "empty_reply", "generation_error");
      return;
    }

    logDiagnostic("Stage E: TTS", `[${turnId}] Initializing speech synthesis for ${text.length} chars`);
    this.diagnostics.lastReply = reply;
    this.update({ lastAssistantReply: reply, playbackStatus: "speaking" });

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      logDiagnostic("Stage E: TTS", `[${turnId}] Speech synthesis unsupported in window`);
      this.update({ playbackStatus: "unsupported" });
      this.transition("error", "tts_unsupported", {
        errorMessage: "Speech playback is unsupported in this browser environment.",
        errorCategory: "speech_playback_error",
        playbackStatus: "unsupported",
        lastAssistantReply: reply,
      });
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;

    // CRITICAL: Pin utterance to window object to prevent Chrome/Edge V8 Garbage Collection bug!
    if (typeof window !== "undefined") {
      (window as unknown as { __fridayUtterance?: SpeechSynthesisUtterance }).__fridayUtterance = utterance;
    }

    utterance.lang = "en-US";
    try {
      const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith("en"));
      utterance.voice =
        voices.find(voice => voice.name.includes("Natural")) ||
        voices.find(voice => voice.name.includes("Google")) ||
        voices.find(voice => voice.localService) ||
        voices[0] ||
        null;
    } catch {}
    utterance.rate = 1.05;

    // Safety watchdog in case browser speech fails to start (e.g. autoplay block or missing audio sink)
    this.timer = window.setTimeout(() => {
      logDiagnostic("Stage E: TTS", `[${turnId}] Speech start watchdog elapsed (8s). Transitioning to audio error notice, preserving text.`);
      clearTimeout(this.timer);
      this.timer = undefined;
      this.update({ playbackStatus: "failed" });
      this.transition("error", "tts_start_timeout", {
        errorMessage: "Speech playback did not start. Check your audio device or tap Replay Audio.",
        errorCategory: "speech_playback_error",
        playbackStatus: "failed",
        lastAssistantReply: reply,
      });
    }, 8000);

    utterance.onstart = () => {
      if (signal.aborted) return;
      clearTimeout(this.timer);
      logDiagnostic("Stage E: TTS", `[${turnId}] Speech playback started successfully`);
      this.update({ playbackStatus: "speaking" });
      this.transition("speaking", "speech_playback_began");

      // Watchdog for playback stall
      this.timer = window.setTimeout(() => {
        logDiagnostic("Stage E: TTS", `[${turnId}] Speech playback stalled`);
        this.update({ playbackStatus: "failed" });
        this.transition("error", "tts_stall_timeout", {
          errorMessage: "Speech playback stalled. Tap Replay Audio to retry.",
          errorCategory: "speech_playback_error",
          playbackStatus: "failed",
          lastAssistantReply: reply,
        });
      }, Math.max(30000, text.length * 200));
    };

    utterance.onend = () => {
      if (signal.aborted || this.utterance !== utterance) return;
      clearTimeout(this.timer);
      this.timer = undefined;
      this.utterance = undefined;
      logDiagnostic("Stage E: TTS", `[${turnId}] Speech playback completed naturally`);
      this.update({ playbackStatus: "completed" });
      if (typeof window !== "undefined") {
        delete (window as unknown as { __fridayUtterance?: SpeechSynthesisUtterance }).__fridayUtterance;
      }

      // Continuous Multi-Turn Lifecycle:
      // Wait 300ms for room acoustic echo to decay, then automatically resume listening!
      this.timer = window.setTimeout(() => {
        if (!signal.aborted && !this.closed && !this.muted) {
          logDiagnostic("LIFECYCLE", `[${turnId}] Turn completed cleanly; auto-resuming listening for next question`);
          this.listen();
        }
      }, 300);
    };

    utterance.onerror = (e) => {
      if (typeof window !== "undefined") {
        delete (window as unknown as { __fridayUtterance?: SpeechSynthesisUtterance }).__fridayUtterance;
      }
      clearTimeout(this.timer);
      this.timer = undefined;
      this.update({ playbackStatus: "failed" });
      if (!signal.aborted && e.error !== "canceled" && e.error !== "interrupted") {
        logDiagnostic("Stage E: TTS", `[${turnId}] Speech playback error: ${e.error}`);
        this.transition("error", "tts_error", {
          errorMessage: "Speech playback failed on this device, but Friday's answer is ready below.",
          errorCategory: "speech_playback_error",
          playbackStatus: "failed",
          lastAssistantReply: reply,
        });
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err: unknown) {
      logDiagnostic("Stage E: TTS", `[${turnId}] window.speechSynthesis.speak exception: ${err instanceof Error ? err.message : "unknown"}`);
      clearTimeout(this.timer);
      this.timer = undefined;
      this.update({ playbackStatus: "failed" });
      this.transition("error", "tts_error", {
        errorMessage: "Speech playback failed on this device, but Friday's answer is ready below.",
        errorCategory: "speech_playback_error",
        playbackStatus: "failed",
        lastAssistantReply: reply,
      });
    }
  }

  retrySpeech() {
    if (this.closed || !this.diagnostics.lastReply) return;
    const turnId = this.currentCorrelationId || `retry_${Date.now().toString(36)}`;
    logDiagnostic("Stage E: TTS", `[${turnId}] Retrying speech playback on user gesture`);
    clearTimeout(this.timer);
    this.timer = undefined;
    this.speakResponse(this.diagnostics.lastReply, this.turn.signal);
  }

  retry() {
    if (this.closed) return;
    if (this.diagnostics.lastReply && (this.diagnostics.lastTransitionReason === "tts_error" || this.diagnostics.lastTransitionReason === "tts_start_timeout")) {
      this.retrySpeech();
    } else if (!this.muted) {
      void this.open();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.stream?.getAudioTracks().forEach(track => {
      track.enabled = !this.muted;
    });
    this.cancelTurn();
    this.transition(this.muted ? "idle" : "listening", this.muted ? "user_muted" : "user_unmuted", {
      isMuted: this.muted,
      errorMessage: "",
      audioLevel: 0,
    });
    if (!this.muted) {
      this.retry();
    }
  }

  interrupt() {
    if (this.utterance) {
      logDiagnostic("LIFECYCLE", "User interrupted Friday; restarting listening immediately");
      this.cancelTurn();
      if (!this.closed && !this.muted) {
        this.listen();
      }
    }
  }

  close() {
    this.closed = true;
    this.cancelTurn();
    this.stream?.getTracks().forEach(track => {
      track.onended = null;
      track.stop();
    });
    this.stream = undefined;
    this.analyser = undefined;
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.diagnostics.micActive = false;
    this.diagnostics.recording = false;
    this.diagnostics.audioContextState = "closed";
  }
}

export function useVoiceAssistant({ onSendMessage }: { onSendMessage: SendVoiceMessage }) {
  const [view, setView] = useState<VoiceView>(initialView);
  const [isActive, setActive] = useState(false);
  const session = useRef<VoiceSession>();
  const send = useRef(onSendMessage);
  send.current = onSendMessage;

  useEffect(() => () => session.current?.close(), []);

  return {
    ...view,
    isActive,
    diagnostics: session.current?.diagnostics,
    startVoiceMode() {
      if (session.current) return;
      setView(initialView);
      setActive(true);
      session.current = new VoiceSession(
        patch => setView(prev => ({ ...prev, ...patch })),
        (text, signal) => send.current(text, signal)
      );
      void session.current.open();
    },
    stopVoiceMode() {
      session.current?.close();
      session.current = undefined;
      setActive(false);
      setView(initialView);
    },
    toggleMute: () => session.current?.toggleMute(),
    interrupt: () => session.current?.interrupt(),
    retryListening: () => session.current?.retry(),
    retrySpeech: () => session.current?.retrySpeech(),
  };
}
