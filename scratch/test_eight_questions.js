const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match[1].trim();

// Read system instruction directly from TypeScript source
const tsSource = fs.readFileSync('src/lib/assistantKnowledge.ts', 'utf8');
const promptMatch = tsSource.match(/export const PORTFOLIO_SYSTEM_INSTRUCTION = `([\s\S]+?)`;/);
let systemInstruction = "";
if (promptMatch) {
  systemInstruction = promptMatch[1];
} else {
  systemInstruction = "You are Nitin Shukla's portfolio AI assistant. Answer accurately using only his verified portfolio data.";
}

const questions = [
  { id: 1, q: "What is Nitin's full name?" },
  { id: 2, q: "What is his technical specialization?" },
  { id: 3, q: "Explain LexGenAI." },
  { id: 4, q: "Which technologies did he use in LexGenAI?" },
  { id: 5, q: "What is Nitin's UPI ID?" },
  { id: 6, q: "Compare LexGenAI and Krishi-Setu." },
  {
    id: 7,
    q: "Tell me more about the second project.",
    history: [
      { role: "user", parts: [{ text: "What are two featured projects by Nitin?" }] },
      { role: "model", parts: [{ text: "Nitin's featured projects include 1. LexGenAI (Legal intelligence RAG) and 2. Krishi-Setu (AgriTech multimodal vision and voice AI)." }] }
    ]
  },
  { id: 8, q: "What is his phone number?" }
];

async function ask(model, item) {
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  
  const contents = item.history ? [...item.history, { role: "user", parts: [{ text: item.q }] }] : [{ role: "user", parts: [{ text: item.q }] }];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 350
        }
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { id: item.id, status: res.status, error: await res.text() };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let ttft = null;
    let fullText = "";
    let sseBuf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (ttft === null) ttft = Date.now() - t0;
      sseBuf += decoder.decode(value, { stream: true });
      const lines = sseBuf.split("\n");
      sseBuf = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const part = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (part) fullText += part;
          } catch {}
        }
      }
    }

    return {
      id: item.id,
      q: item.q,
      status: 200,
      ttft,
      totalTime: Date.now() - t0,
      answer: fullText.trim()
    };
  } catch (e) {
    return { id: item.id, q: item.q, error: e.message, time: Date.now() - t0 };
  }
}

async function main() {
  const model = "gemini-flash-lite-latest";
  console.log(`Testing 8 questions against ${model}...`);
  for (const item of questions) {
    const r = await ask(model, item);
    console.log(`\n[Question ${r.id}] "${item.q}"`);
    if (r.status === 200) {
      console.log(`- TTFT: ${r.ttft}ms | Total: ${r.totalTime}ms`);
      console.log(`- Answer: ${r.answer.replace(/\n+/g, ' ')}`);
    } else {
      console.log(`- Failed:`, r.error || r.status);
    }
    // Small gap to stay well within rate limits
    await new Promise(r => setTimeout(r, 600));
  }
}

main();
