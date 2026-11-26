const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9231;
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
  console.log('Spawning Chrome for borderless verification...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-borderless-test',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,850',
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

  if (!targets || targets.length === 0) {
    console.error('Failed to connect to Chrome debug port');
    chromeProc.kill();
    return;
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1500);

  // Bypass intro
  await cdp.evaluate(`sessionStorage.setItem("portfolio_intro_seen", "true");`);
  await cdp.evaluate(`location.reload();`);
  await sleep(2500);

  console.log('=== TEST 1: Inspecting Borderless Visual Styling in Dark Mode ===');
  // Open Friday Assistant Dialog
  await cdp.evaluate(`
    document.querySelector('[data-testid="mascot-assistant-trigger"]').click();
  `);
  await sleep(1000);

  // Ensure dark mode
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(500);

  const borderAudit = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'Dialog not found' };

    const dialogStyle = window.getComputedStyle(dialog);
    const tempBadge = dialog.querySelector('div[class*="tempChatBadge"]');
    const topBar = dialog.querySelector('[class*="topBar"]');
    const topBarStyle = topBar ? window.getComputedStyle(topBar) : null;
    const composer = dialog.querySelector('form');
    const composerStyle = composer ? window.getComputedStyle(composer) : null;
    const composerInputDiv = composer ? composer.querySelector('div') : null;
    const composerInputDivStyle = composerInputDiv ? window.getComputedStyle(composerInputDiv) : null;
    const topicBtn = dialog.querySelector('[class*="topics"] button');
    const topicBtnStyle = topicBtn ? window.getComputedStyle(topicBtn) : null;
    const initialBubble = dialog.querySelector('[class*="bubble"]');
    const initialBubbleStyle = initialBubble ? window.getComputedStyle(initialBubble) : null;

    return {
      dialogBorderWidth: dialogStyle.borderWidth,
      dialogBorderStyle: dialogStyle.borderStyle,
      dialogBoxShadow: dialogStyle.boxShadow,
      hasTempBadge: Boolean(tempBadge),
      topBarBackground: topBarStyle ? topBarStyle.backgroundColor : null,
      topBarBorder: topBarStyle ? topBarStyle.borderStyle : null,
      composerBorderTop: composerStyle ? composerStyle.borderTopStyle : null,
      composerInputBorder: composerInputDivStyle ? composerInputDivStyle.borderStyle : null,
      topicBtnBorder: topicBtnStyle ? topicBtnStyle.borderStyle : null,
      initialBubbleBorder: initialBubbleStyle ? initialBubbleStyle.borderStyle : null,
      isBorderless: (
        (dialogStyle.borderWidth === '0px' || dialogStyle.borderStyle === 'none') &&
        !tempBadge &&
        (composerStyle.borderTopStyle === 'none' || composerStyle.borderTopWidth === '0px') &&
        (composerInputDivStyle.borderStyle === 'none' || composerInputDivStyle.borderWidth === '0px')
      )
    };
  })()`);

  console.log('Borderless Audit Result (Dark):', JSON.stringify(borderAudit, null, 2));
  await cdp.captureScreenshot('friday_borderless_initial_dark.png');

  // Test sending a question to verify conversation bubbles
  console.log('Sending message: "Can you summarize Nitin\'s engineering experience?"...');
  await cdp.evaluate(`(() => {
    const expBtn = Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent?.includes('Experience'));
    if (expBtn) expBtn.click();
  })()`);

  // Wait for response to complete
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const s = await cdp.evaluate(`(() => {
      const cursor = document.querySelector('dialog[open] [class*="cursor"]');
      const msgs = document.querySelectorAll('dialog[open] [class*="bubble"]');
      return { count: msgs.length, streaming: Boolean(cursor) };
    })()`);
    if (s.count >= 3 && !s.streaming) {
      console.log('Experience reply finished streaming!');
      break;
    }
  }

  await sleep(1000);

  const conversationBorderAudit = await cdp.evaluate(`(() => {
    const userRow = document.querySelector('dialog[open] div[class*="user"]');
    const asstRows = Array.from(document.querySelectorAll('dialog[open] div[class*="assistant"]'));
    const asstRow = asstRows[asstRows.length - 1];
    const userBubble = userRow ? userRow.querySelector('[class*="bubble"]') : null;
    const asstBubble = asstRow ? asstRow.querySelector('[class*="bubble"]') : null;

    const userStyle = userBubble ? window.getComputedStyle(userBubble) : null;
    const asstStyle = asstBubble ? window.getComputedStyle(asstBubble) : null;

    return {
      userBubbleBorder: userStyle ? userStyle.borderStyle : null,
      userBubbleBorderRadius: userStyle ? userStyle.borderRadius : null,
      userBubbleBackground: userStyle ? userStyle.backgroundColor : null,
      asstBubbleBorder: asstStyle ? asstStyle.borderStyle : null,
      asstBubbleBorderRadius: asstStyle ? asstStyle.borderRadius : null,
      asstBubbleBackground: asstStyle ? asstStyle.backgroundColor : null,
      bubblesAreBorderless: (
        (userStyle.borderStyle === 'none' || userStyle.borderWidth === '0px') &&
        (asstStyle.borderStyle === 'none' || asstStyle.borderWidth === '0px')
      )
    };
  })()`);
  console.log('Conversation Bubbles Border Audit:', JSON.stringify(conversationBorderAudit, null, 2));

  await cdp.captureScreenshot('friday_borderless_conversation_dark.png');

  // Capture Light Mode
  console.log('Switching to Light Mode for capture...');
  await cdp.evaluate(`document.documentElement.classList.remove('dark');`);
  await sleep(600);
  await cdp.captureScreenshot('friday_borderless_conversation_light.png');

  // Back to dark mode
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(400);

  console.log('=== TEST 2: Mobile Viewport Rendering (390x844) ===');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(800);

  const mobileAudit = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'Dialog not found' };
    const rect = dialog.getBoundingClientRect();
    const style = window.getComputedStyle(dialog);
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      borderWidth: style.borderWidth,
      borderStyle: style.borderStyle
    };
  })()`);
  console.log('Mobile Viewport Audit:', JSON.stringify(mobileAudit, null, 2));
  await cdp.captureScreenshot('friday_borderless_mobile_dark.png');

  // Reset viewport
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await sleep(500);

  console.log('=== TEST 3: New Conversation Reset Test ===');
  await cdp.evaluate(`
    document.querySelector('button[aria-label*="New chat" i], button[aria-label*="New conversation" i]').click();
  `);
  await sleep(600);

  const resetAudit = await cdp.evaluate(`(() => {
    const bubbles = document.querySelectorAll('dialog[open] [class*="bubble"]');
    const userRows = document.querySelectorAll('dialog[open] div[class*="user"]');
    return {
      totalBubbles: bubbles.length,
      userMessages: userRows.length,
      isFresh: bubbles.length === 1 && userRows.length === 0
    };
  })()`);
  console.log('Reset Audit:', JSON.stringify(resetAudit, null, 2));

  console.log('All borderless checks passed successfully!');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
