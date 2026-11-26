const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
if (!keyMatch) {
  console.error('No GEMINI_API_KEY found in .env.local');
  process.exit(1);
}
const key = keyMatch[1].trim();

const currentQuery = "What is the latest major AI news this week? Give a 1-sentence summary.";

async function testEndpoint(apiVersion, model, toolPayload, desc) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${key}`;
  console.log(`\n--------------------------------------------------`);
  console.log(`[TEST] ${apiVersion} / ${model} | Tool: ${desc}`);
  
  const body = {
    contents: [
      {
        parts: [{ text: currentQuery }]
      }
    ]
  };

  if (toolPayload) {
    body.tools = [toolPayload];
  }

  try {
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const elapsed = Date.now() - t0;
    
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${elapsed}ms)`);
    
    // Check relevant quota / rate limit headers
    for (const [k, v] of res.headers.entries()) {
      if (k.toLowerCase().includes('quota') || k.toLowerCase().includes('rate') || k.toLowerCase().includes('tier')) {
        console.log(`  Header [${k}]: ${v}`);
      }
    }

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.log(`Raw Body (first 300 chars):`, text.substring(0, 300));
      return;
    }

    if (!res.ok) {
      console.log(`Error Response:`, JSON.stringify(json, null, 2));
      return { status: res.status, error: json.error };
    }

    const candidate = json.candidates?.[0];
    const answerText = candidate?.content?.parts?.[0]?.text;
    const groundingMetadata = candidate?.groundingMetadata;

    console.log(`Answer Text:`, answerText ? answerText.substring(0, 200) + '...' : '(None)');
    if (groundingMetadata) {
      console.log(`Grounding Metadata detected!`);
      console.log(`Search Queries:`, groundingMetadata.webSearchQueries);
      console.log(`Grounding Chunks (Sources):`, JSON.stringify(groundingMetadata.groundingChunks?.slice(0, 3), null, 2));
    } else {
      console.log(`Grounding Metadata: None`);
    }

    return { status: res.status, answerText, groundingMetadata };
  } catch (err) {
    console.error(`Fetch exception:`, err.message);
    return { error: err.message };
  }
}

async function run() {
  console.log("=== GEMINI 2.5 FLASH GOOGLE SEARCH GROUNDING INVESTIGATION ===");

  // 1. First test baseline generation without tools on gemini-2.5-flash (v1beta vs v1)
  console.log("\n>>> Step 1: Baseline Plain Generation on 2.5 Flash");
  await testEndpoint('v1beta', 'gemini-2.5-flash', null, 'None (Plain text)');
  await testEndpoint('v1', 'gemini-2.5-flash', null, 'None (Plain text)');

  // 2. Test gemini-2.5-flash-lite baseline
  await testEndpoint('v1beta', 'gemini-2.5-flash-lite', null, 'None (Plain text)');

  // 3. Test gemini-2.5-flash with Google Search Grounding syntax 1: { googleSearch: {} }
  console.log("\n>>> Step 2: Testing Google Search Grounding with { googleSearch: {} }");
  await testEndpoint('v1beta', 'gemini-2.5-flash', { googleSearch: {} }, '{ googleSearch: {} }');
  await testEndpoint('v1', 'gemini-2.5-flash', { googleSearch: {} }, '{ googleSearch: {} }');

  // 4. Test gemini-2.5-flash with syntax 2: { google_search: {} }
  console.log("\n>>> Step 3: Testing Google Search Grounding with { google_search: {} }");
  await testEndpoint('v1beta', 'gemini-2.5-flash', { google_search: {} }, '{ google_search: {} }');

  // 5. Test gemini-2.5-flash with dynamic retrieval syntax: { google_search_retrieval: {} }
  console.log("\n>>> Step 4: Testing Google Search Grounding with { google_search_retrieval: {} }");
  await testEndpoint('v1beta', 'gemini-2.5-flash', { google_search_retrieval: { dynamic_retrieval_config: { mode: "MODE_DYNAMIC" } } }, '{ google_search_retrieval }');
}

run();
