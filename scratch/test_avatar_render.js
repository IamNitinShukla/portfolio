const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9232;
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

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-avatar-diagnose',
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

  // Switch to dark mode
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(500);

  // Diagnose current canvas status
  const canvasStatus = await cdp.evaluate(`(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const video = document.querySelector('video');
    return {
      canvasCount: canvases.length,
      canvases: canvases.map(c => {
        const ctx = c.getContext('2d');
        const imgData = ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
        let nonTransparentPixels = 0;
        if (imgData) {
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10) nonTransparentPixels++;
          }
        }
        const rect = c.getBoundingClientRect();
        return {
          width: c.width,
          height: c.height,
          renderedWidth: rect.width,
          renderedHeight: rect.height,
          nonTransparentPixels,
          hasContent: nonTransparentPixels > 100
        };
      }),
      bgVideo: video ? {
        src: video.src || video.currentSrc,
        paused: video.paused,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      } : 'No video found'
    };
  })()`);

  console.log('Current Canvas Status on Open:', JSON.stringify(canvasStatus, null, 2));

  // Now send a question and check canvas again
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent?.includes('Tech stack'));
    if (btn) btn.click();
  })()`);

  await sleep(3500);

  const canvasStatusAfterMessage = await cdp.evaluate(`(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const video = document.querySelector('video');
    return {
      canvasCount: canvases.length,
      canvases: canvases.map((c, idx) => {
        const ctx = c.getContext('2d');
        const imgData = ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
        let nonTransparentPixels = 0;
        if (imgData) {
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10) nonTransparentPixels++;
          }
        }
        const rect = c.getBoundingClientRect();
        return {
          index: idx,
          width: c.width,
          height: c.height,
          renderedWidth: rect.width,
          renderedHeight: rect.height,
          nonTransparentPixels,
          hasContent: nonTransparentPixels > 100
        };
      }),
      bgVideo: video ? {
        src: video.src || video.currentSrc,
        paused: video.paused,
        readyState: video.readyState,
        videoWidth: video.videoWidth
      } : 'No video found'
    };
  })()`);

  console.log('Canvas Status After Message:', JSON.stringify(canvasStatusAfterMessage, null, 2));

  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
