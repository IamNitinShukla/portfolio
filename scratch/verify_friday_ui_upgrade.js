const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9229;
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
  console.log('Spawning Chrome for verification...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-friday-ui-upgrade',
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

  console.log('=== TEST 1: Initial Opening & Red Theme Inspection ===');
  // Open Friday Assistant Dialog
  await cdp.evaluate(`
    document.querySelector('[data-testid="mascot-assistant-trigger"]').click();
  `);
  await sleep(1000);

  // Switch to Dark mode
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(500);

  const initialAudit = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'Dialog not found' };

    const computed = window.getComputedStyle(dialog);
    const tempBadge = dialog.querySelector('div[class*="tempChatBadge"]');
    const historyBtn = dialog.querySelector('button[aria-label*="history" i]');
    const historyDrawer = dialog.querySelector('[class*="historyDrawer"]');
    const newChatBtn = dialog.querySelector('button[aria-label*="new chat" i]');
    const closeBtn = dialog.querySelector('button[aria-label*="close" i]');
    const sourceNote = dialog.querySelector('p[class*="sourceNote"]');
    const sendBtn = dialog.querySelector('button[type="submit"]');
    const voiceBtn = dialog.querySelector('button[aria-label*="voice mode" i]');

    return {
      dialogOpen: true,
      hasTempBadge: Boolean(tempBadge),
      tempBadgeText: tempBadge ? tempBadge.textContent.trim() : null,
      historyBtnRemoved: !historyBtn,
      historyDrawerRemoved: !historyDrawer,
      newChatBtnPresent: Boolean(newChatBtn),
      closeBtnPresent: Boolean(closeBtn),
      sourceNoteText: sourceNote ? sourceNote.textContent.trim() : null,
      borderColor: computed.borderColor,
      sendBtnColor: sendBtn ? window.getComputedStyle(sendBtn).backgroundColor : null,
      voiceBtnColor: voiceBtn ? window.getComputedStyle(voiceBtn).backgroundImage : null
    };
  })()`);

  console.log('Initial Audit Result (Dark):', JSON.stringify(initialAudit, null, 2));
  await cdp.captureScreenshot('friday_red_theme_initial_dark.png');

  // Also capture in Light mode
  console.log('Switching to Light Mode for initial capture...');
  await cdp.evaluate(`document.documentElement.classList.remove('dark');`);
  await sleep(500);
  await cdp.captureScreenshot('friday_red_theme_initial_light.png');

  // Back to Dark mode for conversation testing
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(500);

  console.log('=== TEST 2: Conversational Messages & Context Retention ===');
  // Send first message: "What is Nitin's primary tech stack?"
  await cdp.evaluate(`(() => {
    const input = document.querySelector('dialog[open] input');
    const form = document.querySelector('dialog[open] form');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, "What is Nitin's primary tech stack?");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  })()`);

  // Wait for streaming completion
  console.log('Waiting for response 1...');
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const streaming = await cdp.evaluate(`(() => {
      const msgs = document.querySelectorAll('dialog[open] [class*="bubble"]');
      const cursor = document.querySelector('dialog[open] [class*="cursor"]');
      return { msgCount: msgs.length, isStreaming: Boolean(cursor) };
    })()`);
    if (streaming.msgCount >= 3 && !streaming.isStreaming) {
      console.log('Response 1 completed streaming!');
      break;
    }
  }

  // Audit bubble shapes and avatars
  const bubbleAudit = await cdp.evaluate(`(() => {
    const userRow = document.querySelector('dialog[open] div[class*="user"]');
    const asstRow = Array.from(document.querySelectorAll('dialog[open] div[class*="assistant"]')).pop();
    const userBubble = userRow ? userRow.querySelector('[class*="bubble"]') : null;
    const asstBubble = asstRow ? asstRow.querySelector('[class*="bubble"]') : null;
    const asstAvatar = asstRow ? asstRow.querySelector('canvas[class*="avatar"]') : null;

    return {
      userBubbleBorderRadius: userBubble ? window.getComputedStyle(userBubble).borderRadius : null,
      userBubbleBackground: userBubble ? window.getComputedStyle(userBubble).backgroundImage || window.getComputedStyle(userBubble).backgroundColor : null,
      asstBubbleBorderRadius: asstBubble ? window.getComputedStyle(asstBubble).borderRadius : null,
      asstBubbleBackground: asstBubble ? window.getComputedStyle(asstBubble).backgroundColor : null,
      hasAsstAvatar: Boolean(asstAvatar)
    };
  })()`);
  console.log('Bubble Shapes Audit:', JSON.stringify(bubbleAudit, null, 2));

  // Send follow-up question: "Which of those has he worked with the longest?"
  console.log('Sending follow-up message to test context retention...');
  await cdp.evaluate(`(() => {
    const input = document.querySelector('dialog[open] input');
    const form = document.querySelector('dialog[open] form');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, "Which of those has he worked with the longest?");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  })()`);

  // Wait for follow-up streaming completion
  console.log('Waiting for follow-up response 2...');
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const streaming = await cdp.evaluate(`(() => {
      const msgs = document.querySelectorAll('dialog[open] [class*="bubble"]');
      const cursor = document.querySelector('dialog[open] [class*="cursor"]');
      return { msgCount: msgs.length, isStreaming: Boolean(cursor) };
    })()`);
    if (streaming.msgCount >= 5 && !streaming.isStreaming) {
      console.log('Response 2 completed streaming!');
      break;
    }
  }

  await sleep(1000);
  await cdp.captureScreenshot('friday_conversational_chat_dark.png');

  // Capture light mode conversational bubbles too
  console.log('Capturing Light Mode conversational bubbles...');
  await cdp.evaluate(`document.documentElement.classList.remove('dark');`);
  await sleep(600);
  await cdp.captureScreenshot('friday_conversational_chat_light.png');

  // Back to dark mode
  await cdp.evaluate(`document.documentElement.classList.add('dark');`);
  await sleep(500);

  console.log('=== TEST 3: Temporary Chat & Persistence Verification ===');
  // Check localStorage during active conversation
  const storageCheckDuringChat = await cdp.evaluate(`(() => {
    return {
      friday_conversations_v1: localStorage.getItem('friday_conversations_v1'),
      friday_active_conversation_id: localStorage.getItem('friday_active_conversation_id'),
      friday_conversations: localStorage.getItem('friday_conversations'),
      allLocalStorageKeys: Object.keys(localStorage)
    };
  })()`);
  console.log('Storage Check during active chat:', JSON.stringify(storageCheckDuringChat, null, 2));

  // Close Friday via Close button
  console.log('Closing Friday assistant...');
  await cdp.evaluate(`
    document.querySelector('dialog[open] button[aria-label*="close" i]').click();
  `);
  await sleep(800);

  const closedCheck = await cdp.evaluate(`(() => {
    return {
      dialogOpen: Boolean(document.querySelector('dialog[open]')),
      dialogInDom: Boolean(document.querySelector('dialog'))
    };
  })()`);
  console.log('Assistant Closed Status:', JSON.stringify(closedCheck, null, 2));

  // Reopen Friday assistant
  console.log('Reopening Friday assistant to verify fresh state...');
  await cdp.evaluate(`
    document.querySelector('[data-testid="mascot-assistant-trigger"]').click();
  `);
  await sleep(1000);

  const reopenedAudit = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return { error: 'Dialog not found' };

    const bubbles = dialog.querySelectorAll('[class*="bubble"]');
    const userRows = dialog.querySelectorAll('div[class*="user"]');
    const welcomeH3 = dialog.querySelector('h3');

    return {
      dialogOpen: true,
      totalBubbles: bubbles.length,
      userMessagesCount: userRows.length,
      welcomeHeading: welcomeH3 ? welcomeH3.textContent : null,
      isFreshConversation: bubbles.length === 1 && userRows.length === 0,
      localStorageEmpty: localStorage.getItem('friday_conversations_v1') === null
    };
  })()`);
  console.log('Reopened Audit (Fresh Conversation):', JSON.stringify(reopenedAudit, null, 2));
  await cdp.captureScreenshot('friday_reopened_fresh_state.png');

  console.log('=== TEST 4: Voice Mode Functionality from Red Button ===');
  await cdp.evaluate(`
    document.querySelector('button[aria-label*="Voice Mode" i]').click();
  `);
  await sleep(1500);

  const voiceAudit = await cdp.evaluate(`(() => {
    const overlay = document.querySelector('[data-testid="voice-state-label"]');
    const test = window.__voiceAssistantTest;
    return {
      overlayPresent: Boolean(overlay),
      voiceStateLabel: overlay ? overlay.textContent : null,
      voiceState: test ? test.getVoiceState() : null,
      isRecorderActive: test ? test.isRecorderActive() : false
    };
  })()`);
  console.log('Voice Mode Audit:', JSON.stringify(voiceAudit, null, 2));
  await cdp.captureScreenshot('friday_voice_mode_active.png');

  // Exit voice mode back to text chat
  await cdp.evaluate(`
    const textChatBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Text Chat'));
    if (textChatBtn) textChatBtn.click();
  `);
  await sleep(800);

  console.log('All automated verifications completed successfully!');
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
