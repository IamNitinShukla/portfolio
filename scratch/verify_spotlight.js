const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9275;
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

async function verify() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-spotlight-test',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
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

  // Set Light theme & bypass intro
  await cdp.evaluate(`(() => {
    try {
      localStorage.setItem("portfolio-theme", "light");
      sessionStorage.setItem("portfolio_intro_seen", "true");
    } catch(e) {}
  })()`);

  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1500);

  // Skip Intro if button present
  await cdp.evaluate(`(() => {
    const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Skip Intro'));
    if (skipBtn) skipBtn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.documentElement.classList.remove('dark');
  })()`);
  await sleep(1500);

  // Dispatch mouse/pointer move event at center (640, 420)
  console.log('Dispatching pointermove in Light Mode...');
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 640,
    y: 420
  });
  await sleep(600);

  // Check spotlight background in Light Mode
  const lightSpotlight = await cdp.evaluate(`(() => {
    const el = document.querySelector('div.fixed.inset-0.pointer-events-none.z-0');
    return {
      exists: !!el,
      display: el ? el.style.display : null,
      opacity: el ? el.style.opacity : null,
      background: el ? el.style.background : null
    };
  })()`);

  console.log('Light Mode Spotlight check:', JSON.stringify(lightSpotlight, null, 2));
  await cdp.captureScreenshot('spotlight_light_mode.png');

  // Switch to Dark Mode via Theme Toggle button
  console.log('Switching to Dark Mode via theme toggle button...');
  await cdp.evaluate(`(() => {
    const toggleBtn = document.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    if (toggleBtn) {
      toggleBtn.click();
    } else {
      // Fallback: trigger reload with dark in localStorage
      localStorage.setItem("portfolio-theme", "dark");
      location.reload();
    }
  })()`);
  await sleep(1000);

  // Dispatch mouse/pointer move in Dark Mode
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 640,
    y: 420
  });
  await sleep(600);

  // Check spotlight background in Dark Mode
  const darkSpotlight = await cdp.evaluate(`(() => {
    const el = document.querySelector('div.fixed.inset-0.pointer-events-none.z-0');
    return {
      exists: !!el,
      display: el ? el.style.display : null,
      opacity: el ? el.style.opacity : null,
      background: el ? el.style.background : null
    };
  })()`);

  console.log('Dark Mode Spotlight check (should be unchanged lime):', JSON.stringify(darkSpotlight, null, 2));
  await cdp.captureScreenshot('spotlight_dark_mode.png');

  chromeProc.kill();
  console.log('Spotlight verification finished successfully!');
}

verify().catch(console.error);
