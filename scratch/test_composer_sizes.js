const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9226;
const ARTIFACT_DIR = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (err) => reject(err));
      this.ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { res, rej });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return r.result?.value;
  }

  async captureScreenshot(filename, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const r = await this.send('Page.captureScreenshot', params);
    const buffer = Buffer.from(r.data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`[Screenshot saved] ${fullPath}`);
    return fullPath;
  }
}

async function run() {
  console.log('Spawning headless Chrome...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-btn-sizes-test',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,850',
    'http://localhost:3000'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch {}
  }

  if (!targets || targets.length === 0) {
    console.error('Failed to connect to Chrome debug port');
    chromeProc.kill();
    return;
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1500);

  // Bypass intro
  await cdp.evaluate(`sessionStorage.setItem("portfolio_intro_seen", "true");`);
  await cdp.evaluate(`location.reload();`);
  await sleep(2500);

  // Open Friday Assistant Dialog
  await cdp.evaluate(`
    document.querySelector('[data-testid="mascot-assistant-trigger"]').click();
  `);
  await sleep(1000);

  // Let's get composer rect for clipping
  const composerClip = await cdp.evaluate(`(() => {
    const composer = document.querySelector('form');
    if (!composer) return null;
    const r = composer.getBoundingClientRect();
    return {
      x: Math.max(0, r.x - 20),
      y: Math.max(0, r.y - 10),
      width: r.width + 40,
      height: r.height + 20,
      scale: 1
    };
  })()`);

  console.log('Composer clip bounds:', composerClip);

  // 1. Current state screenshot
  await cdp.captureScreenshot('compare_current_voice_btn.png', composerClip);

  // 2. Test 32px matching sendBtn
  await cdp.evaluate(`(() => {
    const voiceBtn = document.querySelector('button[aria-label*="Voice Mode" i]');
    if (voiceBtn) {
      voiceBtn.style.setProperty('width', '32px', 'important');
      voiceBtn.style.setProperty('height', '32px', 'important');
      voiceBtn.style.setProperty('min-width', '32px', 'important');
      voiceBtn.style.setProperty('min-height', '32px', 'important');
      voiceBtn.style.setProperty('box-shadow', '0 2px 8px rgba(239, 68, 68, 0.35)', 'important');
      const svg = voiceBtn.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
      }
    }
  })()`);
  await sleep(300);
  await cdp.captureScreenshot('compare_32px_voice_btn.png', composerClip);

  // 3. Test 44px with softer glow
  await cdp.evaluate(`(() => {
    const voiceBtn = document.querySelector('button[aria-label*="Voice Mode" i]');
    if (voiceBtn) {
      voiceBtn.style.setProperty('width', '44px', 'important');
      voiceBtn.style.setProperty('height', '44px', 'important');
      voiceBtn.style.setProperty('min-width', '44px', 'important');
      voiceBtn.style.setProperty('min-height', '44px', 'important');
      voiceBtn.style.setProperty('box-shadow', '0 2px 8px rgba(239, 68, 68, 0.25)', 'important');
      const svg = voiceBtn.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
      }
    }
  })()`);
  await sleep(300);
  await cdp.captureScreenshot('compare_44px_voice_btn.png', composerClip);

  console.log('Comparison screenshots taken!');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
