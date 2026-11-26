const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = keyMatch[1].trim();

async function checkDetailedError() {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + key;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'What is today date?' }] }],
      tools: [{ googleSearch: {} }]
    })
  });
  console.log('Status:', res.status, res.statusText);
  for (const [k, v] of res.headers.entries()) {
    console.log(`${k}: ${v}`);
  }
  const text = await res.text();
  console.log('Body:', text);
}
checkDetailedError();
