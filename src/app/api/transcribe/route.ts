import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();

  // 1. Verify API Key on server
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return Response.json(
      { error: "Gemini API key is not configured on the server." },
      { status: 503 }
    );
  }

  // 2. Client IP & Rate Limiting
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (isRateLimited(clientIp)) {
    return Response.json(
      { error: "Rate limit exceeded. Please wait a moment before sending another voice query." },
      { status: 429 }
    );
  }

  // 3. Parse and Validate Audio Payload
  let body: { audio?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON request payload." }, { status: 400 });
  }

  const { audio, mimeType = "audio/webm" } = body;
  if (!audio || typeof audio !== "string" || audio.trim().length === 0) {
    return Response.json({ error: "Audio data is required (base64 string)." }, { status: 400 });
  }

  // Max payload check: 8MB base64 string
  if (audio.length > 8 * 1024 * 1024) {
    return Response.json({ error: "Audio recording exceeds maximum allowed size (6MB)." }, { status: 413 });
  }

  // Sanitize base64 (strip data URI prefix if present)
  const base64Audio = audio.includes(",") ? audio.split(",")[1] : audio;

  // Normalize mime type for Gemini (strip codec suffix if needed, e.g. audio/webm;codecs=opus -> audio/webm)
  const cleanMimeType = (mimeType.split(";")[0] || "audio/webm").trim();

  // 4. Model Candidate Hierarchy
  const primaryModel = process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";
  const candidateModels = Array.from(new Set([primaryModel, "gemini-flash-lite-latest", "gemini-3.5-flash-lite"]));

  const geminiPayload = {
    systemInstruction: {
      parts: [
        {
          text:
            "You are an accurate speech-to-text audio transcription engine for an AI assistant. " +
            "Your sole task is to transcribe the spoken human words in the audio file verbatim into clean text. " +
            "Rules:\n" +
            "1. Output ONLY the transcribed words. Do NOT include quotes, tags, metadata, or explanations.\n" +
            "2. If the user asks a question, transcribe the question itself. Do NOT answer the question.\n" +
            "3. If there is no audible speech, or if the audio contains only silence, breathing, background music, or electronic tones, output an empty string.\n" +
            "4. Do NOT output placeholder tokens like '[inaudible]', '[silence]', or 'None'. Output nothing if speech is absent.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: base64Audio,
            },
          },
          {
            text: "Transcribe the spoken words in this audio exactly:",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 250,
    },
  };

  let activeModel = candidateModels[0];
  let lastErrorReason = "";
  let transcript = "";

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        transcript = rawText.trim();
        // Remove wrapping quotes if present
        if (
          (transcript.startsWith('"') && transcript.endsWith('"')) ||
          (transcript.startsWith("'") && transcript.endsWith("'"))
        ) {
          transcript = transcript.slice(1, -1).trim();
        }
        // Filter out false positive placeholder tokens
        const lower = transcript.toLowerCase();
        if (
          lower === "[silence]" ||
          lower === "[noise]" ||
          lower === "[inaudible]" ||
          lower === "none" ||
          lower === "empty"
        ) {
          transcript = "";
        }
        activeModel = model;
        break;
      }

      lastErrorReason = `HTTP ${res.status} from ${model}`;
      if (res.status === 404 || res.status === 503 || res.status === 429) {
        continue;
      }
      break;
    } catch (e: unknown) {
      const err = e as Error;
      lastErrorReason = `${model} ${err.name || "Error"}: ${err.message}`;
      continue;
    }
  }

  const durationMs = Date.now() - requestStartTime;
  console.log(
    `[Friday Transcribe] Model: ${activeModel} | Duration: ${durationMs}ms | Transcript: "${transcript}"`
  );

  return Response.json({
    transcript,
    model: activeModel,
    durationMs,
  });
}
