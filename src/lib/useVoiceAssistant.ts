import { useCallback, useEffect, useRef, useState } from "react";

export interface DiagnosticLogEntry {
  timestamp: number;
  timeStr: string;
  category: "STATE" | "AUDIO" | "VAD" | "TTS" | "RECORDER" | "GEMINI";
  message: string;
  data?: Record<string, any>;
}

export function logDiagnostic(
  category: "STATE" | "AUDIO" | "VAD" | "TTS" | "RECORDER" | "GEMINI",
  message: string,
  data?: Record<string, any>
) {
  const now = Date.now();
  const timeStr = new Date(now).toISOString().slice(11, 23);
  const entry: DiagnosticLogEntry = { timestamp: now, timeStr, category, message, data };

  if (typeof window !== "undefined") {
    if (!(window as any).__voiceDiagnosticLogs) {
      (window as any).__voiceDiagnosticLogs = [];
    }
    (window as any).__voiceDiagnosticLogs.push(entry);
    if ((window as any).__voiceDiagnosticLogs.length > 500) {
      (window as any).__voiceDiagnosticLogs.shift();
    }
  }

  const payload = data ? " | " + JSON.stringify(data) : "";
  console.log(`[DIAG_${category} ${timeStr}] ${message}${payload}`);
}

export type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupt_pending"
  | "capturing_interruption"
  | "error";

export interface VoiceDiagnostics {
  browser: string;
  mediaRecorderSupported: boolean;
  speechSynthesisSupported: boolean;
  supportedMimeType: string;
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  echoCancellationEnabled: boolean | string;
  noiseSuppressionEnabled: boolean | string;
  autoGainControlEnabled: boolean | string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

interface UseVoiceAssistantProps {
  onSendMessage: (query: string) => Promise<void>;
  isStreaming: boolean;
}

/**
 * Strips markdown syntax, raw URLs, and code blocks to produce clean, fluent speech.
 */
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

/** Determines best audio MIME type supported by the browser */
function getSupportedMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

/** Converts an audio Blob into a Base64 string */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceAssistant({
  onSendMessage,
  isStreaming,
}: UseVoiceAssistantProps) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [finalTranscript, setFinalTranscript] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0); // Throttled for visualizer
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);

  // Synchronous refs to prevent race conditions & stale closures
  const voiceStateRef = useRef<VoiceState>("idle");
  voiceStateRef.current = voiceState;

  const isActiveRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;

  // MediaRecorder & AudioContext refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadAnimationIdRef = useRef<number | null>(null);

  // Audio level and UI update throttling refs (prevents 60fps React re-renders)
  const lastLevelUpdateRef = useRef<number>(0);
  const isUserSpeakingRef = useRef<boolean>(false);

  // Adaptive background noise floor tracking
  const noiseFloorRef = useRef<number>(14);

  // Turn timing & VAD refs
  const speechCandidateStartTimeRef = useRef<number>(0);
  const speechConfirmedRef = useRef<boolean>(false);
  const lastSoundTimeRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const isProcessingAudioRef = useRef<boolean>(false);
  const echoSettlingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // In-flight query lock
  const isSubmittingRef = useRef<boolean>(false);

  // SpeechSynthesis refs
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Store stable callback for onSendMessage
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  // Diagnostics ref
  const diagnosticsRef = useRef<VoiceDiagnostics>({
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
    mediaRecorderSupported: false,
    speechSynthesisSupported: false,
    supportedMimeType: "",
    micPermission: "unknown",
    echoCancellationEnabled: "unknown",
    noiseSuppressionEnabled: "unknown",
    autoGainControlEnabled: "unknown",
    lastErrorCode: null,
    lastErrorMessage: null,
  });

  // State transition with debug logging
  const transitionState = useCallback((nextState: VoiceState, reason?: string) => {
    const prevState = voiceStateRef.current;
    logDiagnostic("STATE", `State Transition: ${prevState} -> ${nextState}`, {
      prevState,
      nextState,
      reason: reason || "state_change",
    });
    voiceStateRef.current = nextState;
    setVoiceState(nextState);
  }, []);

  // Check browser support and microphone permission on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasMediaRecorder = typeof MediaRecorder !== "undefined";
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasSynthesis = "speechSynthesis" in window;
    const supportedMime = getSupportedMimeType();

    const supported = hasMediaRecorder && hasMediaDevices && hasSynthesis;
    setIsSupported(supported);

    diagnosticsRef.current.mediaRecorderSupported = hasMediaRecorder;
    diagnosticsRef.current.speechSynthesisSupported = hasSynthesis;
    diagnosticsRef.current.supportedMimeType = supportedMime;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as any })
        .then(p => {
          diagnosticsRef.current.micPermission = p.state as any;
          p.onchange = () => {
            diagnosticsRef.current.micPermission = p.state as any;
          };
        })
        .catch(() => {});
    }

    // Populate and select high-quality English voice
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const naturalEnglishVoice =
        voices.find(v => v.name.includes("Natural") && v.lang.startsWith("en")) ||
        voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find(v => v.name.includes("Samantha") || v.name.includes("Karen") || v.name.includes("Victoria")) ||
        voices.find(v => v.lang === "en-US") ||
        voices.find(v => v.lang.startsWith("en")) ||
        voices[0];
      selectedVoiceRef.current = naturalEnglishVoice || null;
    };

    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Cancel SpeechSynthesis safely and immediately
  const cancelSpeech = useCallback((reason?: string) => {
    if (echoSettlingTimeoutRef.current) {
      clearTimeout(echoSettlingTimeoutRef.current);
      echoSettlingTimeoutRef.current = null;
    }
    const isSpeaking = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.speaking : false;
    logDiagnostic("TTS", "SpeechSynthesis cancel requested", {
      isSpeaking,
      hasUtterance: !!currentUtteranceRef.current,
      reason: reason || "general",
    });
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    currentUtteranceRef.current = null;
  }, []);

  // Stop active VAD loop
  const stopVadLoop = useCallback(() => {
    if (vadAnimationIdRef.current) {
      cancelAnimationFrame(vadAnimationIdRef.current);
      vadAnimationIdRef.current = null;
    }
    setAudioLevel(0);
    if (isUserSpeakingRef.current) {
      isUserSpeakingRef.current = false;
      setIsUserSpeaking(false);
    }
  }, []);

  // Ensures single reusable MediaStream and AudioContext
  const ensureMediaResources = useCallback(async () => {
    let stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      });
      mediaStreamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      if (track && track.getSettings) {
        const settings = track.getSettings();
        diagnosticsRef.current.echoCancellationEnabled = settings.echoCancellation ?? "unsupported";
        diagnosticsRef.current.noiseSuppressionEnabled = settings.noiseSuppression ?? "unsupported";
        diagnosticsRef.current.autoGainControlEnabled = settings.autoGainControl ?? "unsupported";
      }
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    const audioCtx = audioContextRef.current;
    if (!analyserRef.current) {
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      analyserRef.current = analyser;
    }

    return { stream, analyser: analyserRef.current };
  }, []);

  // Safely starts or restarts a clean MediaRecorder for the current turn
  const startTurnRecording = useCallback(async () => {
    let stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      await ensureMediaResources();
      stream = mediaStreamRef.current;
    }
    if (!stream || !stream.active) {
      logDiagnostic("RECORDER", "Cannot start turn recording: no active stream");
      return;
    }

    // Safely stop and detach previous recorder if one exists
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        if (mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }

    // Reset chunks buffer for this fresh turn
    audioChunksRef.current = [];

    try {
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onerror = (e: any) => {
        logDiagnostic("RECORDER", "MediaRecorder error", { error: e.error?.name || e.message });
      };

      recorder.start(100); // 100ms timeslices for smooth capture
      mediaRecorderRef.current = recorder;
      logDiagnostic("RECORDER", `Turn recording started (${recorder.mimeType || "default"})`);
    } catch (err: any) {
      logDiagnostic("RECORDER", "Failed to start MediaRecorder", { error: err.message });
    }
  }, [ensureMediaResources]);

  // Main real-time Voice Activity Detection loop (Active ONLY during LISTENING)
  const startContinuousVadLoop = useCallback(() => {
    stopVadLoop();
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const SILENCE_DURATION_MS = 1400; // 1.4s silence after user speech to trigger completion
    const MIN_SUSTAINED_SPEECH_MS = 300; // User must speak continuously for >= 300ms
    const MAX_RECORDING_MS = 30000; // 30s continuous speech limit without stuttering

    const runVad = () => {
      if (!isActiveRef.current || isMutedRef.current) {
        return;
      }

      const currentState = voiceStateRef.current;

      // STABILIZATION GUARANTEE:
      // While Friday is SPEAKING or THINKING, VAD does NOT listen to speakers or trigger barge-in!
      // This completely eliminates acoustic feedback loops and false self-interruption.
      if (currentState !== "listening" && currentState !== "capturing_interruption") {
        vadAnimationIdRef.current = requestAnimationFrame(runVad);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      // Human vocal formant band: ~280Hz to ~2800Hz (frequency bins 3 through 30)
      let vocalSum = 0;
      for (let i = 3; i <= 30; i++) {
        vocalSum += dataArray[i];
      }
      const vocalEnergy = vocalSum / 28;

      let totalSum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        totalSum += dataArray[i];
      }
      const totalEnergy = totalSum / dataArray.length;

      const now = Date.now();

      // Throttled audioLevel state updates to max 10fps (~100ms)
      if (now - lastLevelUpdateRef.current >= 100) {
        lastLevelUpdateRef.current = now;
        const normalizedLevel = Math.min(100, Math.round((totalEnergy / 70) * 100));
        setAudioLevel(normalizedLevel);
      }

      // Track ambient noise floor adaptively when quiet
      if (totalEnergy < noiseFloorRef.current) {
        noiseFloorRef.current = noiseFloorRef.current * 0.9 + totalEnergy * 0.1;
      } else {
        noiseFloorRef.current = noiseFloorRef.current * 0.995 + totalEnergy * 0.005;
      }
      noiseFloorRef.current = Math.max(6, Math.min(28, noiseFloorRef.current));

      // Hysteresis thresholds
      const speechStartThreshold = Math.max(16, noiseFloorRef.current + 11);
      const speechStopThreshold = Math.max(12, noiseFloorRef.current + 5);

      const isAudioAboveThreshold = speechConfirmedRef.current
        ? totalEnergy >= speechStopThreshold
        : totalEnergy >= speechStartThreshold;

      if (isAudioAboveThreshold) {
        lastSoundTimeRef.current = now;

        if (!speechConfirmedRef.current) {
          if (speechCandidateStartTimeRef.current === 0) {
            speechCandidateStartTimeRef.current = now;
          } else if (now - speechCandidateStartTimeRef.current >= MIN_SUSTAINED_SPEECH_MS) {
            // Sustained speech confirmed! Mark user utterance active
            speechConfirmedRef.current = true;
            if (!isUserSpeakingRef.current) {
              isUserSpeakingRef.current = true;
              setIsUserSpeaking(true);
            }
            setInterimTranscript("Listening to you...");
          }
        }
      } else {
        if (!speechConfirmedRef.current) {
          // Drop short transient click or mic tap
          speechCandidateStartTimeRef.current = 0;
        }
      }

      const totalDuration = now - recordingStartTimeRef.current;

      // Silence detection: ONLY triggers if genuine sustained speech was actually confirmed!
      if (
        speechConfirmedRef.current &&
        now - lastSoundTimeRef.current >= SILENCE_DURATION_MS
      ) {
        logDiagnostic("VAD", "Silence detected after genuine user speech; auto-completing turn", {
          speechDuration: now - recordingStartTimeRef.current,
        });
        if (isUserSpeakingRef.current) {
          isUserSpeakingRef.current = false;
          setIsUserSpeaking(false);
        }
        stopRecordingAndTranscribe();
        return;
      }

      // Hard duration limit safety (30 seconds)
      if (speechConfirmedRef.current && totalDuration >= MAX_RECORDING_MS) {
        logDiagnostic("VAD", "Reached max recording duration (30s); auto-completing turn");
        if (isUserSpeakingRef.current) {
          isUserSpeakingRef.current = false;
          setIsUserSpeaking(false);
        }
        stopRecordingAndTranscribe();
        return;
      }

      vadAnimationIdRef.current = requestAnimationFrame(runVad);
    };

    vadAnimationIdRef.current = requestAnimationFrame(runVad);
  }, [stopVadLoop]);

  // Starts an active listening & recording turn for Turn 1, Turn 2, ... Turn N
  const startListeningSession = useCallback(async () => {
    if (!isActiveRef.current || isMutedRef.current) {
      return;
    }

    logDiagnostic("STATE", "Starting listening session (new turn)");
    // Clear in-flight state locks
    isSubmittingRef.current = false;
    isProcessingAudioRef.current = false;

    cancelSpeech("start_listening_session");

    try {
      await ensureMediaResources();

      // Crucial Multi-turn Fix: Restart a fresh MediaRecorder instance for this turn!
      await startTurnRecording();

      // Reset turn parameters
      speechCandidateStartTimeRef.current = 0;
      speechConfirmedRef.current = false;
      isUserSpeakingRef.current = false;
      setIsUserSpeaking(false);
      setInterimTranscript("");
      lastSoundTimeRef.current = Date.now();
      recordingStartTimeRef.current = Date.now();

      transitionState("listening", "turn_initialized_and_recording");
      startContinuousVadLoop();
    } catch (err: any) {
      console.error("[Friday Voice] Error starting audio capture:", err);
      const isDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.includes("denied");

      if (isDenied) {
        setErrorMessage("Microphone permission was denied. Please allow microphone access in your browser address bar.");
        setErrorCode("not-allowed");
      } else {
        setErrorMessage("Could not access microphone: " + (err.message || "Hardware error"));
        setErrorCode("audio-capture");
      }
      transitionState("error", "mic_error");
    }
  }, [cancelSpeech, ensureMediaResources, startContinuousVadLoop, startTurnRecording, transitionState]);

  // Stop recording and send audio to /api/transcribe
  const stopRecordingAndTranscribe = useCallback(async () => {
    logDiagnostic("RECORDER", "stopRecordingAndTranscribe called", {
      isProcessing: isProcessingAudioRef.current,
      state: voiceStateRef.current,
      chunksCount: audioChunksRef.current.length,
    });
    if (isProcessingAudioRef.current) return;
    isProcessingAudioRef.current = true;
    stopVadLoop();

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      logDiagnostic("RECORDER", "No recorder instance upon finalize; resetting to listening");
      isProcessingAudioRef.current = false;
      if (isActiveRef.current && !isMutedRef.current) {
        startListeningSession();
      }
      return;
    }

    logDiagnostic("STATE", "Finalizing audio recording for transcription", { fromState: voiceStateRef.current });
    transitionState("thinking", "finalizing_audio_recording");

    // Wrap in promise to wait for onstop
    const audioBlob = await new Promise<Blob | null>(resolve => {
      if (recorder.state === "inactive") {
        const chunks = audioChunksRef.current;
        if (!chunks.length) {
          resolve(null);
        } else {
          const mime = recorder.mimeType || getSupportedMimeType() || "audio/webm";
          resolve(new Blob(chunks, { type: mime }));
        }
        return;
      }

      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        if (!chunks.length) {
          logDiagnostic("RECORDER", "recorder onstop fired with 0 chunks");
          resolve(null);
          return;
        }
        const mime = recorder.mimeType || getSupportedMimeType() || "audio/webm";
        const blob = new Blob(chunks, { type: mime });
        audioChunksRef.current = [];
        logDiagnostic("RECORDER", "recorder onstop created blob", { size: blob.size, mime: blob.type, chunksCount: chunks.length });
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (err: any) {
        logDiagnostic("RECORDER", "Error stopping recorder", { error: err.message });
        resolve(null);
      }
    });

    // Require at least 3KB of actual audio data to prevent sending silent blips
    if (!audioBlob || audioBlob.size < 3000) {
      logDiagnostic("RECORDER", "Audio blob discarded: too small or silent", { size: audioBlob ? audioBlob.size : 0 });
      isProcessingAudioRef.current = false;
      if (isActiveRef.current && !isMutedRef.current) {
        setInterimTranscript("");
        startListeningSession();
      } else {
        transitionState("idle", "audio_discarded_silent");
      }
      return;
    }

    try {
      setInterimTranscript("Transcribing voice with Gemini...");
      const base64Audio = await blobToBase64(audioBlob);

      logDiagnostic("GEMINI", "POST /api/transcribe request started", {
        blobSize: audioBlob.size,
        mime: audioBlob.type,
        base64Length: base64Audio.length,
      });
      const reqStart = Date.now();
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: audioBlob.type,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const transcript = (data.transcript || "").trim();
      logDiagnostic("GEMINI", "POST /api/transcribe completed", { durationMs: Date.now() - reqStart, transcript });

      if (transcript.length > 0) {
        setFinalTranscript(transcript);
        setInterimTranscript("");
        setErrorMessage(null);
        setErrorCode(null);
        isSubmittingRef.current = true;

        logDiagnostic("GEMINI", "Forwarding transcript to onSendMessage pipeline", { transcript });
        await onSendMessageRef.current(transcript);
      } else {
        logDiagnostic("GEMINI", "Transcript was empty string; resetting to listening");
        setInterimTranscript("");
        if (isActiveRef.current && !isMutedRef.current && voiceStateRef.current !== "speaking") {
          startListeningSession();
        }
      }
    } catch (err: any) {
      logDiagnostic("GEMINI", "Transcription error", { error: err.message });
      setErrorMessage("Voice transcription failed: " + (err.message || "Network error"));
      setErrorCode("transcription-error");
      transitionState("error", "transcription_failure");
    } finally {
      isProcessingAudioRef.current = false;
    }
  }, [startListeningSession, stopVadLoop, transitionState]);

  // Speaks assistant response fluently without self-interruption
  const speakResponse = useCallback(
    async (rawText: string) => {
      const cleanText = cleanTextForSpeech(rawText);
      if (!cleanText) {
        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSession();
        }
        return;
      }

      logDiagnostic("TTS", "speakResponse requested", {
        charCount: cleanText.length,
        preview: cleanText.slice(0, 50),
      });
      cancelSpeech("speakResponse_new_utterance");

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        console.warn("[Friday Voice] SpeechSynthesis not supported");
        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSession();
        }
        return;
      }

      // Enter SPEAKING state
      // Microphone VAD is held idle during speech to guarantee NO self-interruption!
      transitionState("speaking", "friday_started_speaking");
      audioChunksRef.current = [];
      if (isUserSpeakingRef.current) {
        isUserSpeakingRef.current = false;
        setIsUserSpeaking(false);
      }

      // Stop any recorder if still running during speech
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtteranceRef.current = utterance;

      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current;
      }

      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        logDiagnostic("TTS", "SpeechSynthesis onstart event fired (audio playing to speakers)");
      };

      utterance.onend = () => {
        logDiagnostic("TTS", "SpeechSynthesis onend event fired (finished vocalizing)");
        isSubmittingRef.current = false;
        currentUtteranceRef.current = null;

        // When Friday finishes speaking naturally:
        // Wait 250ms for speaker acoustic room echo to decay completely, then safely restart listening & recording!
        if (isActiveRef.current && !isMutedRef.current) {
          if (voiceStateRef.current === "speaking") {
            echoSettlingTimeoutRef.current = setTimeout(() => {
              if (isActiveRef.current && !isMutedRef.current && voiceStateRef.current === "speaking") {
                startListeningSession(); // Restarts fresh MediaRecorder and VAD for Turn N+1!
              }
            }, 250);
          }
        } else {
          transitionState("idle", "speechSynthesis_ended_inactive");
        }
      };

      utterance.onerror = (e: any) => {
        logDiagnostic("TTS", "SpeechSynthesis onerror event fired", { error: e.error });
        isSubmittingRef.current = false;
        currentUtteranceRef.current = null;

        if (e.error === "canceled" || e.error === "interrupted") {
          return;
        }

        if (isActiveRef.current && !isMutedRef.current) {
          if (voiceStateRef.current === "speaking") {
            startListeningSession();
          }
        } else {
          transitionState("idle", "speechSynthesis_error_inactive");
        }
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("[Friday Voice] Failed to call speechSynthesis.speak:", err);
        isSubmittingRef.current = false;
        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSession();
        }
      }
    },
    [cancelSpeech, startListeningSession, transitionState]
  );

  // User manually interrupts Friday (tap mascot, overlay, or mic button)
  const interrupt = useCallback(() => {
    logDiagnostic("TTS", "Manual Tap-to-Interrupt triggered by user");
    cancelSpeech("tap_to_interrupt");
    isSubmittingRef.current = false;
    isProcessingAudioRef.current = false;
    if (isActiveRef.current && !isMutedRef.current) {
      startListeningSession();
    }
  }, [cancelSpeech, startListeningSession]);

  // User manually triggers "Done Speaking" to submit immediately without waiting for silence
  const stopRecordingAndSubmit = useCallback(() => {
    if (voiceStateRef.current === "listening" || voiceStateRef.current === "capturing_interruption") {
      logDiagnostic("RECORDER", "User tapped to complete speech immediately");
      stopRecordingAndTranscribe();
    }
  }, [stopRecordingAndTranscribe]);

  // Toggles microphone mute state
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      logDiagnostic("STATE", `toggleMute: now ${next ? "MUTED" : "UNMUTED"}`);

      if (next) {
        cancelSpeech("muted");
        stopVadLoop();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
        transitionState("idle", "muted");
      } else {
        startListeningSession();
      }
      return next;
    });
  }, [cancelSpeech, startListeningSession, stopVadLoop, transitionState]);

  // Activates voice mode on explicit user interaction
  const startVoiceMode = useCallback(() => {
    logDiagnostic("STATE", "Activating Voice Mode (Explicit Interaction)");
    isActiveRef.current = true;
    setIsActive(true);
    setErrorMessage(null);
    setErrorCode(null);
    setInterimTranscript("");
    setFinalTranscript("");
    isSubmittingRef.current = false;
    isProcessingAudioRef.current = false;
    startListeningSession();
  }, [startListeningSession]);

  // Exits voice mode and completely releases all media hardware
  const stopVoiceMode = useCallback(() => {
    logDiagnostic("STATE", "Deactivating Voice Mode & Releasing Hardware");
    isActiveRef.current = false;
    setIsActive(false);
    transitionState("idle", "exit_voice_mode");
    setInterimTranscript("");
    setFinalTranscript("");
    setErrorMessage(null);
    setErrorCode(null);
    isSubmittingRef.current = false;
    isProcessingAudioRef.current = false;
    cancelSpeech("exit_voice_mode");
    stopVadLoop();

    if (echoSettlingTimeoutRef.current) {
      clearTimeout(echoSettlingTimeoutRef.current);
      echoSettlingTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        if (mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, [cancelSpeech, stopVadLoop, transitionState]);

  // Manual retry handler
  const retryListening = useCallback(() => {
    logDiagnostic("STATE", "User triggered manual retry");
    setErrorMessage(null);
    setErrorCode(null);
    isSubmittingRef.current = false;
    isProcessingAudioRef.current = false;
    startListeningSession();
  }, [startListeningSession]);

  // Sends a text query while inside voice mode so Friday vocalizes the answer
  const sendVoiceTextQuery = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || isSubmittingRef.current) return;

    logDiagnostic("GEMINI", "sendVoiceTextQuery submitted", { query: trimmed });
    isSubmittingRef.current = true;
    stopVadLoop();
    cancelSpeech("sendVoiceTextQuery");

    setFinalTranscript(trimmed);
    setInterimTranscript("");
    setErrorMessage(null);
    setErrorCode(null);
    transitionState("thinking", "sendVoiceTextQuery");

    try {
      await onSendMessageRef.current(trimmed);
    } catch (err: any) {
      console.error("[Friday Voice] sendVoiceTextQuery error:", err);
      isSubmittingRef.current = false;
      setErrorMessage("Failed to send: " + (err.message || "Unknown error"));
      setErrorCode("send-failed");
      transitionState("error", "send_failed");
    }
  }, [cancelSpeech, stopVadLoop, transitionState]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      cancelSpeech("unmount");
      stopVadLoop();
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
        } catch {}
      }
    };
  }, [cancelSpeech, stopVadLoop]);

  // Expose diagnostic / test handle in development for multi-turn verification
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__voiceAssistantTest = {
        getVoiceState: () => voiceStateRef.current,
        getAudioLevel: () => audioLevel,
        getAudioContext: () => audioContextRef.current,
        getAnalyser: () => analyserRef.current,
        getStream: () => mediaStreamRef.current,
        getRecorder: () => mediaRecorderRef.current,
        isRecorderActive: () => mediaRecorderRef.current ? mediaRecorderRef.current.state === "recording" : false,
        interrupt: () => interrupt(),
        speakResponse: (text: string) => speakResponse(text),
        submitSimulatedTurn: async (transcript: string) => {
          logDiagnostic("RECORDER", "submitSimulatedTurn called", { transcript });
          stopVadLoop();
          transitionState("thinking", "simulated_turn");
          setFinalTranscript(transcript);
          setInterimTranscript("");
          isSubmittingRef.current = true;
          await onSendMessageRef.current(transcript);
        },
      };
    }
  }, [audioLevel, interrupt, speakResponse, stopVadLoop, transitionState]);

  return {
    isSupported,
    isActive,
    voiceState,
    interimTranscript,
    finalTranscript,
    isMuted,
    errorMessage,
    errorCode,
    audioLevel,
    isUserSpeaking,
    diagnostics: diagnosticsRef.current,
    startVoiceMode,
    stopVoiceMode,
    toggleMute,
    speakResponse,
    interrupt,
    retryListening,
    sendVoiceTextQuery,
    stopRecordingAndSubmit,
  };
}
