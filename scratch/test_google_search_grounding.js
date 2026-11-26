const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
if (!keyMatch) { console.error('No key found'); process.exit(1); }
const key = keyMatch[1].trim();

async function testGrounding(model, toolConfig, isStream = false) {
  console.log(`\n========================================`);
  console.log(`Testing Model: ${model} | Stream: ${isStream} | Tool: ${JSON.stringify(toolConfig)}`);
  
  const endpoint = isStream ? 'streamGenerateContent' : 'generateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${key}`;
  
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: "What are the latest developments in AI this week? Give 2 recent news points." }]
      }
    ],
    tools: [toolConfig]
  };

  try {
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const elapsed = Date.now() - t0;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${elapsed}ms)`);
    
    if (!res.ok) {
      const errText = await res.text();
      console.log(`Error Response:`, errText);
      return { success: false, status: res.status, error: errText };
    }

    if (isStream) {
      const rawText = await res.text();
      console.log(`Stream response length: ${rawText.length} chars`);
      // Try to parse SSE chunks or JSON array
      console.log(`First 300 chars of stream:`, rawText.substring(0, 300));
      // Check if grounding metadata exists in stream
      const hasGrounding = rawText.includes('groundingMetadata') || rawText.includes('webSearchQueries');
      console.log(`Stream contains grounding metadata: ${hasGrounding}`);
      return { success: true, isStream: true, hasGrounding };
    } else {
      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      const groundingMetadata = candidate?.groundingMetadata;
      
      console.log(`Generated Text (preview):`, text ? text.substring(0, 200) + '...' : 'NO TEXT');
      console.log(`Grounding Metadata:`, JSON.stringify(groundingMetadata, null, 2));
      return { success: true, groundingMetadata, textPreview: text?.substring(0, 100) };
    }
  } catch (err) {
    console.error(`Fetch error:`, err.message);
    return { success: false, error: err.message };
  }
}

async function run() {
  // Test 1: googleSearch syntax on gemini-flash-lite-latest
  await testGrounding('gemini-flash-lite-latest', { googleSearch: {} }, false);

  // Test 2: googleSearch syntax on gemini-2.5-flash
  await testGrounding('gemini-2.5-flash', { googleSearch: {} }, false);

  // Test 3: googleSearch on gemini-3.5-flash-lite
  await testGrounding('gemini-3.5-flash-lite', { googleSearch: {} }, false);

  // Test 4: Streaming test on gemini-2.5-flash
  await testGrounding('gemini-2.5-flash', { googleSearch: {} }, true);
}

run();
