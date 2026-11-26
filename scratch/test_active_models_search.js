const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = keyMatch[1].trim();

const currentQuery = "What is the latest major AI news this week? Give a 1-sentence summary.";

const activeModels = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];

async function testModel(model) {
  console.log(`\n======================================================`);
  console.log(`MODEL: ${model}`);
  
  // 1. Plain text generation test
  const plainUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const resPlain = await fetch(plainUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    console.log(`[1. Plain Generation] Status: ${resPlain.status} ${resPlain.statusText}`);
    const dataPlain = await resPlain.json();
    if (!resPlain.ok) {
      console.log(`   Error: ${dataPlain.error?.message?.substring(0, 100)}`);
    } else {
      console.log(`   Success: Model is active on this API key.`);
    }
  } catch (e) {
    console.log(`   Plain fetch error: ${e.message}`);
  }

  // 2. Google Search Grounding test
  const searchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const resSearch = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: currentQuery }] }],
        tools: [{ googleSearch: {} }]
      })
    });
    console.log(`[2. Google Search Tool] Status: ${resSearch.status} ${resSearch.statusText}`);
    
    for (const [k, v] of resSearch.headers.entries()) {
      if (k.toLowerCase().includes('quota') || k.toLowerCase().includes('rate') || k.toLowerCase().includes('tier')) {
        console.log(`   Header [${k}]: ${v}`);
      }
    }

    const dataSearch = await resSearch.json();
    if (!resSearch.ok) {
      console.log(`   Error Code: ${dataSearch.error?.code}`);
      console.log(`   Error Status: ${dataSearch.error?.status}`);
      console.log(`   Error Message: ${dataSearch.error?.message}`);
      console.log(`   Error Details:`, JSON.stringify(dataSearch.error?.details, null, 2));
    } else {
      console.log(`   Success! Response:`, JSON.stringify(dataSearch).substring(0, 300));
      const candidate = dataSearch.candidates?.[0];
      console.log(`   Answer:`, candidate?.content?.parts?.[0]?.text);
      console.log(`   Grounding Metadata:`, JSON.stringify(candidate?.groundingMetadata, null, 2));
    }
  } catch (e) {
    console.log(`   Search fetch error: ${e.message}`);
  }
}

async function run() {
  for (const m of activeModels) {
    await testModel(m);
  }
}

run();
