const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
if (!match) process.exit(1);
const apiKey = match[1].trim();

async function test(model) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: "Hello! Answer in one word: 'READY'." }] }]
      }),
      signal: AbortSignal.timeout(8000)
    });
    const text = await res.text();
    console.log(`${model}: HTTP ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(text);
      console.log(`  Output: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
    } else {
      console.log(`  Err: ${text.substring(0, 150)}`);
    }
  } catch (e) {
    console.log(`${model}: Error ${e.message}`);
  }
}

async function main() {
  await test('gemini-3.8-flash');
  await test('gemini-3.5-flash');
  await test('gemini-3.1-flash-lite');
  await test('gemini-flash-latest');
}

main();
