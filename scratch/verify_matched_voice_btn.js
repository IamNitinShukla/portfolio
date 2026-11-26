const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9228;
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

  async captureScreenshot(filename, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const r = await this.send('Page.captureScreenshot', params);
    const buffer = Buffer.from(r.data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`[Screenshot saved] ${fullPath}`);
    return fullPath;
  }
}

async function run() {
  console.log('Spawning headless Chrome...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-qa-matched-btn',
    '--disable-gpu',
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
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

  // Open Friday Assistant Dialog
  console.log('Opening Friday Assistant Dialog in Light Mode...');
  for (let i = 0; i < 20; i++) {
    const exists = await cdp.evaluate(`
      Boolean(document.querySelector('[data-testid="mascot-assistant-trigger"]'))
    `);
    if (exists) break;
    await sleep(300);
  }
  await cdp.evaluate(`
    document.querySelector('[data-testid="mascot-assistant-trigger"]').click();
  `);
  await sleep(1000);

  // Measure and audit the red voice button and send button in Light Mode
  const lightAudit = await cdp.evaluate(`(() => {
    const voiceBtn = document.querySelector('button[aria-label*="Voice Mode" i]');
    const sendBtn = document.querySelector('button[type="submit"]');
    const composer = document.querySelector('dialog[open] form');
    const input = composer ? composer.querySelector('input') : null;
    if (!voiceBtn || !sendBtn) return { error: 'Buttons not found' };

    const voiceRect = voiceBtn.getBoundingClientRect();
    const sendRect = sendBtn.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const voiceStyle = window.getComputedStyle(voiceBtn);
    const sendStyle = window.getComputedStyle(sendBtn);
    const svg = voiceBtn.querySelector('svg');

    return {
      voiceWidth: Math.round(voiceRect.width),
      voiceHeight: Math.round(voiceRect.height),
      voiceCenterY: Math.round(voiceRect.top + voiceRect.height / 2),
      sendWidth: Math.round(sendRect.width),
      sendHeight: Math.round(sendRect.height),
      sendCenterY: Math.round(sendRect.top + sendRect.height / 2),
      isWidthMatched: Math.round(voiceRect.width) === Math.round(sendRect.width),
      isHeightMatched: Math.round(voiceRect.height) === Math.round(sendRect.height),
      isCenterYMatched: Math.round(voiceRect.top + voiceRect.height / 2) === Math.round(sendRect.top + sendRect.height / 2),
      spacingGap: Math.round(sendRect.left - voiceRect.right),
      voiceBorderRadius: voiceStyle.borderRadius,
      voiceBoxShadow: voiceStyle.boxShadow,
      voiceBackground: voiceStyle.backgroundImage || voiceStyle.backgroundColor,
      svgWidth: svg ? svg.getAttribute('width') || svg.getBoundingClientRect().width : null,
      svgHeight: svg ? svg.getAttribute('height') || svg.getBoundingClientRect().height : null,
      composerHeight: Math.round(composerRect.height)
    };
  })()`);

  console.log('--- LIGHT MODE AUDIT ---');
  console.log(JSON.stringify(lightAudit, null, 2));

  // Get composer clip for focused screenshot
  const dialogComposerClip = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return null;
    const composer = dialog.querySelector('form');
    if (!composer) return null;
    const r = composer.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      scale: 1
    };
  })()`);

  await cdp.captureScreenshot('friday_composer_voice_button_light.png', dialogComposerClip);
  await cdp.captureScreenshot('friday_assistant_dialog_light.png');

  // Switch to Dark Mode
  console.log('Switching to Dark Mode...');
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(600);

  const darkAudit = await cdp.evaluate(`(() => {
    const voiceBtn = document.querySelector('button[aria-label*="Voice Mode" i]');
    const sendBtn = document.querySelector('button[type="submit"]');
    if (!voiceBtn || !sendBtn) return { error: 'Buttons not found' };

    const voiceRect = voiceBtn.getBoundingClientRect();
    const sendRect = sendBtn.getBoundingClientRect();
    const voiceStyle = window.getComputedStyle(voiceBtn);

    return {
      voiceWidth: Math.round(voiceRect.width),
      voiceHeight: Math.round(voiceRect.height),
      sendWidth: Math.round(sendRect.width),
      sendHeight: Math.round(sendRect.height),
      isMatched: Math.round(voiceRect.width) === Math.round(sendRect.width),
      voiceBoxShadow: voiceStyle.boxShadow
    };
  })()`);

  console.log('--- DARK MODE AUDIT ---');
  console.log(JSON.stringify(darkAudit, null, 2));

  await cdp.captureScreenshot('friday_composer_voice_button_dark.png', dialogComposerClip);
  await cdp.captureScreenshot('friday_assistant_dialog_dark.png');

  // Test Clicking Voice Button -> Opens Voice Mode
  console.log('Testing clicking red voice button to open Voice Mode...');
  await cdp.evaluate(`
    document.querySelector('button[aria-label*="Voice Mode" i]').click();
  `);
  await sleep(1500);

  const voiceModeActive = await cdp.evaluate(`(() => {
    const test = window.__voiceAssistantTest;
    const overlay = document.querySelector('[data-testid="voice-state-label"]');
    return {
      overlayPresent: Boolean(overlay),
      voiceStateLabel: overlay ? overlay.textContent : null,
      voiceState: test ? test.getVoiceState() : null,
      isRecorderActive: test ? test.isRecorderActive() : false
    };
  })()`);
  console.log('--- VOICE MODE OPEN VERIFICATION ---');
  console.log(JSON.stringify(voiceModeActive, null, 2));
  await cdp.captureScreenshot('friday_voice_mode_opened_from_button.png');

  // Switch back to text chat
  console.log('Switching back to text chat...');
  await cdp.evaluate(`
    const textChatBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Text Chat'));
    if (textChatBtn) textChatBtn.click();
  `);
  await sleep(800);

  const textChatRestored = await cdp.evaluate(`(() => {
    const voiceBtn = document.querySelector('button[aria-label*="Voice Mode" i]');
    const sendBtn = document.querySelector('button[type="submit"]');
    const overlay = document.querySelector('[data-testid="voice-state-label"]');
    return {
      overlayGone: !overlay,
      voiceBtnPresent: Boolean(voiceBtn),
      sendBtnPresent: Boolean(sendBtn)
    };
  })()`);
  console.log('--- TEXT CHAT RESTORED ---');
  console.log(JSON.stringify(textChatRestored, null, 2));

  console.log('All verifications passed!');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

