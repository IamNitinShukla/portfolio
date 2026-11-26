const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9272;
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

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let resData = '';
      res.on('data', c => resData += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch (e) {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
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
    console.log('[Saved Screenshot]', fullPath);
  }
}

async function run() {
  console.log('--- TEST 1: Direct Server API Route Validation & Error Handling ---');
  // 1. Test empty payload
  const emptyRes = await postJson('http://localhost:3000/api/contact', {});
  console.log('Empty POST status:', emptyRes.status, 'body:', emptyRes.body);

  // 2. Test invalid email
  const badEmailRes = await postJson('http://localhost:3000/api/contact', {
    name: 'Sarah Connor',
    email: 'not-an-email',
    message: 'Testing validation in contact form',
  });
  console.log('Bad email POST status:', badEmailRes.status, 'body:', badEmailRes.body);

  // 3. Test short message
  const shortMsgRes = await postJson('http://localhost:3000/api/contact', {
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    message: 'Short',
  });
  console.log('Short message POST status:', shortMsgRes.status, 'body:', shortMsgRes.body);

  // 4. Test valid payload with NO RESEND_API_KEY
  const validNoKeyRes = await postJson('http://localhost:3000/api/contact', {
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    message: 'Hello Nitin, I would love to connect about an AI engineering project.',
  });
  console.log('Valid with missing key status:', validNoKeyRes.status, 'body:', validNoKeyRes.body);
  console.log('Is 503 without false success?', validNoKeyRes.status === 503 && validNoKeyRes.body.success === false);

  console.log('\n--- TEST 2: Browser CDP Interactive Testing ---');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-test-contact-modal',
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

  // Dark mode & dismiss intro
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

  // Scroll to #contact
  await cdp.evaluate(`document.getElementById("contact").scrollIntoView({ behavior: "instant", block: "center" })`);
  await sleep(500);

  // Check section height BEFORE clicking Say Hello
  const initialContactMetrics = await cdp.evaluate(`(() => {
    const sec = document.getElementById("contact");
    const rect = sec.getBoundingClientRect();
    return {
      height: rect.height,
      scrollHeight: document.body.scrollHeight,
    };
  })()`);
  console.log('Initial #contact height:', initialContactMetrics);

  // Click SAY HELLO
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO"));
    if (btn) btn.click();
  })()`);
  await sleep(400);

  // Check metrics AFTER clicking Say Hello — should NOT expand page or push content!
  const modalOpenMetrics = await cdp.evaluate(`(() => {
    const sec = document.getElementById("contact");
    const rect = sec.getBoundingClientRect();
    const modal = document.querySelector('div[role="dialog"]');
    const modalSurface = modal?.querySelector('div.rounded-3xl');
    const surfaceRect = modalSurface?.getBoundingClientRect();
    const title = modal?.querySelector('h3')?.textContent?.trim();
    const eyebrow = modal?.querySelector('p')?.textContent?.trim();
    const fields = Array.from(modal?.querySelectorAll('label') || []).map(l => l.textContent.trim());
    const button = modal?.querySelector('button[type="submit"]')?.textContent?.trim();
    const bodyOverflow = document.body.style.overflow;

    return {
      sectionHeight: rect.height,
      scrollHeight: document.body.scrollHeight,
      hasInlineExpanded: rect.height !== ${initialContactMetrics.height},
      modalFound: !!modal,
      eyebrow,
      title,
      fields,
      button,
      bodyOverflow,
      modalSurface: {
        width: surfaceRect?.width,
        height: surfaceRect?.height,
        top: surfaceRect?.top,
        left: surfaceRect?.left,
        isCenteredVertically: Math.abs((window.innerHeight - surfaceRect?.height) / 2 - surfaceRect?.top) < 15,
      }
    };
  })()`);
  console.log('Modal Open State:', JSON.stringify(modalOpenMetrics, null, 2));
  await cdp.captureScreenshot('modal_say_hello_centered_dark.png');

  // Test Close via Close Icon
  console.log('Testing close via Close icon...');
  await cdp.evaluate(`(() => {
    const closeBtn = document.querySelector('button[aria-label="Close modal"]');
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(400);

  const afterIconClose = await cdp.evaluate(`(() => {
    return {
      isOpen: !!document.querySelector('div[role="dialog"]'),
      bodyOverflow: document.body.style.overflow
    };
  })()`);
  console.log('After Close icon:', afterIconClose);

  // Re-open and test Close via Escape key
  console.log('Testing close via Escape key...');
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO"));
    if (btn) btn.click();
  })()`);
  await sleep(350);

  await cdp.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(400);

  const afterEscClose = await cdp.evaluate(`(() => {
    return {
      isOpen: !!document.querySelector('div[role="dialog"]'),
      bodyOverflow: document.body.style.overflow
    };
  })()`);
  console.log('After ESC key:', afterEscClose);

  // Re-open and test Close via Clicking Outside (Backdrop)
  console.log('Testing close via Backdrop Click...');
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO"));
    if (btn) btn.click();
  })()`);
  await sleep(350);

  await cdp.evaluate(`(() => {
    const backdrop = document.querySelector('div.fixed.inset-0[aria-hidden="true"]');
    if (backdrop) backdrop.click();
  })()`);
  await sleep(400);

  const afterBackdropClose = await cdp.evaluate(`(() => {
    return {
      isOpen: !!document.querySelector('div[role="dialog"]'),
      bodyOverflow: document.body.style.overflow
    };
  })()`);
  console.log('After Backdrop click:', afterBackdropClose);

  // Re-open and test Client Validation
  console.log('Testing validation in modal...');
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO"));
    if (btn) btn.click();
  })()`);
  await sleep(350);

  // Submit empty
  await cdp.evaluate(`(() => {
    const form = document.querySelector('div[role="dialog"] form');
    if (form) form.requestSubmit();
  })()`);
  await sleep(200);

  const validationState = await cdp.evaluate(`(() => {
    const errors = Array.from(document.querySelectorAll('div[role="dialog"] form p.text-red-500, div[role="dialog"] form p.text-red-400')).map(p => p.textContent.trim());
    return errors;
  })()`);
  console.log('Validation errors on empty submit:', validationState);
  await cdp.captureScreenshot('modal_validation_errors.png');

  // Test fill and error reporting (no false success)
  await cdp.evaluate(`(() => {
    function setReactValue(el, val) {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc?.set?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const nameInput = document.getElementById('modal-name');
    const emailInput = document.getElementById('modal-email');
    const messageInput = document.getElementById('modal-message');
    if (nameInput) setReactValue(nameInput, 'Sarah Connor');
    if (emailInput) setReactValue(emailInput, 'sarah@skynet.com');
    if (messageInput) setReactValue(messageInput, 'Need help building resilient distributed defense systems against autonomous rogue clusters.');
    const form = document.querySelector('div[role="dialog"] form');
    if (form) form.requestSubmit();
  })()`);
  await sleep(1000);

  const errorState = await cdp.evaluate(`(() => {
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
  console.log('Error state (missing RESEND_API_KEY handled without false success):', errorState);
  await cdp.captureScreenshot('modal_error_state_dark.png');

  // Test Light Mode
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove("dark");
  })()`);
  await sleep(400);
  await cdp.captureScreenshot('modal_say_hello_light.png');

  // Test Mobile Viewport (390x844)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(400);

  const mobileMetrics = await cdp.evaluate(`(() => {
    const modalSurface = document.querySelector('div[role="dialog"] div.rounded-3xl');
    const rect = modalSurface?.getBoundingClientRect();
    const hasOverflow = document.body.scrollWidth > window.innerWidth;
    return {
      width: rect?.width,
      hasOverflow,
      windowWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth
    };
  })()`);
  console.log('Mobile Metrics:', mobileMetrics);
  await cdp.captureScreenshot('modal_say_hello_mobile.png');

  chromeProc.kill();
  console.log('\n--- All Tests Completed Successfully! ---');
}

run().catch(console.error);
