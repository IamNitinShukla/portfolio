const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9265;
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
    if (r.exceptionDetails) {
      console.error('Evaluate Exception:', JSON.stringify(r.exceptionDetails));
    }
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
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-exact-ref-test',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
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

  // Set dark theme & bypass intro
  await cdp.evaluate(`(() => {
    try {
      localStorage.setItem("portfolio-theme", "dark");
      sessionStorage.setItem("portfolio_intro_seen", "true");
    } catch(e) {}
  })()`);

  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1500);

  // Click "Skip Intro" button or press Escape if intro is showing
  await cdp.evaluate(`(() => {
    try {
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
    } catch(e) {}
    const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Skip Intro'));
    if (skipBtn) skipBtn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  })()`);
  await sleep(1500);

  // Ensure dark mode class is on documentElement
  await cdp.evaluate(`(() => {
    document.documentElement.classList.add('dark');
  })()`);
  await sleep(500);

  // Scroll to #contact
  await cdp.evaluate(`document.getElementById('contact')?.scrollIntoView({ behavior: 'instant', block: 'start' });`);
  await sleep(1000);

  // Inspect structure
  const structure = await cdp.evaluate(`(() => {
    const sec = document.getElementById('contact');
    if (!sec) return { error: 'Not found' };
    const p1 = sec.querySelector('p')?.textContent?.trim();
    const h2 = sec.querySelector('h2')?.textContent?.replace(/\\s+/g, ' ').trim();
    const p2 = sec.querySelectorAll('p')[1]?.textContent?.trim();
    const buttons = Array.from(sec.querySelectorAll('button')).map(b => b.textContent?.trim());
    const bottomLinks = Array.from(sec.querySelectorAll('.max-w-4xl a')).map(a => ({
      text: a.textContent?.trim(),
      href: a.href
    }));
    return {
      eyebrow: p1,
      headline: h2,
      description: p2,
      buttons,
      bottomLinks
    };
  })()`);

  console.log('Structure inspection:', JSON.stringify(structure, null, 2));

  // Capture pristine exact reference screenshot
  await cdp.captureScreenshot('contact_exact_reference_dark.png');

  // Test form open
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('#contact button')).find(b => b.textContent?.includes('SAY HELLO'));
    if (btn) btn.click();
  })()`);
  await sleep(500);
  await cdp.captureScreenshot('contact_exact_form_dark.png');

  // Close form
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('#contact button')).find(b => b.textContent?.includes('CLOSE FORM'));
    if (btn) btn.click();
  })()`);
  await sleep(400);

  // Light theme
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove("dark");
  })()`);
  await sleep(600);
  await cdp.captureScreenshot('contact_exact_reference_light.png');

  // Mobile viewport (390px)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(500);
  await cdp.evaluate(`document.getElementById('contact')?.scrollIntoView({ behavior: 'instant', block: 'start' });`);
  await sleep(500);
  await cdp.captureScreenshot('contact_exact_reference_mobile.png');

  chromeProc.kill();
  console.log('Verification finished successfully!');
}

run().catch(console.error);
