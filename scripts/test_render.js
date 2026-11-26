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
  fs.mkdirSync(scratchDir, { recursive: true });

  const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
  const server = spawn('node', [nextBin, 'start', '-H', '0.0.0.0', '-p', '3000'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '3000' },
    stdio: 'pipe',
  });

  const readyUrl = await waitForServer(['http://localhost:3000', 'http://127.0.0.1:3000']);
  if (!readyUrl) {
    console.error('Server failed to start');
    server.kill();
    process.exit(1);
  }
  console.log('Server is UP at', readyUrl);

  const browserExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  // 1. Full page desktop screenshot (1440 x 5800)
  const fullPageOut = path.join(scratchDir, 'full_page_desktop.png');
  console.log('Capturing full page desktop...');
  execSync(
    `"${browserExe}" --headless --disable-gpu --hide-scrollbars --window-size=1440,6000 --screenshot="${fullPageOut}" ${readyUrl}`,
    { timeout: 25000 }
  );
  console.log('Full page desktop saved:', fullPageOut);

  // 2. Full page mobile screenshot (390 x 7500)
  const fullMobileOut = path.join(scratchDir, 'full_page_mobile.png');
  console.log('Capturing full page mobile...');
  execSync(
    `"${browserExe}" --headless --disable-gpu --hide-scrollbars --window-size=390,7500 --screenshot="${fullMobileOut}" ${readyUrl}`,
    { timeout: 25000 }
  );
  console.log('Full page mobile saved:', fullMobileOut);

  server.kill('SIGTERM');
  console.log('Server stopped cleanly.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
