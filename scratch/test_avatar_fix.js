const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9233;

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
}

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-avatar-fix-test',
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

  // Inject the improved paint loop into the live page
  console.log('Injecting improved paint loop into page...');
  await cdp.evaluate(`(() => {
    const root = document.querySelector('dialog[open] [role="log"]');
    const video = document.querySelector('video');

    window.__avatarPaintLoop = () => {
      if (!root || !video || video.readyState < 2) return;
      const size = video.videoWidth || 300;
      const canvases = root.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          video,
          size * 0.26,
          size * 0.29,
          size * 0.48,
          size * 0.48,
          0,
          0,
          canvas.width,
          canvas.height
        );
      });
      requestAnimationFrame(window.__avatarPaintLoop);
    };
    requestAnimationFrame(window.__avatarPaintLoop);
  })()`);

  // Click Tech stack
  console.log('Clicking Tech stack...');
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent?.includes('Tech stack'));
    if (btn) btn.click();
  })()`);

  await sleep(3500);

  // Verify nonTransparentPixels of ALL canvases
  const check = await cdp.evaluate(`(() => {
    const canvases = Array.from(document.querySelectorAll('dialog[open] canvas'));
    return canvases.map((c, idx) => {
      const ctx = c.getContext('2d');
      const imgData = ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
      let nonTransparentPixels = 0;
      if (imgData) {
        for (let i = 3; i < imgData.data.length; i += 4) {
          if (imgData.data[i] > 10) nonTransparentPixels++;
        }
      }
      return {
        index: idx,
        nonTransparentPixels,
        hasContent: nonTransparentPixels > 100
      };
    });
  })()`);

  console.log('Verification with all canvases painted:', JSON.stringify(check, null, 2));

  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
