const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9276;
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 1; this.callbacks = new Map(); }
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
    console.log('[Saved Screenshot]', fullPath);
  }
}

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-final-verify-modal',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
    'http://localhost:3000'
  ]);
  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try { targets = await getJson('http://127.0.0.1:' + PORT + '/json/list'); if (targets && targets.length > 0) break; } catch {}
  }
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1000);

  // Set dark theme & dismiss intro
  await cdp.evaluate(`(() => {
    try {
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
      document.documentElement.classList.add("dark");
    } catch(e) {}
  })()`);
  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1500);

  await cdp.evaluate(`(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Skip Intro"));
    if (b) b.click();
    document.documentElement.classList.add("dark");
  })()`);
  await sleep(800);

  // 1. Initial State
  const initialMetrics = await cdp.evaluate(`(() => {
    const sec = document.getElementById("contact");
    const rect = sec.getBoundingClientRect();
    return { height: rect.height, bodyScroll: document.body.scrollHeight };
  })()`);

  // 2. Open Modal via SAY HELLO
  await cdp.evaluate(`Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()`);
  await sleep(400);

  const openMetrics = await cdp.evaluate(`(() => {
    const sec = document.getElementById("contact");
    const rect = sec.getBoundingClientRect();
    const modal = document.querySelector('div[role="dialog"]');
    const surface = modal?.querySelector('div.rounded-3xl');
    const sRect = surface?.getBoundingClientRect();
    return {
      modalOpen: !!modal,
      sectionHeight: rect.height,
      hasExpandedInline: rect.height !== ${initialMetrics.height},
      surfaceWidth: sRect?.width,
      surfaceHeight: sRect?.height,
      bodyOverflow: document.body.style.overflow
    };
  })()`);
  console.log('1. Modal Open Verification:', openMetrics);
  await cdp.captureScreenshot('contact_modal_verified_dark.png');

  // 3. Test Outside Click Close (CDP mouse event at top left)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 40, y: 40, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 40, y: 40, button: 'left', clickCount: 1 });
  await sleep(350);

  const afterOutsideClick = await cdp.evaluate(`({
    isOpen: !!document.querySelector('div[role="dialog"]'),
    bodyOverflow: document.body.style.overflow
  })`);
  console.log('2. Outside Click Close Verification:', afterOutsideClick);

  // 4. Test ESC Close
  await cdp.evaluate(`Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()`);
  await sleep(350);
  await cdp.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(350);

  const afterEsc = await cdp.evaluate(`({
    isOpen: !!document.querySelector('div[role="dialog"]'),
    bodyOverflow: document.body.style.overflow
  })`);
  console.log('3. Escape Key Close Verification:', afterEsc);

  // 5. Test Close Icon Close
  await cdp.evaluate(`Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()`);
  await sleep(350);
  await cdp.evaluate(`document.querySelector('button[aria-label="Close modal"]').click()`);
  await sleep(350);

  const afterCloseIcon = await cdp.evaluate(`({
    isOpen: !!document.querySelector('div[role="dialog"]'),
    bodyOverflow: document.body.style.overflow
  })`);
  console.log('4. Close Icon Verification:', afterCloseIcon);

  // 6. Test Form Validation & Error State (missing key handled gracefully)
  await cdp.evaluate(`Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()`);
  await sleep(350);

  // Fill in form using native value setters
  await cdp.evaluate(`(() => {
    function setVal(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setVal('#modal-name', 'Sarah Connor');
    setVal('#modal-email', 'sarah@skynet.com');
    setVal('#modal-message', 'Need help building resilient distributed defense systems against autonomous rogue clusters.');
    
    // Submit
    const form = document.querySelector('div[role="dialog"] form');
    form.requestSubmit();
  })()`);
  await sleep(1000);

  const formSubmissionResult = await cdp.evaluate(`(() => {
    const alertBanner = document.querySelector('div.bg-red-500\\/10');
    const alertText = alertBanner?.textContent?.trim();
    const nameVal = document.getElementById('modal-name')?.value;
    const emailVal = document.getElementById('modal-email')?.value;
    const messageVal = document.getElementById('modal-message')?.value;
    return {
      hasAlert: !!alertBanner,
      alertText,
      preservedValues: { name: nameVal, email: emailVal, message: messageVal }
    };
  })()`);
  console.log('5. Form Submission & Error Preserving Verification:', formSubmissionResult);
  await cdp.captureScreenshot('contact_modal_error_state.png');

  // 7. Light theme screenshot
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove("dark");
  })()`);
  await sleep(400);
  await cdp.captureScreenshot('contact_modal_verified_light.png');

  chromeProc.kill();
  console.log('Verification Complete!');
}

run().catch(console.error);
