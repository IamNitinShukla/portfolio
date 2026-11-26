const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9230;
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
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-full-answer',
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

  // Switch to Dark mode
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(500);

  // Click quick-topic: "Tech stack"
  console.log('Clicking "Tech stack" quick action...');
  await cdp.evaluate(`(() => {
    const techBtn = Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent?.includes('Tech stack'));
    if (techBtn) techBtn.click();
  })()`);

  // Wait for streaming response to complete
  console.log('Waiting for complete response...');
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const state = await cdp.evaluate(`(() => {
      const msgs = document.querySelectorAll('dialog[open] [class*="bubble"]');
      const cursor = document.querySelector('dialog[open] [class*="cursor"]');
      const lastMsg = msgs[msgs.length - 1];
      return {
        count: msgs.length,
        isStreaming: Boolean(cursor),
        lastMsgLength: lastMsg ? lastMsg.textContent.length : 0
      };
    })()`);
    if (state.count >= 3 && !state.isStreaming && state.lastMsgLength > 80) {
      console.log('Full answer received! Length:', state.lastMsgLength);
      break;
    }
  }

  await sleep(1000);
  await cdp.captureScreenshot('friday_full_answer_dark.png');

  // Switch to Light mode
  console.log('Switching to Light mode...');
  await cdp.evaluate(`document.documentElement.classList.remove('dark');`);
  await sleep(600);
  await cdp.captureScreenshot('friday_full_answer_light.png');

  console.log('Full answer screenshots captured!');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
