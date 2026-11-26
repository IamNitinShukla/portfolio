const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9277;
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
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-test-success-modal',
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

  // Intercept fetch to return verified success to test the SUCCESS state UI
  await cdp.evaluate(`(() => {
    const origFetch = window.fetch;
    window.fetch = async (url, opts) => {
      if (url === '/api/contact') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: "Your message has been sent successfully. I'll get back to you soon.",
            inquiryDelivered: true,
            confirmationDelivered: true
          })
        };
      }
      return origFetch(url, opts);
    };
  })()`);

  // Open modal
  await cdp.evaluate(`Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()`);
  await sleep(400);

  // Fill in form and submit
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
    
    const form = document.querySelector('div[role="dialog"] form');
    form.requestSubmit();
  })()`);
  await sleep(800);

  const successState = await cdp.evaluate(`(() => {
    const title = document.querySelector('div[role="dialog"] h4')?.textContent?.trim();
    const desc = document.querySelector('div[role="dialog"] p.text-primary-muted, div[role="dialog"] p.text-xs')?.textContent?.trim();
    const doneBtn = document.querySelector('div[role="dialog"] button')?.textContent?.trim();
    return { title, desc, doneBtn };
  })()`);
  console.log('Success State Verification:', successState);
  await cdp.captureScreenshot('contact_modal_success_dark.png');

  // Test Done button closes modal
  await cdp.evaluate(`(() => {
    const doneBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Done'));
    if (doneBtn) doneBtn.click();
  })()`);
  await sleep(400);

  const afterDone = await cdp.evaluate(`!document.querySelector('div[role="dialog"]')`);
  console.log('Modal closed after Done button?', afterDone);

  chromeProc.kill();
}

run().catch(console.error);
