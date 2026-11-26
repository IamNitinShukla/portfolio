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
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-verify-refined-nav',
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

  // Dismiss intro if showing
  await cdp.evaluate(`(() => {
    const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Skip Intro"));
    if (b) b.click();
    document.documentElement.classList.add("dark");
  })()`);
  await sleep(800);

  // --- STATE 1: TOP OF PAGE (scrollY = 0) ---
  await cdp.evaluate(`window.scrollTo(0, 0)`);
  await sleep(500);

  const topState = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const inner = header?.firstElementChild;
    const nav = header?.querySelector('nav');
    const links = Array.from(nav?.querySelectorAll('a') || []).map(a => a.textContent.trim());
    const hasUnderline = !!header?.querySelector('nav span[class*="rounded-full"], nav span[class*="bg-accent"]');
    const hasThemeToggle = !!header?.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    const hasTerminal = !!header?.querySelector('button[aria-label*="Command Palette" i]');
    const hasResume = !!Array.from(header?.querySelectorAll('a') || []).find(a => a.textContent.includes('Resume'));
    const brand = header?.querySelector('a[href="#hero"]')?.textContent?.trim();
    const rect = inner?.getBoundingClientRect();

    return {
      brand,
      links,
      hasSkills: links.includes('Skills'),
      hasUnderline,
      hasThemeToggle,
      hasTerminal,
      hasResume,
      width: rect?.width,
      height: rect?.height,
      top: rect?.top
    };
  })()`);

  console.log('Top State:', JSON.stringify(topState, null, 2));
  await cdp.captureScreenshot('refined_nav_top_dark.png');

  // --- STATE 2: SCROLLED DOWN (scrollY = 350) ---
  await cdp.evaluate(`window.scrollTo(0, 350)`);
  await sleep(600); // Allow Framer Motion transition to settle

  const scrolledState = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const inner = header?.firstElementChild;
    const nav = header?.querySelector('nav');
    const links = Array.from(nav?.querySelectorAll('a') || []).map(a => a.textContent.trim());
    const hasUnderline = !!header?.querySelector('nav span');
    const hasThemeToggle = !!header?.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    const hasTerminal = !!header?.querySelector('button[aria-label*="Command Palette" i]');
    const hasResume = !!Array.from(header?.querySelectorAll('a') || []).find(a => a.textContent.includes('Resume'));
    const brand = header?.querySelector('a[href="#hero"]')?.textContent?.trim();
    const letsTalk = Array.from(header?.querySelectorAll('a') || []).find(a => a.textContent.includes("Let's Talk"))?.textContent?.trim();
    const rect = inner?.getBoundingClientRect();

    return {
      brand,
      links,
      hasSkills: links.includes('Skills'),
      hasUnderline,
      hasThemeToggle,
      hasTerminal,
      hasResume,
      letsTalk,
      width: rect?.width,
      height: rect?.height,
      top: rect?.top,
      isCentered: Math.abs((window.innerWidth - (rect?.left * 2 + rect?.width))) < 5
    };
  })()`);

  console.log('Scrolled State:', JSON.stringify(scrolledState, null, 2));
  await cdp.captureScreenshot('refined_nav_scrolled_dark.png');

  // --- STATE 3: SCROLLED IN LIGHT THEME ---
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove("dark");
  })()`);
  await sleep(500);
  await cdp.captureScreenshot('refined_nav_scrolled_light.png');

  // Switch back to dark mode
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "dark");
    document.documentElement.classList.add("dark");
  })()`);
  await sleep(300);

  // --- STATE 4: SCROLL BACK TO TOP ---
  await cdp.evaluate(`window.scrollTo(0, 0)`);
  await sleep(600); // Allow Framer Motion transition to settle

  const returnTopState = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const inner = header?.firstElementChild;
    const nav = header?.querySelector('nav');
    const links = Array.from(nav?.querySelectorAll('a') || []).map(a => a.textContent.trim());
    const rect = inner?.getBoundingClientRect();

    return {
      links,
      hasSkills: links.includes('Skills'),
      width: rect?.width
    };
  })()`);

  console.log('Return to Top State:', JSON.stringify(returnTopState, null, 2));
  await cdp.captureScreenshot('refined_nav_return_top_dark.png');

  // --- STATE 5: MOBILE VIEWPORT (390x844) ---
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(400);

  await cdp.evaluate(`window.scrollTo(0, 300)`);
  await sleep(500);

  const mobileScrolled = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const inner = header?.firstElementChild;
    const rect = inner?.getBoundingClientRect();
    const hasOverflow = document.body.scrollWidth > window.innerWidth;
    return {
      width: rect?.width,
      hasOverflow,
      windowWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth
    };
  })()`);

  console.log('Mobile Scrolled:', JSON.stringify(mobileScrolled, null, 2));
  await cdp.captureScreenshot('refined_nav_mobile_scrolled.png');

  // Open mobile menu drawer
  await cdp.evaluate(`(() => {
    const menuBtn = Array.from(document.querySelectorAll('header button')).find(b => b.getAttribute('aria-label')?.includes('navigation menu'));
    if (menuBtn) menuBtn.click();
  })()`);
  await sleep(400);

  const mobileDrawer = await cdp.evaluate(`(() => {
    const drawer = document.querySelector('div[role="dialog"]');
    const links = Array.from(drawer?.querySelectorAll('a') || []).map(a => a.textContent.trim());
    return {
      isOpen: !!drawer,
      links
    };
  })()`);

  console.log('Mobile Drawer:', JSON.stringify(mobileDrawer, null, 2));
  await cdp.captureScreenshot('refined_nav_mobile_drawer.png');

  chromeProc.kill();
  console.log('Verification completed successfully!');
}

run().catch(console.error);
