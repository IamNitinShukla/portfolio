const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function waitForServer(urls, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const u of urls) {
      try {
        const res = await fetch(u);
        if (res.status === 200) return u;
      } catch (e) {}
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

async function run() {
  const scratchDir = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';
  const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
  const server = spawn('node', [nextBin, 'start', '-H', '0.0.0.0', '-p', '3000'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '3000' },
    stdio: 'pipe',
  });

  const readyUrl = await waitForServer(['http://localhost:3000']);
  const browserExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  // Screenshots of individual sections
  const sections = ['skills', 'work', 'experience', 'education', 'achievements', 'contact'];
  for (const s of sections) {
    const out = path.join(scratchDir, `section_${s}.png`);
    execSync(
      `"${browserExe}" --headless --disable-gpu --window-size=1440,1100 --screenshot="${out}" "${readyUrl}#${s}"`,
      { timeout: 15000 }
    );
    console.log(`Saved section_${s}.png`);
  }

  server.kill('SIGTERM');
  console.log('All section screenshots captured!');
}

run();
