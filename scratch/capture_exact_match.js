const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9268;
const ARTIFACT_DIR = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
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
      this.ws.addEventListener('error', err => reject(err));
      this.ws.addEventListener('message', event => {
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
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  }
  async captureScreenshot(filename) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(r.data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log('[Saved]', fullPath);
  }
}

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-capture-exact-match',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
    'http://localhost:3000'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      targets = await getJson('http://127.0.0.1:' + PORT + '/json/list');
      if (targets && targets.length > 0) break;
    } catch {}
  }
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1000);

  // Set dark theme & bypass intro
  await cdp.evaluate(`(() => {
    try {
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
      document.documentElement.classList.add("dark");
    } catch(e) {}
  })()`);
  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1500);

  // Dismiss intro if visible
  await cdp.evaluate(`(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Skip Intro"));
    if (b) b.click();
    document.documentElement.classList.add("dark");
  })()`);
  await sleep(600);

  // 1. Scroll to contact in dark mode
  await cdp.evaluate(`document.getElementById("contact")?.scrollIntoView({ behavior: "instant", block: "center" })`);
  await sleep(600);
  await cdp.captureScreenshot('contact_exact_reference_dark_latest.png');

  // 2. Scroll to bottom of page in dark mode
  await cdp.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(600);
  await cdp.captureScreenshot('page_bottom_latest.png');

  // 3. Light mode
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove("dark");
  })()`);
  await sleep(500);
  await cdp.evaluate(`document.getElementById("contact")?.scrollIntoView({ behavior: "instant", block: "center" })`);
  await sleep(500);
  await cdp.captureScreenshot('contact_exact_reference_light_latest.png');

  // 4. Mobile viewport (390x844)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "dark");
    document.documentElement.classList.add("dark");
  })()`);
  await sleep(500);
  await cdp.evaluate(`document.getElementById("contact")?.scrollIntoView({ behavior: "instant", block: "center" })`);
  await sleep(500);
  await cdp.captureScreenshot('contact_exact_reference_mobile_latest.png');

  chromeProc.kill();
  console.log('Capture completed successfully!');
}

run().catch(console.error);
