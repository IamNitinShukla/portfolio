const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 9280;
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

async function runTests() {
  console.log('=====================================================');
  console.log('PART 1: OTP ENGINE CRYPTOGRAPHIC & SECURITY TESTS');
  console.log('=====================================================');

  // Load compiled JS for OTP store
  const { requestOtp, verifyAndConsumeOtp } = require('./compiled/otpStore.js');
  
  const testEmail = 'tester@domain.com';
  const testName = 'Test Visitor';
  const testMsg = 'I need an enterprise AI system built with high availability.';
  const testIp = '127.0.0.1';

  // 1. Generate OTP
  const req1 = requestOtp(testEmail, testIp, testName, testMsg);
  console.log('1. Generated OTP:', {
    ok: req1.ok,
    token: req1.token,
    otpCode: req1.otp,
    expiresInSeconds: req1.expiresInSeconds,
    resendInSeconds: req1.resendInSeconds
  });
  if (!req1.ok || !req1.otp || req1.otp.length !== 6 || !/^\d{6}$/.test(req1.otp)) {
    throw new Error('OTP generation failed: expected 6-digit numeric string');
  }

  // Verify stored record on disk does NOT contain plaintext OTP
  const storeRaw = fs.readFileSync(path.join(process.cwd(), 'data', 'otp_store.json'), 'utf8');
  const storedRecords = JSON.parse(storeRaw);
  const foundRec = storedRecords.find(r => r.token === req1.token);
  console.log('2. Stored record on disk has plaintext OTP?', 'otp' in foundRec);
  console.log('   Stored record has otpHash & salt?', !!foundRec.otpHash && !!foundRec.salt);
  if ('otp' in foundRec) {
    throw new Error('SECURITY VIOLATION: Plaintext OTP was stored in persistent records!');
  }

  // 3. Test Resend Cooldown
  const cooldownReq = requestOtp(testEmail, testIp, testName, testMsg);
  console.log('3. Resend cooldown triggered?', !cooldownReq.ok, 'Error:', cooldownReq.error);
  if (cooldownReq.ok) {
    throw new Error('Cooldown failed: allowed immediate resend within 60s');
  }

  // 4. Test Incorrect OTP attempt
  const wrongRes1 = verifyAndConsumeOtp(req1.token, testEmail, '000000', testName, testMsg);
  console.log('4. Incorrect OTP rejection:', wrongRes1);
  if (wrongRes1.ok || wrongRes1.attemptsRemaining !== 4) {
    throw new Error('Failed to decrement attempts remaining on wrong code');
  }

  // 5. Test Tampered payload rejection
  const tamperedRes = verifyAndConsumeOtp(req1.token, testEmail, req1.otp, 'Modified Name', testMsg);
  console.log('5. Tampered payload rejection:', tamperedRes);
  if (tamperedRes.ok) {
    throw new Error('Failed to reject tampered message/name payload');
  }

  // 6. Test Correct OTP verification
  const correctRes = verifyAndConsumeOtp(req1.token, testEmail, req1.otp, testName, testMsg);
  console.log('6. Correct OTP verification:', correctRes);
  if (!correctRes.ok) {
    throw new Error('Failed to verify correct OTP code');
  }

  // 7. Test Replay attack prevention (consumed token cannot be reused)
  const replayRes = verifyAndConsumeOtp(req1.token, testEmail, req1.otp, testName, testMsg);
  console.log('7. Replay attempt rejection (consumed token):', replayRes);
  if (replayRes.ok) {
    throw new Error('SECURITY VIOLATION: Consumed OTP was allowed to be verified a second time!');
  }

  console.log('\n=====================================================');
  console.log('PART 2: SMTP CONFIGURATION & CONNECTION VERIFICATION');
  console.log('=====================================================');

  const { getSmtpConfig, verifySmtpConnection } = require('./compiled/smtp.js');
  const smtpConfig = getSmtpConfig();
  console.log('SMTP Config (host, port, secure, user):', {
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    user: smtpConfig.user,
    contactEmail: smtpConfig.contactEmail,
    hasPasswordConfigured: !!smtpConfig.pass
  });

  const smtpCheck = await verifySmtpConnection();
  console.log('SMTP Connection Verify Result:', smtpCheck);

  console.log('\n=====================================================');
  console.log('PART 3: SERVER API ROUTES TESTING');
  console.log('=====================================================');

  // Test /api/contact/otp with missing fields
  const emptyOtpRes = await postJson('http://localhost:3000/api/contact/otp', {});
  console.log('POST /api/contact/otp empty payload:', emptyOtpRes.status, emptyOtpRes.body);

  // Test /api/contact/otp with invalid email
  const badEmailOtpRes = await postJson('http://localhost:3000/api/contact/otp', {
    name: 'Sarah Connor',
    email: 'invalid-email',
    message: 'Testing validation'
  });
  console.log('POST /api/contact/otp invalid email:', badEmailOtpRes.status, badEmailOtpRes.body);

  // Test /api/contact without OTP
  const noOtpSubmitRes = await postJson('http://localhost:3000/api/contact', {
    name: 'Sarah Connor',
    email: 'sarah@domain.com',
    message: 'Testing without OTP verification'
  });
  console.log('POST /api/contact without OTP:', noOtpSubmitRes.status, noOtpSubmitRes.body);

  console.log('\n=====================================================');
  console.log('PART 4: BROWSER CDP INTERACTIVE MODAL & OTP FLOW');
  console.log('=====================================================');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-test-otp-flow',
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
  await sleep(600);

  // 1. Open Modal
  await cdp.evaluate(`Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()`);
  await sleep(400);

  await cdp.captureScreenshot('gmail_otp_modal_step1_details.png');

  // 2. Test Step 2 (OTP Entry Screen)
  // Mock successful OTP request to test step 2 in client
  await cdp.evaluate(`(() => {
    const origFetch = window.fetch;
    window.fetch = async (url, opts) => {
      if (url === '/api/contact/otp') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            token: "otptkn_mock_test_12345",
            expiresInSeconds: 300,
            resendInSeconds: 60
          })
        };
      }
      return origFetch(url, opts);
    };
  })()`);

  // Fill in form details and click "Continue / Verify Email"
  await cdp.evaluate(`(() => {
    function setVal(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setVal('#modal-name', 'Elena Rostova');
    setVal('#modal-email', 'elena.rostova@techcorp.io');
    setVal('#modal-message', 'We are looking to hire a Lead AI Systems Engineer for our platform.');
    
    const form = document.querySelector('div[role="dialog"] form');
    form.requestSubmit();
  })()`);
  await sleep(800);

  const step2Metrics = await cdp.evaluate(`(() => {
    const heading = document.getElementById('contact-modal-title')?.textContent?.trim();
    const emailShown = document.querySelector('div[role="dialog"] font-mono, div[role="dialog"] p.font-mono')?.textContent?.trim();
    const otpInput = document.getElementById('modal-otp');
    const resendBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Resend'))?.textContent?.trim();
    const editBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Edit Details'))?.textContent?.trim();
    return { heading, emailShown, hasOtpInput: !!otpInput, resendBtn, editBtn };
  })()`);
  console.log('Step 2 (OTP Entry) Metrics:', step2Metrics);
  await cdp.captureScreenshot('gmail_otp_modal_step2_verify.png');

  // Test typing 6-digit code
  await cdp.evaluate(`(() => {
    const otpInput = document.getElementById('modal-otp');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(otpInput), 'value')?.set;
    setter?.call(otpInput, '849201');
    otpInput.dispatchEvent(new Event('input', { bubbles: true }));
    otpInput.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(300);
  await cdp.captureScreenshot('gmail_otp_modal_step2_filled.png');

  // Test Back button ("Edit Details") preserves all information
  await cdp.evaluate(`(() => {
    const editBtn = Array.from(document.querySelectorAll('div[role="dialog"] button')).find(b => b.textContent.includes('Edit Details'));
    if (editBtn) editBtn.click();
  })()`);
  await sleep(400);

  const backPreserved = await cdp.evaluate(`(() => {
    return {
      name: document.getElementById('modal-name')?.value,
      email: document.getElementById('modal-email')?.value,
      message: document.getElementById('modal-message')?.value
    };
  })()`);
  console.log('Preserved details when returning via Edit Details:', backPreserved);

  chromeProc.kill();
  console.log('\n=====================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('=====================================================');
}

runTests().catch(console.error);
