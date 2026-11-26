const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testStyles() {
  const scratchDir = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';
  const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
  const server = spawn('node', [nextBin, 'start', '-H', '127.0.0.1', '-p', '3000'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
  });

  // wait 2s
  await new Promise(r => setTimeout(r, 2000));

  const res = await fetch('http://127.0.0.1:3000');
  const html = await res.text();
  console.log('HTML length:', html.length);
  console.log('H1 in HTML:', html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0]);

  // Take screenshot with 1.5s delay inside page so animations finish
  const browserExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const outPath = path.join(scratchDir, 'render_settled.png');
  execSync(`"${browserExe}" --headless --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=2000 --window-size=1440,2000 --screenshot="${outPath}" http://127.0.0.1:3000`);
  console.log('Saved settled render to', outPath);

  server.kill();
}

testStyles();
