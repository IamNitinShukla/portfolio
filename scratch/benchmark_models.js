const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match[1].trim();

const modelsToTest = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest'
];

async function testLatency(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: "Hello! Answer: 'READY'." }] }]
      }),
      signal: AbortSignal.timeout(6000)
    });
    
    if (!res.ok) {
      const err = await res.text();
      return { model, status: res.status, time: Date.now() - t0, err: err.substring(0, 100) };
    }
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let ttft = null;
    let text = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (ttft === null) ttft = Date.now() - t0;
      const chunk = decoder.decode(value, { stream: true });
      text += chunk;
    }
    
    return { model, status: 200, ttft, totalTime: Date.now() - t0, outputLength: text.length };
  } catch (e) {
    return { model, status: 'TIMEOUT/ERR', time: Date.now() - t0, err: e.message };
  }
}

async function main() {
  console.log("Benchmarking all Flash models for latency and availability...");
  for (const m of modelsToTest) {
    const res = await testLatency(m);
    console.log(JSON.stringify(res));
  }
}

main();
