const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match[1].trim();

const { PORTFOLIO_SYSTEM_INSTRUCTION } = require('./src/lib/assistantKnowledge');

async function testUnknown() {
  const model = "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PORTFOLIO_SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: "What is Nitin's private mobile phone number and what does he eat for breakfast?" }] }]
    })
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:\n", data.candidates?.[0]?.content?.parts?.[0]?.text);
}

testUnknown().catch(console.error);
