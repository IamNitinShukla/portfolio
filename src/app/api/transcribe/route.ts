import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Sliding-window rate limiter per client IP
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT_RPM = 30;

function isRateLimited(ip: string): boolean {
  const maxRpm = parseInt(process.env.GEMINI_RATE_LIMIT_RPM || "", 10) || DEFAULT_RATE_LIMIT_RPM;
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { timestamps: [] };

  record.timestamps = record.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (record.timestamps.length >= maxRpm) {
    return true;
  }

  record.timestamps.push(now);
  rateLimitMap.set(ip, record);
  return false;
}

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const MAX_JSON_BYTES = Math.ceil(MAX_AUDIO_BYTES / 3) * 4 + 1024;
const audioTypes = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/aac"];

function hasAudioHeader(audio: Buffer, type: string) {
  switch (type) {
    case "audio/webm": return audio.readUInt32BE(0) === 0x1a45dfa3;
    case "audio/mp4": return audio.toString("ascii", 4, 8) === "ftyp";
    case "audio/ogg": return audio.toString("ascii", 0, 4) === "OggS";
    case "audio/wav": return audio.toString("ascii", 0, 4) === "RIFF" && audio.toString("ascii", 8, 12) === "WAVE";
    case "audio/aac": return audio[0] === 0xff && (audio[1] & 0xf6) === 0xf0;
    default: return false;
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let model: string | null = null;
  let mimeType = "";
  let bytes = 0;
  function log(status: number, returned = false) {
    console.info("[Friday Transcribe]", { model, status, durationMs: Date.now() - started,
      mimeType, audioBytes: bytes, transcriptReturned: returned });
  }
  function failure(status: number, code: string, error: string) {
    log(status);
    return Response.json({ code, error }, { status });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return failure(503, "stt_unavailable", "Voice transcription is unavailable.");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (isRateLimited(ip)) return failure(429, "rate_limited", "Too many recordings. Try again in a minute.");

  const type = req.headers.get("content-type")?.split(";")[0].toLowerCase().trim();
  const json = type === "application/json";
  if (!json && !audioTypes.includes(type || "")) return failure(415, "unsupported_audio", "Unsupported audio format.");
  const limit = json ? MAX_JSON_BYTES : MAX_AUDIO_BYTES;
  if (Number(req.headers.get("content-length")) > limit) return failure(413, "too_large", "Recording is too large.");
  let audio: Buffer;
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > limit) {
        await reader.cancel();
        return failure(413, "too_large", "Recording is too large.");
      }
      chunks.push(value);
    }
    audio = Buffer.concat(chunks);
    if (json) {
      const body = JSON.parse(audio.toString("utf8"));
      const encoded = body.audio?.replace(/^data:audio\/[^,]+;base64,/, "");
      if (!encoded || encoded.length % 4 || /[^A-Za-z0-9+/=]/.test(encoded)) throw new Error();
      const claimedType = (body.mimeType ?? "audio/webm").split(";")[0].trim().toLowerCase();
      if (!audioTypes.includes(claimedType)) return failure(415, "unsupported_audio", "Unsupported audio format.");
      mimeType = claimedType;
      audio = Buffer.from(encoded, "base64");
    } else {
      mimeType = type!;
    }
  } catch {
    return failure(400, "invalid_audio", "Invalid recording payload.");
  }
  bytes = audio.length;
  if (bytes < 64) return failure(400, "invalid_audio", "Recording is empty or incomplete.");
  if (bytes > MAX_AUDIO_BYTES) return failure(413, "too_large", "Recording is too large.");
  if (!hasAudioHeader(audio, mimeType)) return failure(400, "invalid_audio", "Recording does not match its audio format.");

  const models = new Set([process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || process.env.GEMINI_MODEL?.trim(),
    "gemini-flash-lite-latest", "gemini-3.5-flash-lite"].filter((name): name is string => Boolean(name)));
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: "Transcribe only the spoken words verbatim. Do not answer questions. Return an empty string for silence, noise or unintelligible audio." }] },
    contents: [{ parts: [{ inlineData: { mimeType, data: audio.toString("base64") } }, { text: "Transcribe this recording." }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const deadline = AbortSignal.timeout(24000);
  const signal = AbortSignal.any([req.signal, deadline]);
  for (const candidate of Array.from(models)) {
    model = candidate;
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body, signal, cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const details = await res.json().catch(() => null);
          if (details?.error?.details?.some((item: { reason?: string }) => item.reason === "API_KEY_INVALID")) {
            return failure(400, "stt_credentials", "The transcription service rejected its server credentials.");
          }
          return failure(400, "invalid_request", "The transcription service rejected the recording or request.");
        }
        await res.body?.cancel();
        if (res.status === 404) { log(404); continue; }
        if (res.status === 401 || res.status === 403) return failure(res.status, "stt_credentials", "The transcription service rejected its server credentials.");
        if (res.status === 429) return failure(429, "rate_limited", "Voice transcription quota reached. Try again later.");
        return failure(res.status >= 500 ? res.status : 502, "stt_service_error", "The transcription service is temporarily unavailable.");
      }
      const data = await res.json();
      const candidateResult = data.candidates?.[0];
      if (!candidateResult || candidateResult.finishReason !== "STOP") return failure(502, "incomplete_transcription", "Transcription did not finish.");
      const transcript = (candidateResult.content?.parts ?? [])
        .filter((part: { thought?: boolean }) => !part.thought)
        .map((part: { text?: string }) => part.text || "").join("").trim().replace(/^["']|["']$/g, "").trim();
      if (!transcript || /^(?:\[(silence|noise|inaudible)\]|none|empty)$/i.test(transcript)) {
        return failure(422, "no_speech", "No speech was recognized.");
      }
      log(200, true);
      return Response.json({ transcript, model, durationMs: Date.now() - started });
    } catch {
      if (req.signal.aborted) return failure(499, "cancelled", "Recording cancelled.");
      if (deadline.aborted) return failure(504, "timeout", "Transcription timed out.");
      return failure(502, "stt_service_error", "The transcription service could not be reached.");
    }
  }
  return failure(404, "stt_unavailable", "No configured transcription model is available.");
}
