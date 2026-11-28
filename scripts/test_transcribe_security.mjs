import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== Friday Voice Transcription Backend Security Test Suite ===\n');

// 1. Read existing .env.local for Gemini API key
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const geminiApiKey = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/)?.[1]?.trim() || '';

// 2. Generate a valid 16kHz mono WAV tone for testing
function createWavAudio(durationSec = 0.5) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 6000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }
  return buffer;
}

const testWavBuffer = createWavAudio(0.5);

// 3. Setup Mock Upstash Redis Server
let mockRedisFailMode = false;
let mockRedisDelayMs = 0;
const ipRequestCounts = new Map();

const mockRedisServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    if (mockRedisDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, mockRedisDelayMs));
    }

    if (mockRedisFailMode) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Mock Redis internal server error' }));
      return;
    }

    try {
      const parsed = JSON.parse(body);
      // Upstash pipeline request contains array of commands
      // E.g. [["evalsha", sha, numkeys, key1, key2, ...]]
      let ip = 'default';
      if (Array.isArray(parsed) && parsed[0]) {
        const keyArg = parsed[0][3] || '';
        // Extract identifier from key like "ratelimit:stt:192.168.1.1:..."
        const parts = keyArg.split(':');
        if (parts.length >= 3) {
          ip = parts[2];
        }
      }

      const currentCount = (ipRequestCounts.get(ip) || 0) + 1;
      ipRequestCounts.set(ip, currentCount);

      const limit = 30;
      const remaining = currentCount <= limit ? limit - currentCount : -1;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ result: [remaining, limit] }]));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request to mock Redis' }));
    }
  });
});

async function main() {
  // Start mock Redis
  const redisPort = await new Promise(resolve => {
    mockRedisServer.listen(0, '127.0.0.1', () => {
      resolve(mockRedisServer.address().port);
    });
  });
  console.log(`[Test Harness] Mock Upstash Redis Server running on port ${redisPort}`);

  // Start Next.js production server
  const nextPort = 3099;
  const nextEnv = {
    ...process.env,
    PORT: nextPort.toString(),
    UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${redisPort}`,
    UPSTASH_REDIS_REST_TOKEN: 'mock_token_for_testing_123',
    GEMINI_API_KEY: geminiApiKey,
    NODE_ENV: 'production',
    VERCEL: '1', // Simulate Vercel environment
  };

  console.log(`[Test Harness] Spawning Next.js production server on port ${nextPort}...`);
  const nextProcess = spawn('npx', ['next', 'start', '-p', nextPort.toString()], {
    env: nextEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextProcess.stderr.on('data', d => {
    // console.error('[Next.js stderr]:', d.toString());
  });

  // Wait for server to become responsive
  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await fetch(`http://127.0.0.1:${nextPort}/`);
      if (ping.status < 500) {
        serverReady = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!serverReady) {
    console.error('Failed to start Next.js test server.');
    nextProcess.kill();
    mockRedisServer.close();
    process.exit(1);
  }
  console.log('[Test Harness] Next.js test server is ready!\n');

  try {
    // ==========================================
    // TEST 1: Request below the limit
    // ==========================================
    console.log('--- TEST 1: Request below limit ---');
    const res1 = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-vercel-forwarded-for': '198.51.100.10',
      },
      body: testWavBuffer,
    });

    console.log(`  Status: ${res1.status}`);
    console.log(`  Rate-Limit Headers: Limit=${res1.headers.get('x-ratelimit-limit')}, Remaining=${res1.headers.get('x-ratelimit-remaining')}, Reset=${res1.headers.get('x-ratelimit-reset')}`);
    const data1 = await res1.json();
    console.log(`  Body code: ${data1.code || 'success'} (error: ${data1.error || 'none'})`);

    if (res1.status === 429 || res1.status === 503) {
      throw new Error(`Test 1 Failed: unexpected status ${res1.status}`);
    }
    if (!res1.headers.get('x-ratelimit-limit')) {
      throw new Error('Test 1 Failed: missing rate limit headers on allowed response');
    }
    console.log('  PASS: Request below limit processed with rate limit headers.\n');

    // ==========================================
    // TEST 2: Exceeding 30 requests per minute
    // ==========================================
    console.log('--- TEST 2: Exceeding 30 requests per minute ---');
    const targetIp = '198.51.100.20';
    console.log(`  Sending 30 requests from IP ${targetIp}...`);

    await Promise.all(
      Array.from({ length: 30 }, () =>
        fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/wav',
            'x-vercel-forwarded-for': targetIp,
          },
          body: Buffer.from('x'), // small dummy payload that increments rate limiter immediately
        })
      )
    );

    console.log('  Sending 31st request from same IP...');
    const resOverLimit = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-vercel-forwarded-for': targetIp,
      },
      body: testWavBuffer,
    });

    console.log(`  Status: ${resOverLimit.status}`);
    console.log(`  Retry-After: ${resOverLimit.headers.get('retry-after')} seconds`);
    console.log(`  X-RateLimit-Remaining: ${resOverLimit.headers.get('x-ratelimit-remaining')}`);
    const dataOver = await resOverLimit.json();
    console.log(`  Body: ${JSON.stringify(dataOver)}`);

    if (resOverLimit.status !== 429) {
      throw new Error(`Test 2 Failed: expected HTTP 429 but got ${resOverLimit.status}`);
    }
    if (dataOver.code !== 'rate_limited' || !dataOver.error) {
      throw new Error(`Test 2 Failed: error response convention not preserved: ${JSON.stringify(dataOver)}`);
    }
    if (!resOverLimit.headers.get('retry-after')) {
      throw new Error('Test 2 Failed: missing Retry-After header on 429 response');
    }
    console.log('  PASS: 31st request rejected with HTTP 429 and Retry-After header.\n');

    // ==========================================
    // TEST 3: Requests from different client IPs
    // ==========================================
    console.log('--- TEST 3: Requests from different client IPs ---');
    const freshIp = '198.51.100.99';
    console.log(`  Sending request from fresh IP ${freshIp} while previous IP is blocked...`);
    const resDifferentIp = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-vercel-forwarded-for': freshIp,
      },
      body: testWavBuffer,
    });

    console.log(`  Status for ${freshIp}: ${resDifferentIp.status}`);
    if (resDifferentIp.status === 429) {
      throw new Error(`Test 3 Failed: fresh IP was unexpectedly blocked: ${resDifferentIp.status}`);
    }
    console.log('  PASS: Different client IPs maintain independent rate limit counters.\n');

    // ==========================================
    // TEST 4: Spoofed X-Forwarded-For headers
    // ==========================================
    console.log('--- TEST 4: Spoofed X-Forwarded-For headers ---');
    console.log(`  Attempting to bypass block by sending spoofed X-Forwarded-For with blocked real IP (${targetIp})...`);
    const resSpoof = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-vercel-forwarded-for': targetIp, // Real IP known to Vercel edge
        'X-Forwarded-For': '1.1.1.1, 2.2.2.2, 3.3.3.3', // Spoofed header
      },
      body: testWavBuffer,
    });

    console.log(`  Status with spoofed X-Forwarded-For: ${resSpoof.status}`);
    if (resSpoof.status !== 429) {
      throw new Error(`Test 4 Failed: spoofed X-Forwarded-For bypassed the rate limit! Status: ${resSpoof.status}`);
    }
    console.log('  PASS: Spoofed X-Forwarded-For headers do not bypass trusted edge IP tracking.\n');

    // ==========================================
    // TEST 5: Untrusted Client Rejection in Production
    // ==========================================
    console.log('--- TEST 5: Untrusted client rejection in production ---');
    console.log('  Sending request with NO trusted proxy headers in simulated Vercel production...');
    const resUntrusted = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        // Omit x-vercel-forwarded-for and x-real-ip
        'X-Forwarded-For': '99.99.99.99', // Only untrusted header
      },
      body: testWavBuffer,
    });

    console.log(`  Status: ${resUntrusted.status}`);
    const dataUntrusted = await resUntrusted.json();
    console.log(`  Body: ${JSON.stringify(dataUntrusted)}`);

    if (resUntrusted.status !== 400 || dataUntrusted.code !== 'untrusted_client') {
      throw new Error(`Test 5 Failed: expected HTTP 400 untrusted_client, got ${resUntrusted.status} (${JSON.stringify(dataUntrusted)})`);
    }
    console.log('  PASS: Untrusted client identity safely rejected without fallback assigning.\n');

    // ==========================================
    // TEST 6: Redis Service Failure (Fail-Closed)
    // ==========================================
    console.log('--- TEST 6: Redis service failure (Fail-Closed) ---');
    mockRedisFailMode = true;
    console.log('  Mock Redis server set to fail with HTTP 500...');

    const resFailClosed = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-vercel-forwarded-for': '198.51.100.55',
      },
      body: testWavBuffer,
    });

    console.log(`  Status on Redis failure: ${resFailClosed.status}`);
    const dataFailClosed = await resFailClosed.json();
    console.log(`  Body on Redis failure: ${JSON.stringify(dataFailClosed)}`);

    if (resFailClosed.status !== 503 || dataFailClosed.code !== 'rate_limiter_unavailable') {
      throw new Error(`Test 6 Failed: expected HTTP 503 rate_limiter_unavailable, got ${resFailClosed.status}`);
    }
    if (JSON.stringify(dataFailClosed).includes('mock_token_for_testing_123') || JSON.stringify(dataFailClosed).includes(redisPort.toString())) {
      throw new Error('Test 6 Failed: internal credentials or ports leaked in error response');
    }
    console.log('  PASS: Redis failure fails closed with HTTP 503 and zero credential leakage.\n');

    // ==========================================
    // TEST 6B: Redis Request Timeout (strict 3-second timeout)
    // ==========================================
    console.log('--- TEST 6B: Redis request timeout (strict 3-second timeout) ---');
    mockRedisFailMode = false;
    mockRedisDelayMs = 4500; // Mock Redis delay longer than 3-second abort signal
    console.log('  Mock Redis server introduced 4500ms artificial delay (exceeds 3000ms timeout)...');

    const timeoutStart = Date.now();
    const resTimeout = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-vercel-forwarded-for': '198.51.100.66',
      },
      body: testWavBuffer,
    });
    const timeoutDuration = Date.now() - timeoutStart;

    console.log(`  Duration: ${timeoutDuration}ms`);
    console.log(`  Status on Redis timeout: ${resTimeout.status}`);
    const dataTimeout = await resTimeout.json();
    console.log(`  Body on Redis timeout: ${JSON.stringify(dataTimeout)}`);

    // Reset delay
    mockRedisDelayMs = 0;

    if (resTimeout.status !== 503 || dataTimeout.code !== 'rate_limiter_unavailable') {
      throw new Error(`Test 6B Failed: expected HTTP 503 rate_limiter_unavailable on timeout, got ${resTimeout.status} (${JSON.stringify(dataTimeout)})`);
    }
    if (timeoutDuration < 2800 || timeoutDuration > 3900) {
      throw new Error(`Test 6B Failed: expected timeout around 3000ms, but took ${timeoutDuration}ms`);
    }
    if (JSON.stringify(dataTimeout).includes('mock_token_for_testing_123') || JSON.stringify(dataTimeout).includes(redisPort.toString())) {
      throw new Error('Test 6B Failed: internal credentials or ports leaked in error response');
    }
    console.log(`  PASS: Request timed out at ${timeoutDuration}ms (< 4500ms delay), aborted cleanly and returned HTTP 503 fail-closed.\n`);

    // ==========================================
    // TEST 7: Audio formats and response compatibility
    // ==========================================
    console.log('--- TEST 7: Audio formats and response compatibility ---');
    mockRedisFailMode = false; // Restore Redis

    // Test JSON/Base64 payload
    console.log('  Submitting valid JSON base64 audio payload...');
    const base64Audio = testWavBuffer.toString('base64');
    const resJsonAudio = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-forwarded-for': '198.51.100.77',
      },
      body: JSON.stringify({
        audio: `data:audio/wav;base64,${base64Audio}`,
        mimeType: 'audio/wav',
      }),
    });

    console.log(`  JSON base64 status: ${resJsonAudio.status}`);
    const dataJsonAudio = await resJsonAudio.json();
    console.log(`  JSON base64 response code: ${dataJsonAudio.code || 'transcript'}`);
    if (resJsonAudio.status !== 200 && resJsonAudio.status !== 422 && resJsonAudio.status !== 502) {
      throw new Error(`Test 7 Failed: JSON audio rejected with unexpected status ${resJsonAudio.status}`);
    }

    // Test invalid audio magic bytes
    console.log('  Submitting corrupted audio with invalid magic bytes...');
    const corruptedBuffer = Buffer.from('NOT_A_REAL_AUDIO_FILE_DATA_PADDING_LONG_ENOUGH_TO_PASS_MIN_LENGTH_CHECK_1234567890');
    const resCorrupt = await fetch(`http://127.0.0.1:${nextPort}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/webm',
        'x-vercel-forwarded-for': '198.51.100.88',
      },
      body: corruptedBuffer,
    });

    console.log(`  Corrupted audio status: ${resCorrupt.status}`);
    const dataCorrupt = await resCorrupt.json();
    console.log(`  Corrupted audio code: ${dataCorrupt.code}`);
    if (resCorrupt.status !== 400 || dataCorrupt.code !== 'invalid_audio') {
      throw new Error(`Test 7 Failed: expected HTTP 400 invalid_audio, got ${resCorrupt.status}`);
    }

    console.log('  PASS: Audio formats, JSON base64, and header validations are 100% preserved.\n');

    console.log('================================================================');
    console.log('ALL 8 SECURITY AND RATE LIMITING TESTS PASSED PERFECTLY!');
    console.log('================================================================');
  } finally {
    console.log('[Test Harness] Shutting down test processes...');
    try {
      if (process.platform === 'win32' && nextProcess.pid) {
        spawn('taskkill', ['/F', '/T', '/PID', nextProcess.pid.toString()]);
      } else {
        nextProcess.kill('SIGKILL');
      }
    } catch {}
    mockRedisServer.close();
  }
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('[Test Harness] FATAL TEST ERROR:', err);
  process.exit(1);
});
