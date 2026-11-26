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

interface VoiceView {
  voiceState: VoiceState;
  isMuted: boolean;
  finalTranscript: string;
  errorMessage: string;
}
const initialView: VoiceView = { voiceState: "idle", isMuted: false, finalTranscript: "", errorMessage: "" };
const recorderTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/aac"];

// Each recording owns its recorder, chunks, timers and callbacks through a distinct signal.
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

  constructor(private update: (patch: Partial<VoiceView>) => void, private send: SendVoiceMessage) {}

  private cancelTurn() {
    this.turn.abort();
    clearTimeout(this.timer);
    clearInterval(this.meter);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = undefined;
    this.recognition?.abort();
    this.recognition = undefined;
    if (this.utterance) window.speechSynthesis.cancel();
    this.utterance = undefined;
  }

  private fail(message: string) {
    this.cancelTurn();
    if (!this.closed) this.update({ voiceState: "error", errorMessage: message });
  }

  async open() {
    if (this.closed || this.initializing) return;
    this.initializing = true;
    try {
      if (!window.speechSynthesis) throw new Error("Speech playback is unavailable in this browser.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires a supported browser and HTTPS.");
      window.speechSynthesis.getVoices();
      if (!this.stream) {
        const stream = await navigator.mediaDevices.getUserMedia({audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }});
        if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
        this.stream = stream;
        for (const track of stream.getAudioTracks()) {
          track.enabled = !this.muted;
          track.onended = () => {
            this.stream = undefined;
            this.analyser = undefined;
            void this.context?.close().catch(() => {});
            this.context = undefined;
            this.fail("Microphone disconnected. Reconnect it and retry.");
          };
        }
      }
      this.mime = typeof MediaRecorder === "undefined" ? "" : recorderTypes.find(type => MediaRecorder.isTypeSupported(type)) || "";
      if (!this.mime) {
        if (!await this.enableLocalRecognition()) throw new Error("This browser has no supported audio recorder or installed English speech recognizer.");
      } else if (!this.analyser) {
        this.context ??= new AudioContext();
        await this.context.resume();
        if (this.closed) return;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 1024;
        this.context.createMediaStreamSource(this.stream).connect(this.analyser);
      }
      if (!this.muted && !this.closed) this.listen();
    } catch (error) {
      if (!this.closed) this.fail(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in the browser and retry."
        : error instanceof Error ? error.message : "Microphone setup failed.");
    } finally {
      this.initializing = false;
    }
  }

  // Only use a recognizer with an installed on-device language pack.
  private async enableLocalRecognition() {
    const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const engine = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!engine?.available || await engine.available({ langs: ["en-US"], processLocally: true }) !== "available") return false;
    this.localEngine = engine;
    return true;
  }

  private listen() {
    if (this.closed || this.muted || !this.stream) return;
    this.cancelTurn();
    this.turn = new AbortController();
    const signal = this.turn.signal;
    this.update({ voiceState: "idle", errorMessage: "", finalTranscript: "" });
    try {
      if (this.localEngine) {
        const recognition = new this.localEngine();
        this.recognition = recognition;
        recognition.lang = "en-US";
        recognition.processLocally = true;
        let finalized = false;
        recognition.onstart = () => { if (!signal.aborted) this.update({ voiceState: "listening" }); };
        recognition.onresult = event => {
          if (signal.aborted || finalized) return;
          const text = event.results[0]?.[0]?.transcript.trim();
          if (!text) return;
          finalized = true;
          recognition.abort();
          void this.generate(text, signal);
        };
        recognition.onend = () => { if (!signal.aborted && !finalized) this.fail("No speech recognized. Retry when ready."); };
        recognition.onerror = () => { if (!signal.aborted && !finalized) this.fail("Local recognition failed. Retry when ready."); };
        recognition.start(this.stream.getAudioTracks()[0]);
        return;
      }

      const recorder = new MediaRecorder(this.stream, { mimeType: this.mime, audioBitsPerSecond: 64000 });
      const chunks: Blob[] = [];
      const analyser = this.analyser!;
      const samples = new Float32Array(analyser.fftSize);
      let speech = false;
      let loudSince = 0;
      let lastSpeech = 0;
      let noise = 0.003;
      this.recorder = recorder;
      recorder.ondataavailable = event => { if (!signal.aborted && event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { if (!signal.aborted) this.fail("Microphone recording failed. Retry when ready."); };
      recorder.onstop = () => {
        if (signal.aborted) return;
        clearInterval(this.meter);
        this.recorder = undefined;
        if (!speech) { this.listen(); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (!blob.type.startsWith("audio/") || blob.size < 64 || blob.size > 3 * 1024 * 1024) {
          this.fail("Recording is empty or too large. Try a shorter question.");
          return;
        }
        void this.transcribe(blob, signal);
      };
      this.timer = window.setTimeout(() => {
        if (!signal.aborted) this.fail("The microphone did not start recording. Check your input device and retry.");
      }, 8000);
      recorder.onstart = () => {
        if (signal.aborted) return;
        clearTimeout(this.timer);
        this.update({ voiceState: "listening" });
        const start = performance.now();
        this.meter = window.setInterval(() => {
          if (signal.aborted || recorder.state !== "recording") return;
          analyser.getFloatTimeDomainData(samples);
          let energy = 0;
          for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
          const rms = Math.sqrt(energy / samples.length);
          const now = performance.now();
          if (rms > Math.max(0.009, noise * 2.8)) {
            loudSince ||= now;
            lastSpeech = now;
            if (!speech && now - loudSince >= 80) {
              speech = true;
              this.update({ voiceState: "recording" });
            }
          } else {
            loudSince = 0;
            if (!speech) noise = noise * 0.95 + rms * 0.05;
          }
          // Rotate silent clips locally. Bound both pre-roll and total upload size.
          if ((speech && now - lastSpeech >= 850) || now - start >= (speech ? 45000 : 12000)) {
            clearInterval(this.meter);
            recorder.stop();
          }
        }, 25);
      };
      recorder.start(200);
    } catch {
      this.fail("Could not start recording. Check your microphone and retry.");
    }
  }

  private async transcribe(blob: Blob, signal: AbortSignal) {
    this.update({ voiceState: "transcribing" });
    this.timer = window.setTimeout(() => this.fail("Transcription timed out. Please retry."), 30000);
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: blob, signal });
      const data = await res.json();
      if (signal.aborted) return;
      if (!res.ok) {
        if (data.code === "no_speech") { this.listen(); return; }
        if (data.code === "stt_unavailable" && await this.enableLocalRecognition()) {
          if (!signal.aborted) this.listen();
          return;
        }
        throw new Error(data.error || "Voice transcription failed. Please retry.");
      }
      const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
      if (!transcript) throw new Error("No transcript was returned. Please retry.");
      clearTimeout(this.timer);
      await this.generate(transcript, signal);
    } catch (error) {
      if (!signal.aborted) this.fail(error instanceof Error ? error.message : "Transcription failed.");
    }
  }

  private async generate(text: string, signal: AbortSignal) {
    this.update({ voiceState: "generating", finalTranscript: text });
    this.timer = window.setTimeout(() => this.fail("Friday's reply timed out. Please retry."), 48000);
    try {
      const reply = await this.send(text, signal);
      if (signal.aborted) return;
      clearTimeout(this.timer);
      this.speakResponse(reply, signal);
    } catch (error) {
      if (!signal.aborted) this.fail(error instanceof Error ? error.message : "Friday could not complete the reply.");
    }
  }

  private speakResponse(reply: string, signal: AbortSignal) {
    const text = cleanTextForSpeech(reply);
    if (!text) throw new Error("Friday returned an empty reply.");
    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.lang = "en-US";
    const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith("en"));
    utterance.voice = voices.find(voice => voice.localService) || voices[0] || null;
    utterance.rate = 1.05;
    this.timer = window.setTimeout(() => this.fail("Speech playback did not start. Check your audio and retry."), 10000);
    utterance.onstart = () => {
      if (signal.aborted) return;
      clearTimeout(this.timer);
      this.update({ voiceState: "speaking" });
      this.timer = window.setTimeout(() => this.fail("Speech playback stalled. Please retry."), Math.max(30000, text.length * 200));
    };
    utterance.onend = () => {
      if (signal.aborted || this.utterance !== utterance) return;
      clearTimeout(this.timer);
      this.utterance = undefined;
      this.timer = window.setTimeout(() => { if (!signal.aborted) this.listen(); }, 250);
    };
    utterance.onerror = () => { if (!signal.aborted) this.fail("Speech playback failed. Check your audio and retry."); };
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }

  retry() {
    if (!this.closed && !this.muted) void this.open();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.stream?.getAudioTracks().forEach(track => { track.enabled = !this.muted; });
    this.cancelTurn();
    this.update({ isMuted: this.muted, voiceState: "idle", errorMessage: "" });
    if (!this.muted) this.retry();
  }

  interrupt() {
    if (this.utterance) this.listen();
  }

  close() {
    this.closed = true;
    this.cancelTurn();
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    void this.context?.close().catch(() => {});
  }
}

export function useVoiceAssistant({ onSendMessage }: { onSendMessage: SendVoiceMessage }) {
  const [view, setView] = useState(initialView);
  const [isActive, setActive] = useState(false);
  const session = useRef<VoiceSession>();
  const send = useRef(onSendMessage);
  send.current = onSendMessage;
  useEffect(() => () => session.current?.close(), []);
  return {
    ...view, isActive,
    startVoiceMode() {
      if (session.current) return;
      setView(initialView);
      setActive(true);
      session.current = new VoiceSession(patch => setView(prev => ({ ...prev, ...patch })), (text, signal) => send.current(text, signal));
      void session.current.open();
    },
    stopVoiceMode() {
      session.current?.close();
      session.current = undefined;
      setActive(false);
    },
    toggleMute: () => session.current?.toggleMute(),
    interrupt: () => session.current?.interrupt(),
    retryListening: () => session.current?.retry(),
  };
}
