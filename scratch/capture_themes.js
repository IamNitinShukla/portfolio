const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9248;
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

  async captureScreenshot(filename) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(r.data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`[Screenshot saved] ${fullPath}`);
    return fullPath;
  }
}

async function captureThemes() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-avatar-theme-snap',
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

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1000);

  // Set dark mode via portfolio-theme
  await cdp.evaluate(`(() => {
    try {
      localStorage.setItem("portfolio-theme", "dark");
      sessionStorage.setItem("portfolio_intro_seen", "true");
    } catch(e) {}
  })()`);

  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2000);

  // Open Friday Assistant Dialog
  await cdp.evaluate(`document.querySelector('[data-testid="mascot-assistant-trigger"]')?.click();`);
  await sleep(1000);

  // Send message
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent?.includes('Tech stack'));
    if (btn) btn.click();
  })()`);

  // Wait for stream to settle
  for (let i = 0; i < 25; i++) {
    await sleep(500);
    const streaming = await cdp.evaluate(`!!document.querySelector('dialog[open] [class*="cursor"]')`);
    if (!streaming) break;
  }
  await sleep(800);

  // Capture Dark Theme
  await cdp.captureScreenshot('friday_avatar_completed_dark.png');

  // Toggle Theme via theme button in navbar
  await cdp.evaluate(`(() => {
    const themeBtn = document.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    if (themeBtn) themeBtn.click();
  })()`);
  await sleep(600);

  // Capture Light Theme
  await cdp.captureScreenshot('friday_avatar_completed_light.png');

  chromeProc.kill();
  console.log('Theme capture complete!');
}

captureThemes().catch(err => {
  console.error(err);
  process.exit(1);
});
