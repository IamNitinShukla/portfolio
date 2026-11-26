import { NextRequest } from "next/server";
import { getSystemInstruction } from "@/lib/assistantKnowledge";
import {
  isCurrentInfoQuery,
  isPortfolioQuery,
  searchWeb,
  type WebSearchResult,
} from "@/lib/webSearch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

// In-memory sliding-window rate limiter per IP address
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_RATE_LIMIT_RPM = 30; // 30 requests per minute

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

  // Periodic cleanup of stale IPs
  if (rateLimitMap.size > 1000) {
    rateLimitMap.forEach((val, key) => {
      if (
        val.timestamps.length === 0 ||
        now - val.timestamps[val.timestamps.length - 1] > RATE_LIMIT_WINDOW_MS
      ) {
        rateLimitMap.delete(key);
      }
    });
  }

  return false;
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();

  // 1. Secret Verification (Exclusively on Server)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.warn(
      `[Friday Assistant] Fallback Triggered | Status: 503 | Reason: GEMINI_API_KEY is not configured | Total: ${Date.now() - requestStartTime}ms | Source: Fallback`
    );
    return Response.json(
      {
        error: "Gemini API key is not configured on the server.",
        fallbackAvailable: true,
      },
      { status: 503 }
    );
  }

  // 2. Client IP & Rate Limiting
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (isRateLimited(clientIp)) {
    console.warn(
      `[Friday Assistant] Rate Limited | IP: ${clientIp} | Total: ${Date.now() - requestStartTime}ms`
    );
    return Response.json(
      {
        error: "Rate limit exceeded. Please wait a moment before sending another message.",
        fallbackAvailable: true,
      },
      { status: 429 }
    );
  }

  // 3. Input Validation & Request-Size Limits
  let body: { message?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON request payload." }, { status: 400 });
  }

  const { message, history } = body;

  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 1000) {
    return Response.json(
      { error: "Message exceeds maximum allowed length of 1000 characters." },
      { status: 400 }
    );
  }

  // 4. Map Conversational History (Last 6–8 Turns)
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(history)) {
    const recent = history.slice(-8);
    for (const item of recent) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        (item.sender === "user" || item.sender === "assistant")
      ) {
        contents.push({
          role: item.sender === "user" ? "user" : "model",
          parts: [{ text: item.text.trim().substring(0, 800) }],
        });
      }
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: trimmedMessage }],
  });

  // 5. Intelligent Query Classification & Real-Time Web Search
  const isCurrent = isCurrentInfoQuery(trimmedMessage);
  const isPortfolio = isPortfolioQuery(trimmedMessage);

  let webSearchResults: WebSearchResult[] = [];
  if (isCurrent) {
    try {
      webSearchResults = await searchWeb(trimmedMessage, 4);
    } catch {
      webSearchResults = [];
    }
  }

  const dynamicSystemInstruction = getSystemInstruction({
    currentDate: new Date(),
    webSearchResults,
    isPortfolioQuery: isPortfolio,
  });

  // 6. Model Candidate Hierarchy with Automatic Low-Latency Failover
  // Prioritize low-latency responsive Flash models
  const envModel = process.env.GEMINI_MODEL;
  const primaryModel = envModel && envModel.trim() ? envModel.trim() : "gemini-flash-lite-latest";
  const fastFallbacks = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-3.5-flash-lite"];
  const candidateModels = Array.from(new Set([primaryModel, ...fastFallbacks]));

  const geminiPayload = {
    systemInstruction: {
      parts: [{ text: dynamicSystemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
      topP: 0.95,
    },
  };

  let activeResponse: globalThis.Response | null = null;
  let activeModel = primaryModel;
  let lastErrorReason = "";

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    // 12-second timeout per candidate to allow sufficient time for code generation & explanations
    const timeoutMs = 12000;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok && res.body) {
        activeResponse = res;
        activeModel = model;
        break;
      }

      lastErrorReason = `HTTP ${res.status} from ${model}`;

      // If 503 (high demand) or 404 (model not found), fail over immediately
      if (res.status === 503 || res.status === 404 || res.status === 429) {
        continue;
      }

      // For other client errors (e.g. 400 Bad Request, 403 Forbidden), record and stop
      activeResponse = res;
      activeModel = model;
      break;
    } catch (e: unknown) {
      const err = e as Error;
      lastErrorReason = `${model} ${err.name || "Error"}: ${err.message}`;
      continue;
    }
  }

  // 6. Handle Complete Upstream Failure
  if (!activeResponse || !activeResponse.ok || !activeResponse.body) {
    const status = activeResponse ? activeResponse.status : 504;
    console.warn(
      `[Friday Assistant] Fallback Triggered | Status: ${status} | Error: ${lastErrorReason} | Total: ${Date.now() - requestStartTime}ms | Source: Fallback`
    );
    return Response.json(
      {
        error: "Upstream AI model unavailable. Safe fallback is available.",
        status,
        fallbackAvailable: true,
      },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }

  // 7. Transform Gemini SSE stream into Client-Friendly SSE Stream with Latency Metrics
  const upstreamReader = activeResponse.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let sseBuffer = "";
  let ttft: number | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) {
            const totalDuration = Date.now() - requestStartTime;
            console.log(
              `[Friday Assistant] Model: ${activeModel} | Status: 200 | TTFT: ${ttft ?? totalDuration}ms | Total: ${totalDuration}ms | Source: Gemini`
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  model: activeModel,
                  ttft,
                  totalTime: totalDuration,
                  sources: webSearchResults.map(s => ({ title: s.title, url: s.url })),
                })}\n\n`
              )
            );
            controller.close();
            break;
          }

          if (ttft === null) {
            ttft = Date.now() - requestStartTime;
          }

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr);
                const textPart = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textPart) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: textPart })}\n\n`)
                  );
                }
              } catch {
                // Ignore parsing errors on metadata lines
              }
            }
          }
        }
      } catch (err: unknown) {
        controller.error(err);
      } finally {
        try {
          upstreamReader.releaseLock();
        } catch {}
      }
    },
    cancel() {
      try {
        upstreamReader.cancel();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Model-Used": activeModel,
    },
  });
}
