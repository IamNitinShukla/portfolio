const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
if (!match) process.exit(1);
const apiKey = match[1].trim();

async function test(model) {
  console.log(`Testing ${model}...`);
  const t0 = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: "Who is Nitin?" }] }]
      }),
      signal: AbortSignal.timeout(15000)
    });
    console.log(`${model}: status=${res.status} in ${Date.now() - t0}ms`);
    const text = await res.text();
    console.log(`body: ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`${model} error: ${e.message} in ${Date.now() - t0}ms`);
  }
}

async function main() {
  await test('gemini-3.1-flash-lite');
  await test('gemini-3.8-flash');
}

main();
