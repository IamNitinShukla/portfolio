const fs = require('fs');

function createSampleWav() {
  const sampleRate = 16000;
  const durationSec = 0.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  return buffer;
}

async function testLocalTranscribe() {
  const wav = createSampleWav();
  const base64Audio = wav.toString('base64');
  
  const res = await fetch('http://localhost:3000/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: base64Audio,
      mimeType: 'audio/wav'
    })
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
}

testLocalTranscribe().catch(console.error);
