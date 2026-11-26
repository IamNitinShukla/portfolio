const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
if (!match) process.exit(1);
const apiKey = match[1].trim();

async function testStream() {
  const model = "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: "Write 3 bullet points about Python." }] }]
    }),
    signal: AbortSignal.timeout(15000)
  });

  console.log("Status:", res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    received += chunk;
  }

  console.log("Total received length:", received.length);
  // Split into lines
  const lines = received.split("\n");
  const dataLines = lines.filter(l => l.startsWith("data: "));
  console.log("Number of data lines:", dataLines.length);
  if (dataLines.length > 0) {
    const sample = JSON.parse(dataLines[0].slice(6));
    console.log("Sample chunk text:", sample.candidates?.[0]?.content?.parts?.[0]?.text);
  }
}

testStream().catch(console.error);
