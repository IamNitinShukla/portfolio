const fs = require('fs');
const path = require('path');

// Read GEMINI_API_KEY from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
  console.error("No API key found");
  process.exit(1);
}

// Generate simple PCM WAV with a spoken frequency or tone to verify response
function createSampleWav() {
  const sampleRate = 16000;
  const durationSec = 1.0;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  
  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  
  // Sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5; // 440 Hz tone
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

async function testTranscription() {
  const wavBuffer = createSampleWav();
  const base64Audio = wavBuffer.toString("base64");
  
  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are an accurate audio transcription engine. Transcribe the spoken words in the audio file exactly. Return ONLY the transcription text. If there is no speech (only background noise, silence, or tones), return an empty string or describe [tone]."
      }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio
            }
          },
          {
            text: "Transcribe the audio:"
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 200
    }
  };

  const model = "gemini-flash-lite-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log("Model:", model, "Status:", res.status, "Duration:", Date.now() - start, "ms");
  console.log("Response text:", JSON.stringify(data.candidates?.[0]?.content?.parts?.[0]?.text));
  console.log("Usage metadata:", data.usageMetadata);
}

testTranscription().catch(console.error);
