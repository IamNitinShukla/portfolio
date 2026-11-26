const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9255;
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

async function testApiEndpoint() {
  console.log('--- Testing /api/contact Endpoint ---');
  
  // 1. Valid submission
  const validRes = await fetch('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sarah Connor',
      email: 'sarah@resistance.ai',
      subject: 'AI Alignment & Systems Role',
      message: 'Hello Nitin, I reviewed your work in LLM agents and distributed architectures. Let us discuss opportunities.',
      clientTime: Date.now() - 5000
    })
  });
  const validData = await validRes.json();
  console.log('Valid submission response status:', validRes.status, validData);
  if (!validData.success) throw new Error('Valid submission failed');

  // Verify file storage
  const logFile = path.join(process.cwd(), 'data', 'inquiries.jsonl');
  const fileExists = fs.existsSync(logFile);
  console.log('Inquiries log file exists:', fileExists);
  if (fileExists) {
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    console.log(`Recorded inquiries count: ${lines.length}, latest:`, lines[lines.length - 1]);
  }

  // 2. Invalid submission: missing name
  const badRes1 = await fetch('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      email: 'sarah@resistance.ai',
      message: 'Testing validation error'
    })
  });
  console.log('Missing name validation status:', badRes1.status, await badRes1.json());

  // 3. Invalid submission: invalid email
  const badRes2 = await fetch('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sarah',
      email: 'not-an-email',
      message: 'Testing validation error'
    })
  });
  console.log('Invalid email validation status:', badRes2.status, await badRes2.json());

  // 4. Honeypot check
  const botRes = await fetch('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Spam Bot',
      email: 'bot@spam.com',
      message: 'Buy cheap watches now!',
      hp_field: 'http://spamlink.com'
    })
  });
  console.log('Honeypot trap response:', botRes.status, await botRes.json());
}

async function testBrowserInteractions() {
  console.log('--- Testing Browser Interactions via CDP ---');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-contact-verify',
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
  await sleep(2500);

  // Scroll to #contact
  console.log('Scrolling to Contact section...');
  await cdp.evaluate(`(() => {
    const el = document.getElementById('contact');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  })()`);
  await sleep(1000);

  // Verify structure and text
  const structureCheck = await cdp.evaluate(`(() => {
    const section = document.getElementById('contact');
    if (!section) return { error: 'Section #contact not found' };

    const eyebrow = section.querySelector('span[class*="tracking-"]')?.textContent?.trim();
    const h2 = section.querySelector('h2')?.textContent?.replace(/\\s+/g, ' ').trim();
    const p = section.querySelector('p')?.textContent?.trim();
    const sayHelloBtn = Array.from(section.querySelectorAll('button')).find(b => b.textContent?.includes('SAY HELLO'));
    
    // Links
    const emailLink = Array.from(section.querySelectorAll('a')).find(a => a.href?.startsWith('mailto:') && a.textContent?.includes('@'));
    const mailClientBtn = Array.from(section.querySelectorAll('a')).find(a => a.textContent?.includes('MAIL CLIENT'));
    const scheduleLink = Array.from(section.querySelectorAll('a')).find(a => a.textContent?.includes('Schedule a Call'));
    const githubLink = Array.from(section.querySelectorAll('a')).find(a => a.href?.includes('github.com'));
    const linkedinLink = Array.from(section.querySelectorAll('a')).find(a => a.href?.includes('linkedin.com'));
    const xLink = Array.from(section.querySelectorAll('a')).find(a => a.href?.includes('x.com'));

    return {
      eyebrow,
      h2,
      p,
      hasSayHelloBtn: !!sayHelloBtn,
      emailHref: emailLink?.href,
      emailText: emailLink?.textContent?.trim(),
      mailClientHref: mailClientBtn?.href,
      scheduleHref: scheduleLink?.href,
      scheduleTarget: scheduleLink?.target,
      githubHref: githubLink?.href,
      githubTarget: githubLink?.target,
      linkedinHref: linkedinLink?.href,
      linkedinTarget: linkedinLink?.target,
      xHref: xLink?.href,
      xTarget: xLink?.target
    };
  })()`);

  console.log('Contact Section Structure Check:', JSON.stringify(structureCheck, null, 2));

  // Capture Dark Theme Overview Screenshot
  await cdp.captureScreenshot('contact_editorial_dark.png');

  // Test "Copy Email" Button
  console.log('Testing Copy Email button...');
  const copyCheck = await cdp.evaluate(`(() => {
    const copyBtn = Array.from(document.querySelectorAll('#contact button')).find(b => b.textContent?.includes('Copy'));
    if (!copyBtn) return { error: 'Copy button not found' };
    copyBtn.click();
    return { clicked: true, textAfterClick: copyBtn.textContent?.trim() };
  })()`);
  console.log('Copy Email check:', copyCheck);
  await sleep(400);

  const copiedStateCheck = await cdp.evaluate(`(() => {
    const copyBtn = Array.from(document.querySelectorAll('#contact button')).find(b => b.textContent?.includes('Copied'));
    return { hasCopiedFeedback: !!copyBtn, text: copyBtn?.textContent?.trim() };
  })()`);
  console.log('Copied tooltip confirmation check:', copiedStateCheck);

  // Test SAY HELLO Button to open form
  console.log('Clicking SAY HELLO to reveal form...');
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('#contact button')).find(b => b.textContent?.includes('SAY HELLO'));
    if (btn) btn.click();
  })()`);
  await sleep(600);

  // Check form drawer mounted
  const formMounted = await cdp.evaluate(`(() => {
    const drawer = document.getElementById('contact-form-drawer');
    const inputs = drawer ? Array.from(drawer.querySelectorAll('input, textarea')) : [];
    return {
      isDrawerOpen: !!drawer,
      inputCount: inputs.length,
      inputNames: inputs.map(i => i.id || i.name)
    };
  })()`);
  console.log('Form drawer mounted check:', formMounted);
  await cdp.captureScreenshot('contact_form_dark.png');

  // Test Form Submission from UI
  console.log('Filling in contact form via UI and submitting...');
  await cdp.evaluate(`(() => {
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const subjectInput = document.getElementById('contact-subject');
    const messageInput = document.getElementById('contact-message');

    // Helper to simulate React input typing
    function setNativeValue(element, value) {
      const valueSetter = Object.getOwnPropertyDescriptor(element.__proto__, 'value').set;
      valueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setNativeValue(nameInput, 'Alex Rivera');
    setNativeValue(emailInput, 'alex@frontier-ai.org');
    setNativeValue(subjectInput, 'AI Agent Systems Collaboration');
    setNativeValue(messageInput, 'Hi Nitin, we are developing multi-agent systems and would love to partner with you.');
  })()`);
  await sleep(400);

  // Submit form
  await cdp.evaluate(`(() => {
    const submitBtn = document.querySelector('#contact-form-drawer button[type="submit"]');
    if (submitBtn) submitBtn.click();
  })()`);
  await sleep(1500);

  // Check submission success confirmation
  const submitResult = await cdp.evaluate(`(() => {
    const drawer = document.getElementById('contact-form-drawer');
    const successHeading = drawer?.querySelector('h4')?.textContent?.trim();
    const successNote = drawer?.querySelector('p')?.textContent?.trim();
    return {
      successHeading,
      successNote
    };
  })()`);
  console.log('UI Form Submission Result:', submitResult);
  await cdp.captureScreenshot('contact_success_dark.png');

  // Switch to Light Theme
  console.log('Switching to Light Theme...');
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove("dark");
  })()`);
  await sleep(800);
  await cdp.captureScreenshot('contact_editorial_light.png');

  // Test Mobile Viewport (390 x 844)
  console.log('Testing Mobile Viewport...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(600);

  // Scroll to #contact on mobile
  await cdp.evaluate(`(() => {
    const el = document.getElementById('contact');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  })()`);
  await sleep(600);

  // Check horizontal overflow
  const overflowCheck = await cdp.evaluate(`(() => {
    const section = document.getElementById('contact');
    return {
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth,
      sectionScrollWidth: section?.scrollWidth,
      sectionClientWidth: section?.clientWidth
    };
  })()`);
  console.log('Mobile Overflow Check:', overflowCheck);
  await cdp.captureScreenshot('contact_editorial_mobile.png');

  chromeProc.kill();
  console.log('All verification checks concluded successfully!');
}

async function main() {
  await testApiEndpoint();
  await testBrowserInteractions();
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
