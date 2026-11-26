const fs = require('fs');

// Load API key from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
if (!keyMatch) {
  console.error("GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}
const apiKey = keyMatch[1].trim();

// Create a valid 1-second 16-bit 8000Hz mono WAV file
function createSineWav(frequency = 440, durationSeconds = 1, sampleRate = 8000) {
  const numSamples = sampleRate * durationSeconds;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // mono (1 channel)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 30000)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

async function testGeminiAudio(model) {
  const wavBuffer = createSineWav(440, 1.5, 8000);
  const base64Audio = wavBuffer.toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio,
            },
          },
          {
            text: "Describe what you hear in this audio recording in one sentence.",
          },
        ],
      },
    ],
  };

  const start = Date.now();
  console.log(`\nTesting Gemini Model '${model}' with audio input (${wavBuffer.length} bytes)...`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - start;
    const status = response.status;
    const data = await response.json();

    if (!response.ok) {
      return {
        model,
        status,
        elapsed: `${elapsed}ms`,
        error: data.error?.message || data,
      };
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const usageMetadata = data.usageMetadata;

    return {
      model,
      status,
      elapsed: `${elapsed}ms`,
      reply: replyText,
      usageMetadata,
    };
  } catch (err) {
    return {
      model,
      error: err.message,
    };
  }
}

async function main() {
  console.log("=== Testing Gemini API Audio Capabilities ===");

  const modelsToTest = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ];

  for (const m of modelsToTest) {
    const res = await testGeminiAudio(m);
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch(console.error);
