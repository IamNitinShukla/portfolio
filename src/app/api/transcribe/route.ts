import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Distributed sliding-window rate limiter per client IP via Upstash Redis
let ratelimitInstance: Ratelimit | null = null;
let lastConfiguredUrl = "";
let lastConfiguredToken = "";

function getRateLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  if (!ratelimitInstance || url !== lastConfiguredUrl || token !== lastConfiguredToken) {
    const redis = new Redis({
      url,
      token,
      retry: false,
      signal: () => AbortSignal.timeout(3000),
    });

    ratelimitInstance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "60 s"),
      analytics: false,
      prefix: "ratelimit:stt",
    });

    lastConfiguredUrl = url;
    lastConfiguredToken = token;
  }

  return ratelimitInstance;
}

/**
 * Resolves a trusted client IP in the Vercel hosting environment.
 * Rejects untrusted/spoofable headers. In development or test environments,
 * falls back to loopback or test headers.
 */
function getTrustedClientIp(req: NextRequest): string | null {
  // 1. Vercel edge proxy trusted headers (cannot be forged by external clients on Vercel)
  const vercelForwardedFor = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercelForwardedFor) return vercelForwardedFor;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  if (req.ip && typeof req.ip === "string" && req.ip.trim()) {
    return req.ip.trim();
  }

  // 2. In non-production/development or local test environments, allow loopback host or test header
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    const host = req.headers.get("host") || "";
    if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("[::1]")) {
      return "127.0.0.1";
    }
    const testIp = req.headers.get("x-test-client-ip")?.trim();
    if (testIp) return testIp;
  }

  return null;
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
  const reqId = req.headers.get("x-friday-correlation-id") || ("stt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6));
  let model: string | null = null;
  let mimeType = "";
  let bytes = 0;
  let clientRateLimitHeaders: Record<string, string> | undefined;

  function log(status: number, returned = false, detail = "") {
    console.info(`[Friday Transcribe] [reqId: ${reqId}]`, {
      model, status, durationMs: Date.now() - started,
      mimeType, audioBytes: bytes, transcriptReturned: returned,
      detail: detail || undefined,
    });
  }
  function failure(status: number, code: string, error: string, detail = "", extraHeaders?: Record<string, string>) {
    log(status, false, detail || error);
    const combinedHeaders = {
      ...(clientRateLimitHeaders || {}),
      ...(extraHeaders || {}),
    };
    return Response.json({ code, error, reqId }, { status, headers: Object.keys(combinedHeaders).length > 0 ? combinedHeaders : undefined });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return failure(503, "stt_unavailable", "Voice transcription is unavailable.");

  // 1. Establish verified client IP
  const ip = getTrustedClientIp(req);
  if (!ip) {
    return failure(400, "untrusted_client", "Unable to establish verified client identity.");
  }

  // 2. Distributed rate limiting via Upstash Redis (Fail-Closed)
  const limiter = getRateLimiter();
  if (!limiter) {
    log(503, false, "Upstash Redis credentials are not configured on server (failing closed)");
    return failure(503, "rate_limiter_unavailable", "Voice transcription service rate limiting is unavailable.");
  }

  let rateLimitResult;
  try {
    rateLimitResult = await limiter.limit(ip);
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : "Service error";
    log(503, false, `Upstash rate limiter execution failure: ${errMessage} (failing closed)`);
    return failure(503, "rate_limiter_unavailable", "Voice transcription service rate limiting is unavailable.");
  }

  if (!rateLimitResult.success) {
    const resetSec = Math.max(1, Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    const rateLimitHeaders: Record<string, string> = {
      "Retry-After": resetSec.toString(),
      "X-RateLimit-Limit": rateLimitResult.limit.toString(),
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(rateLimitResult.reset / 1000).toString(),
    };
    return failure(429, "rate_limited", "Too many recordings. Try again in a minute.", `Rate limit exceeded for IP: ${ip}`, rateLimitHeaders);
  }

  clientRateLimitHeaders = {
    "X-RateLimit-Limit": rateLimitResult.limit.toString(),
    "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(rateLimitResult.reset / 1000).toString(),
  };

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

  // Dedicated ASR models first, followed by multimodal fallback models
  const candidateModels = Array.from(
    new Set(
      [
        process.env.GEMINI_TRANSCRIBE_MODEL?.trim(),
        "gemini-3.5-transcribe",
        "gemini-3.8-flash",
        "gemini-flash-latest",
      ].filter((name): name is string => Boolean(name))
    )
  );

  const base64Audio = audio.toString("base64");
  const deadline = AbortSignal.timeout(18000);
  const signal = AbortSignal.any([req.signal, deadline]);

  let lastCandidateError = "";

  for (const candidate of candidateModels) {
    model = candidate;
    try {
      // Note: gemini-3.5-transcribe does not accept systemInstruction ("Developer instruction is not enabled").
      // Supplying the audio inlineData with prompt in contents ensures broad cross-model compatibility.
      const requestPayload = {
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64Audio } },
              { text: "Transcribe the spoken words in this audio verbatim. If silence or no speech, return an empty string or [silence]." },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 512 },
      };

      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(requestPayload),
          signal,
          cache: "no-store",
        }
      );

      if (!res.ok) {
        lastCandidateError = `HTTP ${res.status} from ${model}`;
        if (res.status === 400) {
          const details = await res.json().catch(() => null);
          if (details?.error?.details?.some((item: { reason?: string }) => item.reason === "API_KEY_INVALID")) {
            return failure(400, "stt_credentials", "The transcription service rejected its server credentials.");
          }
          // If model rejected developer instruction or modality, try next candidate model
          log(400, false, `Candidate ${model} rejected request: ${details?.error?.message || "Bad Request"}`);
          continue;
        }
        await res.body?.cancel();
        if (res.status === 404 || res.status === 503 || res.status === 429) {
          log(res.status, false, `Candidate ${model} returned ${res.status}, failing over`);
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          return failure(res.status, "stt_credentials", "The transcription service rejected its server credentials.");
        }
        log(res.status, false, `Candidate ${model} failed with ${res.status}, continuing to next model`);
        continue;
      }

      const data = await res.json();
      const candidateResult = data.candidates?.[0];
      const parts = candidateResult?.content?.parts ?? [];
      const transcript = parts
        .filter((part: { thought?: boolean }) => !part.thought)
        .map((part: { text?: string }) => part.text || "")
        .join("")
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim();

      if (!transcript || /^(?:\[(silence|noise|inaudible)\]|none|empty)$/i.test(transcript)) {
        return failure(422, "no_speech", "No speech was recognized.");
      }

      log(200, true);
      return Response.json(
        { transcript, model, reqId, durationMs: Date.now() - started },
        { headers: clientRateLimitHeaders }
      );
    } catch (err: unknown) {
      if (req.signal.aborted) return failure(499, "cancelled", "Recording cancelled.");
      if (deadline.aborted) return failure(504, "timeout", "Transcription timed out.");
      lastCandidateError = err instanceof Error ? err.message : "Network error";
      log(502, false, `Candidate ${model} threw error: ${lastCandidateError}`);
      continue;
    }
  }

  return failure(502, "stt_service_error", `The transcription service is temporarily unavailable. (${lastCandidateError || "All candidates failed"})`);
}
