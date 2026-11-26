const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9245;
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
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-avatar-verify-2',
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
    console.error('Failed to get CDP targets');
    chromeProc.kill();
    process.exit(1);
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1500);

  // Navigate explicitly to ensure origin is http://localhost:3000
  console.log('Navigating to http://localhost:3000...');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2000);

  // Set dark theme and bypass intro
  await cdp.evaluate(`(() => {
    try {
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("theme", "dark");
    } catch (e) {}
    document.documentElement.classList.add("dark");
  })()`);
  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2500);

  // Wait for mascot assistant trigger
  console.log('Waiting for mascot assistant trigger...');
  for (let i = 0; i < 20; i++) {
    const hasTrigger = await cdp.evaluate(`!!document.querySelector('[data-testid="mascot-assistant-trigger"]')`);
    if (hasTrigger) break;
    await sleep(400);
  }

  // Open Friday Assistant Dialog
  console.log('Opening Friday Assistant Dialog...');
  await cdp.evaluate(`
    const trigger = document.querySelector('[data-testid="mascot-assistant-trigger"]');
    if (trigger) trigger.click();
  `);

  // Wait for dialog[open]
  for (let i = 0; i < 20; i++) {
    const hasDialog = await cdp.evaluate(`!!document.querySelector('dialog[open]')`);
    if (hasDialog) break;
    await sleep(300);
  }
  await sleep(800);

  // Check initial state (greeting message)
  const initialCheck = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'No open dialog found' };
    const canvases = Array.from(dialog.querySelectorAll('canvas'));
    return canvases.map((c, idx) => {
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext('2d');
      let nonTransparentPixels = 0;
      try {
        const imgData = ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
        if (imgData) {
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10) nonTransparentPixels++;
          }
        }
      } catch (err) {
        return { index: idx, error: err.message };
      }
      return {
        index: idx,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        canvasWidth: c.width,
        canvasHeight: c.height,
        nonTransparentPixels,
        hasContent: nonTransparentPixels > 100
      };
    });
  })()`);

  console.log('Initial Canvas Check (Greeting):', JSON.stringify(initialCheck, null, 2));

  // Send a question by clicking "Tech stack"
  console.log('Clicking "Tech stack" quick action to start streaming response...');
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent?.includes('Tech stack'));
    if (btn) btn.click();
  })()`);

  // Wait 1.2s for streaming to begin
  await sleep(1200);

  // Check streaming state: canvas pixel data while streaming
  const streamingCheck = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'No open dialog found' };
    const canvases = Array.from(dialog.querySelectorAll('canvas'));
    const cursor = dialog.querySelector('[class*="cursor"]');
    return {
      isStreamingActive: !!cursor,
      canvases: canvases.map((c, idx) => {
        const rect = c.getBoundingClientRect();
        const ctx = c.getContext('2d');
        let nonTransparentPixels = 0;
        try {
          const imgData = ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
          if (imgData) {
            for (let i = 3; i < imgData.data.length; i += 4) {
              if (imgData.data[i] > 10) nonTransparentPixels++;
            }
          }
        } catch (err) {
          return { index: idx, error: err.message };
        }
        return {
          index: idx,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          nonTransparentPixels,
          hasContent: nonTransparentPixels > 100
        };
      })
    };
  })()`);

  console.log('Streaming State Canvas Check:', JSON.stringify(streamingCheck, null, 2));
  await cdp.captureScreenshot('friday_avatar_streaming.png');

  // Wait for stream to complete
  console.log('Waiting for response stream to settle...');
  let settled = false;
  for (let i = 0; i < 30; i++) {
    await sleep(600);
    const isStillStreaming = await cdp.evaluate(`!!document.querySelector('dialog[open] [class*="cursor"]')`);
    if (!isStillStreaming) {
      settled = true;
      break;
    }
  }
  console.log('Stream completed. Settled =', settled);
  await sleep(1000);

  // Completed State Check (Dark Theme)
  const completedCheckDark = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'No open dialog found' };
    const assistantRows = Array.from(dialog.querySelectorAll('[class*="assistant"]'));
    const userRows = Array.from(dialog.querySelectorAll('[class*="user"]'));
    const canvases = Array.from(dialog.querySelectorAll('canvas'));
    
    // Check vertical alignment: avatar top vs bubble top
    const alignments = assistantRows.map((row, idx) => {
      const avatar = row.querySelector('canvas');
      const bubble = row.querySelector('[class*="bubble"]');
      const avatarRect = avatar ? avatar.getBoundingClientRect() : null;
      const bubbleRect = bubble ? bubble.getBoundingClientRect() : null;
      return {
        row: idx,
        hasAvatar: !!avatar,
        avatarTop: avatarRect ? Math.round(avatarRect.top) : null,
        bubbleTop: bubbleRect ? Math.round(bubbleRect.top) : null,
        deltaY: (avatarRect && bubbleRect) ? Math.round(Math.abs(avatarRect.top - bubbleRect.top)) : null
      };
    });

    const userHasAvatar = userRows.some(row => !!row.querySelector('canvas'));

    const canvasStats = canvases.map((c, idx) => {
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext('2d');
      let nonTransparentPixels = 0;
      try {
        const imgData = ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
        if (imgData) {
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10) nonTransparentPixels++;
          }
        }
      } catch (err) {
        return { index: idx, error: err.message };
      }
      return {
        index: idx,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        nonTransparentPixels,
        hasContent: nonTransparentPixels > 100
      };
    });

    return {
      assistantRowCount: assistantRows.length,
      userRowCount: userRows.length,
      userHasAvatar,
      canvasCount: canvases.length,
      canvasStats,
      alignments
    };
  })()`);

  console.log('Completed State Check (Dark Theme):', JSON.stringify(completedCheckDark, null, 2));
  await cdp.captureScreenshot('friday_avatar_completed_dark.png');

  // Switch to Light Theme
  console.log('Switching to Light Theme...');
  await cdp.evaluate(`(() => {
    document.documentElement.classList.remove("dark");
    document.querySelector('dialog[open]')?.classList.remove("dark");
  })()`);
  await sleep(800);
  await cdp.captureScreenshot('friday_avatar_completed_light.png');

  // Test Mobile Layout (390 x 844)
  console.log('Testing Mobile Layout...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(800);

  const mobileCheck = await cdp.evaluate(`(() => {
    const canvases = Array.from(document.querySelectorAll('dialog[open] canvas'));
    return canvases.map((c, idx) => {
      const rect = c.getBoundingClientRect();
      return {
        index: idx,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });
  })()`);
  console.log('Mobile Avatar Sizing:', JSON.stringify(mobileCheck, null, 2));
  await cdp.captureScreenshot('friday_avatar_completed_mobile.png');

  chromeProc.kill();
  console.log('Verification completed successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
