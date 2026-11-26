import { useCallback, useEffect, useRef, useState } from "react";

export interface DiagnosticLogEntry {
  timestamp: number;
  timeStr: string;
  category: "STATE" | "AUDIO" | "VAD" | "TTS" | "RECORDER" | "GEMINI" | "STT";
  message: string;
  data?: Record<string, any>;
}

export function logDiagnostic(
  category: "STATE" | "AUDIO" | "VAD" | "TTS" | "RECORDER" | "GEMINI" | "STT",
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
  | "processing"
  | "generating"
  | "speaking"
  | "error"
  // Backward compatibility alias:
  | "thinking"
  | "capturing_interruption";

export interface VoiceDiagnostics {
  browser: string;
  webSpeechSupported: boolean;
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
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);

  // Synchronous refs to prevent race conditions & stale closures
  const voiceStateRef = useRef<VoiceState>("idle");
  voiceStateRef.current = voiceState;

  const isActiveRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;

  // Web Speech API recognition instance ref
  const recognitionRef = useRef<any>(null);
  const isUsingWebSpeechRef = useRef<boolean>(false);

  // MediaRecorder & AudioContext fallback refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadAnimationIdRef = useRef<number | null>(null);

  // Audio level and UI update throttling refs
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
  const ttsWatchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const geminiWatchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // In-flight query & turn lock (prevents duplicate submissions)
  const isSubmittingRef = useRef<boolean>(false);
  const hasTurnFinalizedRef = useRef<boolean>(false);

  // SpeechSynthesis refs
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Store stable callback for onSendMessage
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  // Stable refs for mutually dependent callbacks
  const speakResponseRef = useRef<(rawText: string) => Promise<void>>(() => Promise.resolve());
  const startListeningSessionRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const interruptRef = useRef<() => void>(() => {});

  // Diagnostics ref
  const diagnosticsRef = useRef<VoiceDiagnostics>({
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
    webSpeechSupported: false,
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

  // Stop active VAD animation loop
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

  // Cancel SpeechSynthesis safely and clear watchdogs
  const cancelSpeech = useCallback((reason?: string) => {
    if (echoSettlingTimeoutRef.current) {
      clearTimeout(echoSettlingTimeoutRef.current);
      echoSettlingTimeoutRef.current = null;
    }
    if (ttsWatchdogTimeoutRef.current) {
      clearTimeout(ttsWatchdogTimeoutRef.current);
      ttsWatchdogTimeoutRef.current = null;
    }
    if (geminiWatchdogTimeoutRef.current) {
      clearTimeout(geminiWatchdogTimeoutRef.current);
      geminiWatchdogTimeoutRef.current = null;
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
      // Unpin from window to allow GC now that it's cancelled
      delete (window as any).__fridayUtterance;
    }
    currentUtteranceRef.current = null;
  }, []);

  // Check browser support and microphone permission on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasWebSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasMediaRecorder = typeof MediaRecorder !== "undefined";
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasSynthesis = "speechSynthesis" in window;
    const supportedMime = getSupportedMimeType();

    const supported = (hasWebSpeech || hasMediaRecorder) && hasMediaDevices && hasSynthesis;
    setIsSupported(supported);

    diagnosticsRef.current.webSpeechSupported = hasWebSpeech;
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
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      cancelSpeech("unmount");
      stopVadLoop();
    };
  }, [cancelSpeech, stopVadLoop]);

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

  // Forwards finalized utterance to Gemini and coordinates state transition
  const processUserUtterance = useCallback(
    async (transcriptText: string) => {
      const text = transcriptText.trim();
      if (!text) {
        logDiagnostic("STT", "Empty transcript, returning to listening");
        setInterimTranscript("");
        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSessionRef.current();
        }
        return;
      }

      logDiagnostic("STATE", "User utterance finalized; transitioning to generating", { text });
      setFinalTranscript(text);
      setInterimTranscript("");
      setErrorMessage(null);
      setErrorCode(null);
      isSubmittingRef.current = true;
      transitionState("generating", "utterance_finalized_sending_to_gemini");

      // Watchdog: If Gemini request takes > 18 seconds, unstick the assistant gracefully
      if (geminiWatchdogTimeoutRef.current) {
        clearTimeout(geminiWatchdogTimeoutRef.current);
      }
      geminiWatchdogTimeoutRef.current = setTimeout(() => {
        if (voiceStateRef.current === "generating" || voiceStateRef.current === "processing") {
          logDiagnostic("GEMINI", "Gemini response timeout (18s watchdog expired)");
          speakResponseRef.current("I had trouble reaching the AI server. Let's try that again.");
        }
      }, 18000);

      try {
        await onSendMessageRef.current(text);
      } catch (err: any) {
        logDiagnostic("GEMINI", "Error in onSendMessage", { error: err.message });
        speakResponseRef.current("I couldn't process that request. Could you please repeat?");
      } finally {
        if (geminiWatchdogTimeoutRef.current) {
          clearTimeout(geminiWatchdogTimeoutRef.current);
          geminiWatchdogTimeoutRef.current = null;
        }
      }
    },
    [transitionState]
  );

  // Speaks assistant response fluently without self-interruption
  const speakResponse = useCallback(
    async (rawText: string) => {
      const cleanText = cleanTextForSpeech(rawText);
      if (!cleanText) {
        isSubmittingRef.current = false;
        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSessionRef.current();
        } else {
          transitionState("idle", "empty_response_text");
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
        isSubmittingRef.current = false;
        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSessionRef.current();
        }
        return;
      }

      // Resume speech synthesis if suspended by browser
      if (window.speechSynthesis.paused) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtteranceRef.current = utterance;
      // CRITICAL: Pin utterance to window object to prevent Chrome/Edge V8 Garbage Collection bug!
      (window as any).__fridayUtterance = utterance;

      utterance.lang = "en-US";
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current;
      }

      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Estimated speech duration in ms for safety watchdog
      const words = cleanText.split(/\s+/).length;
      const estimatedMs = Math.max(7000, Math.round((words / 2.3) * 1000) + 5000);

      // CRITICAL: Transition to speaking ONLY when audio actually begins vocalizing!
      utterance.onstart = () => {
        logDiagnostic("TTS", "SpeechSynthesis onstart event fired (audio playback active)");
        transitionState("speaking", "audio_playback_began");

        // Start safety watchdog to prevent infinite speaking freeze if browser onend fails
        if (ttsWatchdogTimeoutRef.current) clearTimeout(ttsWatchdogTimeoutRef.current);
        ttsWatchdogTimeoutRef.current = setTimeout(() => {
          if (voiceStateRef.current === "speaking") {
            logDiagnostic("TTS", "TTS watchdog timeout triggered; safely recovering to listening");
            cancelSpeech("watchdog_timeout");
            isSubmittingRef.current = false;
            if (isActiveRef.current && !isMutedRef.current) {
              startListeningSessionRef.current();
            }
          }
        }, estimatedMs);
      };

      utterance.onend = () => {
        logDiagnostic("TTS", "SpeechSynthesis onend event fired (finished vocalizing)");
        if (ttsWatchdogTimeoutRef.current) {
          clearTimeout(ttsWatchdogTimeoutRef.current);
          ttsWatchdogTimeoutRef.current = null;
        }
        delete (window as any).__fridayUtterance;
        currentUtteranceRef.current = null;
        isSubmittingRef.current = false;

        // When Friday finishes speaking naturally:
        // Wait 250ms for speaker acoustic room echo to decay completely, then safely restart listening!
        if (isActiveRef.current && !isMutedRef.current) {
          echoSettlingTimeoutRef.current = setTimeout(() => {
            if (isActiveRef.current && !isMutedRef.current) {
              startListeningSessionRef.current();
            }
          }, 250);
        } else {
          transitionState("idle", "speechSynthesis_ended_inactive");
        }
      };

      utterance.onerror = (e: any) => {
        logDiagnostic("TTS", "SpeechSynthesis onerror event fired", { error: e.error });
        if (ttsWatchdogTimeoutRef.current) {
          clearTimeout(ttsWatchdogTimeoutRef.current);
          ttsWatchdogTimeoutRef.current = null;
        }
        delete (window as any).__fridayUtterance;
        currentUtteranceRef.current = null;
        isSubmittingRef.current = false;

        if (e.error === "canceled" || e.error === "interrupted") {
          return;
        }

        if (isActiveRef.current && !isMutedRef.current) {
          startListeningSessionRef.current();
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
          startListeningSessionRef.current();
        }
      }
    },
    [cancelSpeech, transitionState]
  );

  // Starts turn recording for MediaRecorder fallback mode
  const startTurnMediaRecorder = useCallback(async () => {
    let stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      await ensureMediaResources();
      stream = mediaStreamRef.current;
    }
    if (!stream || !stream.active) return;

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

    audioChunksRef.current = [];

    try {
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
    } catch (err: any) {
      logDiagnostic("RECORDER", "MediaRecorder fallback init failed", { error: err.message });
    }
  }, [ensureMediaResources]);

  // Stops MediaRecorder fallback and calls /api/transcribe
  const stopMediaRecorderAndTranscribe = useCallback(async () => {
    if (isProcessingAudioRef.current) return;
    isProcessingAudioRef.current = true;
    stopVadLoop();

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      isProcessingAudioRef.current = false;
      if (isActiveRef.current && !isMutedRef.current) startListeningSessionRef.current();
      return;
    }

    transitionState("processing", "transcribing_audio_fallback");

    const audioBlob = await new Promise<Blob | null>(resolve => {
      if (recorder.state === "inactive") {
        const chunks = audioChunksRef.current;
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null);
        return;
      }
      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        const blob = chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null;
        audioChunksRef.current = [];
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });

    if (!audioBlob || audioBlob.size < 2000) {
      isProcessingAudioRef.current = false;
      if (isActiveRef.current && !isMutedRef.current) {
        startListeningSessionRef.current();
      } else {
        transitionState("idle", "audio_too_short");
      }
      return;
    }

    try {
      setInterimTranscript("Transcribing voice...");
      const base64Audio = await blobToBase64(audioBlob);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio, mimeType: audioBlob.type }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const transcript = (data.transcript || "").trim();

      if (transcript.length > 0) {
        await processUserUtterance(transcript);
      } else {
        setInterimTranscript("");
        if (isActiveRef.current && !isMutedRef.current) startListeningSessionRef.current();
      }
    } catch (err: any) {
      logDiagnostic("GEMINI", "Transcription error", { error: err.message });
      setErrorMessage("Voice transcription failed: " + (err.message || "Network error"));
      setErrorCode("transcription-error");
      transitionState("error", "transcription_failure");
    } finally {
      isProcessingAudioRef.current = false;
    }
  }, [processUserUtterance, stopVadLoop, transitionState]);

  // Audio energy monitor & VAD loop
  const startAudioLevelAndVadLoop = useCallback(() => {
    stopVadLoop();
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const SILENCE_DURATION_MS = 1300;
    const MIN_SPEECH_DURATION_MS = 250;

    const runVad = () => {
      if (!isActiveRef.current || isMutedRef.current) return;

      const currentState = voiceStateRef.current;

      analyser.getByteFrequencyData(dataArray);

      let totalSum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        totalSum += dataArray[i];
      }
      const totalEnergy = totalSum / dataArray.length;
      const now = Date.now();

      // Throttled UI level updates (max 10fps / 100ms)
      if (now - lastLevelUpdateRef.current >= 100) {
        lastLevelUpdateRef.current = now;
        const normalizedLevel = Math.min(100, Math.round((totalEnergy / 65) * 100));
        setAudioLevel(normalizedLevel);
      }

      // Voice barge-in detection while Friday is speaking
      if (currentState === "speaking") {
        // Elevated threshold to avoid speaker echo
        const bargeInThreshold = Math.max(35, noiseFloorRef.current + 22);
        if (totalEnergy > bargeInThreshold) {
          if (now - recordingStartTimeRef.current > 350) {
            logDiagnostic("TTS", "Voice barge-in energy detected during speech; interrupting");
            interruptRef.current();
            return;
          }
        }
        vadAnimationIdRef.current = requestAnimationFrame(runVad);
        return;
      }

      if (currentState !== "listening" && currentState !== "capturing_interruption") {
        vadAnimationIdRef.current = requestAnimationFrame(runVad);
        return;
      }

      // Adaptive noise floor tracking
      if (totalEnergy < noiseFloorRef.current) {
        noiseFloorRef.current = noiseFloorRef.current * 0.9 + totalEnergy * 0.1;
      } else {
        noiseFloorRef.current = noiseFloorRef.current * 0.995 + totalEnergy * 0.005;
      }
      noiseFloorRef.current = Math.max(6, Math.min(28, noiseFloorRef.current));

      const speechStartThreshold = Math.max(16, noiseFloorRef.current + 11);
      const isAbove = totalEnergy >= speechStartThreshold;

      if (isAbove) {
        lastSoundTimeRef.current = now;
        if (!speechConfirmedRef.current) {
          if (speechCandidateStartTimeRef.current === 0) {
            speechCandidateStartTimeRef.current = now;
          } else if (now - speechCandidateStartTimeRef.current >= MIN_SPEECH_DURATION_MS) {
            speechConfirmedRef.current = true;
            if (!isUserSpeakingRef.current) {
              isUserSpeakingRef.current = true;
              setIsUserSpeaking(true);
            }
          }
        }
      } else {
        if (!speechConfirmedRef.current) {
          speechCandidateStartTimeRef.current = 0;
        }
      }

      // If in fallback mode (MediaRecorder), silence triggers stop and transcribe
      if (!isUsingWebSpeechRef.current && speechConfirmedRef.current && now - lastSoundTimeRef.current >= SILENCE_DURATION_MS) {
        if (isUserSpeakingRef.current) {
          isUserSpeakingRef.current = false;
          setIsUserSpeaking(false);
        }
        stopMediaRecorderAndTranscribe();
        return;
      }

      vadAnimationIdRef.current = requestAnimationFrame(runVad);
    };

    vadAnimationIdRef.current = requestAnimationFrame(runVad);
  }, [stopMediaRecorderAndTranscribe, stopVadLoop]);

  // Starts an active listening session (Turn 1, Turn 2, ... Turn N)
  const startListeningSession = useCallback(async () => {
    if (!isActiveRef.current || isMutedRef.current) return;

    logDiagnostic("STATE", "Starting listening session (new turn)");
    isSubmittingRef.current = false;
    hasTurnFinalizedRef.current = false;
    isProcessingAudioRef.current = false;

    cancelSpeech("start_listening_session");

    try {
      await ensureMediaResources();

      // Reset turn parameters
      speechCandidateStartTimeRef.current = 0;
      speechConfirmedRef.current = false;
      isUserSpeakingRef.current = false;
      setIsUserSpeaking(false);
      setInterimTranscript("");
      lastSoundTimeRef.current = Date.now();
      recordingStartTimeRef.current = Date.now();

      transitionState("listening", "turn_initialized");
      startAudioLevelAndVadLoop();

      // Check if browser supports Web Speech API
      const SpeechRecognition =
        typeof window !== "undefined"
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null;

      if (SpeechRecognition) {
        isUsingWebSpeechRef.current = true;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          logDiagnostic("STT", "Web Speech Recognition started");
        };

        recognition.onresult = (event: any) => {
          if (!isActiveRef.current || isMutedRef.current || hasTurnFinalizedRef.current) return;

          let interimStr = "";
          let finalStr = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalStr += transcript;
            } else {
              interimStr += transcript;
            }
          }

          if (interimStr.trim()) {
            setInterimTranscript(interimStr.trim());
            if (!isUserSpeakingRef.current) {
              isUserSpeakingRef.current = true;
              setIsUserSpeaking(true);
            }
          }

          if (finalStr.trim()) {
            hasTurnFinalizedRef.current = true;
            try {
              recognition.stop();
            } catch {}
            processUserUtterance(finalStr.trim());
          }
        };

        recognition.onerror = (e: any) => {
          logDiagnostic("STT", "Recognition error event", { error: e.error });
          if (e.error === "no-speech") {
            if (isActiveRef.current && !isMutedRef.current && voiceStateRef.current === "listening") {
              // Silently restart session on transient pause
              try {
                recognition.start();
              } catch {}
            }
            return;
          }
          if (e.error === "not-allowed") {
            setErrorMessage("Microphone permission was denied. Please allow microphone access in your browser settings.");
            setErrorCode("not-allowed");
            transitionState("error", "mic_permission_denied");
            return;
          }
          // On other errors, fallback to MediaRecorder mode if needed
        };

        recognition.onend = () => {
          logDiagnostic("STT", "Recognition onend fired", {
            hasFinalized: hasTurnFinalizedRef.current,
            state: voiceStateRef.current,
          });
          if (
            isActiveRef.current &&
            !isMutedRef.current &&
            !hasTurnFinalizedRef.current &&
            voiceStateRef.current === "listening"
          ) {
            try {
              recognition.start();
            } catch {}
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (startErr: any) {
          logDiagnostic("STT", "Failed to start recognition, falling back to MediaRecorder", { error: startErr.message });
          isUsingWebSpeechRef.current = false;
          await startTurnMediaRecorder();
        }
      } else {
        // Fallback for browsers without Web Speech API
        isUsingWebSpeechRef.current = false;
        await startTurnMediaRecorder();
      }
    } catch (err: any) {
      console.error("[Friday Voice] Error starting audio session:", err);
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
  }, [
    cancelSpeech,
    ensureMediaResources,
    processUserUtterance,
    startAudioLevelAndVadLoop,
    startTurnMediaRecorder,
    transitionState,
  ]);

  // User manually interrupts Friday (tap mascot, overlay, or mic button)
  const interrupt = useCallback(() => {
    logDiagnostic("TTS", "Manual Tap/VAD-to-Interrupt triggered by user");
    cancelSpeech("interrupt");
    isSubmittingRef.current = false;
    hasTurnFinalizedRef.current = false;
    isProcessingAudioRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    if (isActiveRef.current && !isMutedRef.current) {
      startListeningSession();
    }
  }, [cancelSpeech, startListeningSession]);

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
    hasTurnFinalizedRef.current = false;
    isProcessingAudioRef.current = false;

    // Autoplay unlock: prime browser speech synthesis on user gesture
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const prime = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(prime);
      } catch {}
    }

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
    hasTurnFinalizedRef.current = false;
    isProcessingAudioRef.current = false;
    cancelSpeech("exit_voice_mode");
    stopVadLoop();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

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

  // Toggles microphone mute state
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      logDiagnostic("STATE", `toggleMute: now ${next ? "MUTED" : "UNMUTED"}`);

      if (next) {
        cancelSpeech("muted");
        stopVadLoop();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }
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

  // Manual retry handler
  const retryListening = useCallback(() => {
    logDiagnostic("STATE", "User triggered manual retry");
    setErrorMessage(null);
    setErrorCode(null);
    startListeningSession();
  }, [startListeningSession]);

  // User manually triggers "Done Speaking" to submit immediately without waiting for silence
  const stopRecordingAndSubmit = useCallback(() => {
    if (voiceStateRef.current === "listening" || voiceStateRef.current === "capturing_interruption") {
      logDiagnostic("RECORDER", "User tapped to complete speech immediately");
      if (isUsingWebSpeechRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      } else {
        stopMediaRecorderAndTranscribe();
      }
    }
  }, [stopMediaRecorderAndTranscribe]);

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
    speakResponse,
    interrupt,
    stopRecordingAndSubmit,
    sendVoiceTextQuery: processUserUtterance,
    toggleMute,
    retryListening,
  };
}
