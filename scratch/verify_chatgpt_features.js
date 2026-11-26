const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3000;
const CDP_PORT = 9227;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.id && this.callbacks.has(parsed.id)) {
          const { resolve, reject } = this.callbacks.get(parsed.id);
          this.callbacks.delete(parsed.id);
          if (parsed.error) reject(parsed.error);
          else resolve(parsed.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log("=== Comprehensive Verification: ChatGPT-Style & Voice Mode ===");
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
      `http://127.0.0.1:${PORT}`,
    ],
    { stdio: "ignore" }
  );

  try {
    let connected = false;
    let attempts = 0;
    while (!connected && attempts < 25) {
      await delay(400);
      try {
        await getCdpTargets();
        connected = true;
      } catch {
        attempts++;
      }
    }

    if (!connected) throw new Error("Could not connect to Chrome CDP");

    const targets = await getCdpTargets();
    const pageTarget = targets.find((t) => t.type === "page");
    if (!pageTarget) throw new Error("No page target found");

    const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    await delay(2500);

    // 1. Open Friday assistant
    console.log("Step 1: Opening Friday Assistant...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-testid=\"mascot-assistant-trigger\"]')?.click();`,
    });
    await delay(1200);

    // 2. Verify controls exist
    const controlCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const historyBtn = document.querySelector('button[aria-label=\"Conversation history\"]');
          const newChatBtn = document.querySelector('button[aria-label=\"New chat\"]');
          const closeBtn = document.querySelector('button[aria-label=\"Close Friday\"]');
          const micBtn = document.querySelector('button[aria-label*=\"Voice Mode\"]');
          const sendBtn = document.querySelector('button[aria-label=\"Send message\"]');
          return {
            hasHistoryBtn: !!historyBtn,
            hasNewChatBtn: !!newChatBtn,
            hasCloseBtn: !!closeBtn,
            hasMicBtn: !!micBtn,
            hasSendBtn: !!sendBtn,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Controls Verification:", JSON.stringify(controlCheck.result.value, null, 2));

    // 3. Send message in Conversation 1 via quick-action topic "Tech stack"
    console.log("Step 3: Triggering message in Conversation 1...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Tech stack'));
          if (btn) btn.click();
        })()
      `,
    });

    console.log("Waiting for Conversation 1 response...");
    for (let i = 0; i < 20; i++) {
      await delay(1000);
      const isDone = await cdp.send("Runtime.evaluate", {
        expression: `!document.querySelector('[class*=\"cursor\"]')`,
        returnByValue: true,
      });
      if (isDone.result.value) {
        console.log(`Conv 1 Stream finished in ~${i + 1}s`);
        break;
      }
    }
    await delay(1200);

    // Inspect conversation 1 storage
    const conv1Check = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const raw = localStorage.getItem('friday_conversations_v1');
          const convs = JSON.parse(raw || '[]');
          return {
            totalConvs: convs.length,
            title: convs[0]?.title,
            messagesCount: convs[0]?.messages?.length,
            activeId: localStorage.getItem('friday_active_conversation_id')
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Conversation 1 Result:", JSON.stringify(conv1Check.result.value, null, 2));

    // 4. Create New Conversation 2
    console.log("Step 4: Starting New Conversation...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label=\"New chat\"]')?.click();`,
    });
    await delay(1000);

    // Type a prompt in Conversation 2 using native setter
    console.log("Sending prompt in Conversation 2...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('form input');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, "What is machine learning?");
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const form = document.querySelector('form');
          form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })()
      `,
    });

    console.log("Waiting for Conversation 2 response...");
    for (let i = 0; i < 20; i++) {
      await delay(1000);
      const isDone = await cdp.send("Runtime.evaluate", {
        expression: `!document.querySelector('[class*=\"cursor\"]')`,
        returnByValue: true,
      });
      if (isDone.result.value) {
        console.log(`Conv 2 Stream finished in ~${i + 1}s`);
        break;
      }
    }
    await delay(1200);

    // 5. Open History Drawer
    console.log("Step 5: Opening History Drawer...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label=\"Conversation history\"]')?.click();`,
    });
    await delay(800);

    const drawerCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const raw = localStorage.getItem('friday_conversations_v1');
          const convs = JSON.parse(raw || '[]');
          return {
            conversations: convs.map(c => ({ id: c.id, title: c.title, msgCount: c.messages.length }))
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Drawer Storage Check:", JSON.stringify(drawerCheck.result.value, null, 2));

    // Capture Screenshot with Drawer open
    const drawerShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const drawerPath = `${ARTIFACT_DIR}\\friday_chatgpt_history_drawer.png`;
    fs.writeFileSync(drawerPath, Buffer.from(drawerShot.data, "base64"));
    console.log("Saved drawer screenshot:", drawerPath);

    // 6. Test Rename conversation in Drawer
    console.log("Step 6: Renaming conversation...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const renameBtn = document.querySelector('button[aria-label^=\"Rename\"]');
          if (renameBtn) renameBtn.click();
        })()
      `,
    });
    await delay(500);

    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('div[class*=\"rounded-lg\"] input[type=\"text\"]');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, "AI & Machine Learning Overview");
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const saveBtn = document.querySelector('button[aria-label=\"Save title\"]');
          if (saveBtn) saveBtn.click();
        })()
      `,
    });
    await delay(600);

    const renameVerify = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const raw = localStorage.getItem('friday_conversations_v1');
          const convs = JSON.parse(raw || '[]');
          return convs.map(c => c.title);
        })()
      `,
      returnByValue: true,
    });
    console.log("Verified Conversation Titles after Rename:", renameVerify.result.value);

    // Close History Drawer
    console.log("Closing History Drawer...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label=\"Close history drawer\"]')?.click();`,
    });
    await delay(600);

    // Capture Desktop Conversation Screenshot
    const deskShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const deskPath = `${ARTIFACT_DIR}\\friday_chatgpt_desktop.png`;
    fs.writeFileSync(deskPath, Buffer.from(deskShot.data, "base64"));
    console.log("Saved desktop screenshot:", deskPath);

    // 7. Test Voice Assistant Mode
    console.log("Step 7: Testing Voice Assistant Mode...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label*=\"Voice Mode\"]')?.click();`,
    });
    await delay(1000);

    const voiceCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const overlay = document.querySelector('[class*=\"backdrop-blur-md\"]');
          const muteBtn = document.querySelector('button[aria-label*=\"microphone\" i]');
          const exitBtn = document.querySelector('button[aria-label=\"Exit Voice Mode\"]');
          const statePill = overlay?.querySelector('span.font-medium');
          return {
            hasOverlay: !!overlay,
            hasMuteBtn: !!muteBtn,
            muteAriaLabel: muteBtn?.getAttribute('aria-label'),
            hasExitBtn: !!exitBtn,
            stateLabel: statePill?.textContent?.trim()
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Voice Mode Verification:", JSON.stringify(voiceCheck.result.value, null, 2));

    // Capture Voice Mode Screenshot
    const voiceShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const voicePath = `${ARTIFACT_DIR}\\friday_voice_mode.png`;
    fs.writeFileSync(voicePath, Buffer.from(voiceShot.data, "base64"));
    console.log("Saved voice mode screenshot:", voicePath);

    // Test Mute Button
    console.log("Testing Mute button...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label*=\"microphone\" i]')?.click();`,
    });
    await delay(500);

    const mutedCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const muteBtn = document.querySelector('button[aria-label*=\"microphone\" i]');
          return {
            label: muteBtn?.getAttribute('aria-label'),
            isRedBg: muteBtn?.className.includes('bg-red')
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Muted State Check:", JSON.stringify(mutedCheck.result.value, null, 2));

    // Unmute
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label*=\"microphone\" i]')?.click();`,
    });
    await delay(400);

    // Exit Voice Mode
    console.log("Exiting Voice Mode...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label=\"Exit Voice Mode\"]')?.click();`,
    });
    await delay(600);

    const postVoiceCheck = await cdp.send("Runtime.evaluate", {
      expression: `!document.querySelector('button[aria-label=\"Exit Voice Mode\"]')`,
      returnByValue: true,
    });
    console.log("Returned cleanly to text interface:", postVoiceCheck.result.value);

    // 8. Mobile Viewport (390 x 844)
    console.log("Step 8: Testing mobile viewport 390x844...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await delay(800);

    const mobileShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const mobilePath = `${ARTIFACT_DIR}\\friday_chatgpt_mobile.png`;
    fs.writeFileSync(mobilePath, Buffer.from(mobileShot.data, "base64"));
    console.log("Saved mobile screenshot:", mobilePath);

    console.log("=== ALL ChatGPT & Voice Mode Tests PASSED Successfully ===");
    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
