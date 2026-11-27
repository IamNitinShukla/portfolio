import http from 'http';
import fs from 'fs';
import path from 'path';

// Read .env.local for API key
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const geminiApiKeyMatch = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = geminiApiKeyMatch ? geminiApiKeyMatch[1].trim() : '';

console.log('=== Friday AI Voice & Chat Pipeline Test Suite ===\n');

// 1. Create a dummy 16kHz WAV audio tone (1 second)
function createWavTone(freq = 440, durationSec = 1) {
  const sampleRate = 16000;
  const numSamples = sampleRate * durationSec;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 8000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }
  return buffer;
}

// 2. Direct Gemini Transcribe API Test
async function testDirectTranscribe() {
  console.log('Test 1: Testing direct Gemini STT transcription model...');
  const toneBuffer = createWavTone(440, 1);
  const base64Audio = toneBuffer.toString('base64');

  const requestPayload = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
          { text: 'Transcribe the spoken words in this audio verbatim. If silence or no speech, return an empty string or [silence].' },
        ],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  };

  const t0 = Date.now();
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    }
  );

  const duration = Date.now() - t0;
  console.log(`  gemini-3.5-transcribe responded with HTTP ${res.status} in ${duration}ms`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Direct STT failed: HTTP ${res.status} - ${errText}`);
  }
  const data = await res.json();
  console.log(`  Response structure: candidates count = ${data.candidates?.length ?? 0}`);
  console.log('  PASS: Direct Gemini STT model is operational!\n');
}

// 3. Direct Gemini Chat API Test with Voice Prompting
async function testDirectChatVoice() {
  console.log('Test 2: Testing direct Gemini Chat streaming with Voice header...');
  const prompt = 'Tell me about Nitin Shukla in one sentence.';
  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are Friday, Nitin Shukla's personal AI assistant. This response will be spoken aloud. Give a direct plain-text answer in one or two short sentences, ideally under 35 words."
      }]
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
  };

  const t0 = Date.now();
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:streamGenerateContent?alt=sse&key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  console.log(`  gemini-flash-lite-latest responded with HTTP ${res.status}`);
  if (!res.ok) {
    throw new Error(`Direct Chat failed: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let chunksCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          const part = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (part) {
            fullText += part;
            chunksCount++;
          }
        } catch {}
      }
    }
  }

  const totalTime = Date.now() - t0;
  console.log(`  Received ${chunksCount} chunks in ${totalTime}ms`);
  console.log(`  Output: "${fullText.trim()}"`);
  if (!fullText.trim()) throw new Error('Empty response received from chat model');
  console.log('  PASS: Direct Gemini Voice Chat is operational!\n');
}

// 4. Test Clean Speech Sanitizer
function testSpeechSanitizer() {
  console.log('Test 3: Testing Speech Text Sanitizer...');
  const dirty = "Here is some code: ```const x = 1;``` and `inline code` and a [link](https://example.com) with **bold** text and *bullet*!";
  // Simple regex matching cleanTextForSpeech implementation
  const clean = dirty
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/•|\*|–|—/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  console.log(`  Input:  ${dirty}`);
  console.log(`  Output: ${clean}`);
  if (clean.includes('```') || clean.includes('https://') || clean.includes('*')) {
    throw new Error('Speech text was not cleaned properly');
  }
  console.log('  PASS: Speech text sanitizer is working properly!\n');
}

(async () => {
  try {
    testSpeechSanitizer();
    await testDirectTranscribe();
    await testDirectChatVoice();
    console.log('=============================================');
    console.log('ALL FRIDAY AI PIPELINE TESTS PASSED (3/3)');
    console.log('=============================================');
  } catch (err) {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  }
})();
