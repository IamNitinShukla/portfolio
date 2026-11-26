const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9280;
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
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-nav-redesign-test',
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

  // Skip intro
  await cdp.evaluate(`(() => {
    const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Skip Intro'));
    if (skipBtn) skipBtn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.documentElement.classList.add('dark');
  })()`);
  await sleep(1500);

  // 1. TOP-OF-PAGE (UNSCROLLED) STATE CHECK
  console.log('--- 1. Testing Top of Page Navigation ---');
  await cdp.evaluate(`window.scrollTo(0, 0);`);
  await sleep(500);

  const topState = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const links = Array.from(header.querySelectorAll('nav a')).map(a => a.textContent?.trim());
    const hasPhilosophy = links.some(l => l.toLowerCase() === 'philosophy');
    const hasThemeToggle = !!header.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    const hasTerminalBtn = !!Array.from(header.querySelectorAll('button')).find(b => b.textContent?.includes('⌘K') || b.title?.includes('Command Palette'));
    const hasResume = !!Array.from(header.querySelectorAll('a')).find(a => a.textContent?.includes('Resume'));
    const hasTalk = !!Array.from(header.querySelectorAll('a')).find(a => a.textContent?.includes("Let's Talk"));
    const rect = header.querySelector('div').getBoundingClientRect();

    return {
      links,
      hasPhilosophy,
      hasThemeToggle,
      hasTerminalBtn,
      hasResume,
      hasTalk,
      innerNavbarWidth: Math.round(rect.width),
      isFullWidth: rect.width > 900
    };
  })()`);

  console.log('Top of Page Navbar:', JSON.stringify(topState, null, 2));
  await cdp.captureScreenshot('nav_top_fullwidth_dark.png');

  // 2. SCROLLED FLOATING PILL STATE CHECK
  console.log('--- 2. Testing Scrolled Floating Pill Navigation ---');
  await cdp.evaluate(`window.scrollTo(0, 600);`);
  await sleep(800);

  const scrolledState = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const innerNav = header.querySelector('div');
    const rect = innerNav.getBoundingClientRect();
    const links = Array.from(header.querySelectorAll('nav a')).map(a => a.textContent?.trim());
    const hasPhilosophy = links.some(l => l.toLowerCase() === 'philosophy');
    const hasThemeToggle = !!header.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    const hasTerminalBtn = !!Array.from(header.querySelectorAll('button')).find(b => b.textContent?.includes('⌘K') || b.title?.includes('Command Palette'));
    const hasResume = !!Array.from(header.querySelectorAll('a')).find(a => a.textContent?.includes('Resume'));
    const hasTalk = !!Array.from(header.querySelectorAll('a')).find(a => a.textContent?.includes("Let's Talk"));
    const brand = header.querySelector('a')?.textContent?.trim();

    // Check visible text items in scrolled pill
    const allVisibleItems = [brand, ...links, hasTalk ? "LET'S TALK" : null].filter(Boolean);

    return {
      brand,
      links,
      hasPhilosophy,
      hasThemeToggle,
      hasTerminalBtn,
      hasResume,
      hasTalk,
      allVisibleItems,
      floatingWidth: Math.round(rect.width),
      floatingHeight: Math.round(rect.height),
      isCompactPill: rect.width < 900,
      classes: innerNav.className
    };
  })()`);

  console.log('Scrolled Floating Pill Navbar:', JSON.stringify(scrolledState, null, 2));
  await cdp.captureScreenshot('nav_scrolled_floating_pill_dark.png');

  // 3. TEST SCROLLING TO SECTIONS & ACTIVE HIGHLIGHT
  console.log('--- 3. Testing Section Navigation ---');
  await cdp.evaluate(`document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' });`);
  await sleep(600);

  const skillsActiveCheck = await cdp.evaluate(`(() => {
    const nav = document.querySelector('header nav');
    const skillsLink = Array.from(nav.querySelectorAll('a')).find(a => a.textContent?.includes('Skills'));
    return {
      skillsLinkText: skillsLink?.textContent?.trim(),
      isActive: skillsLink?.className?.includes('font-bold') || skillsLink?.className?.includes('text-accent')
    };
  })()`);
  console.log('Skills active state check:', skillsActiveCheck);

  // 4. TEST SCROLLING BACK TO TOP
  console.log('--- 4. Testing Return to Top Restoration ---');
  await cdp.evaluate(`window.scrollTo(0, 0);`);
  await sleep(600);

  const restoredTopCheck = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const hasThemeToggle = !!header.querySelector('button[aria-label*="theme" i], button[title*="theme" i]');
    const hasResume = !!Array.from(header.querySelectorAll('a')).find(a => a.textContent?.includes('Resume'));
    return {
      restoredControls: hasThemeToggle && hasResume
    };
  })()`);
  console.log('Restoration to top full navbar:', restoredTopCheck);

  // 5. TEST LIGHT THEME
  console.log('--- 5. Testing Light Theme Floating Pill ---');
  await cdp.evaluate(`(() => {
    localStorage.setItem("portfolio-theme", "light");
    document.documentElement.classList.remove('dark');
  })()`);
  await sleep(600);

  // Scroll to test light theme floating pill
  await cdp.evaluate(`window.scrollTo(0, 500);`);
  await sleep(600);
  await cdp.captureScreenshot('nav_scrolled_floating_pill_light.png');

  // 6. TEST MOBILE VIEWPORT (390 x 844)
  console.log('--- 6. Testing Mobile Viewport ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(600);

  // Scrolled mobile pill
  await cdp.evaluate(`window.scrollTo(0, 400);`);
  await sleep(600);

  const mobilePillCheck = await cdp.evaluate(`(() => {
    const header = document.querySelector('header');
    const inner = header.querySelector('div');
    const rect = inner.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
      hasOverflow: document.body.scrollWidth > window.innerWidth
    };
  })()`);
  console.log('Mobile Scrolled Pill Check:', mobilePillCheck);
  await cdp.captureScreenshot('nav_mobile_scrolled.png');

  // Open mobile drawer
  console.log('Opening mobile drawer...');
  await cdp.evaluate(`(() => {
    const hamburger = document.querySelector('header button[aria-label*="navigation menu" i]');
    if (hamburger) hamburger.click();
  })()`);
  await sleep(600);

  const mobileDrawerCheck = await cdp.evaluate(`(() => {
    const drawer = document.querySelector('div[role="dialog"][aria-label*="Mobile navigation drawer"]');
    const links = drawer ? Array.from(drawer.querySelectorAll('div a')).map(a => a.textContent?.trim()) : [];
    const hasPhilosophy = links.some(l => l.toLowerCase() === 'philosophy');
    return {
      drawerMounted: !!drawer,
      links,
      hasPhilosophy
    };
  })()`);
  console.log('Mobile Drawer Menu Check:', mobileDrawerCheck);
  await cdp.captureScreenshot('nav_mobile_drawer.png');

  chromeProc.kill();
  console.log('Navigation verification concluded successfully!');
}

run().catch(console.error);
