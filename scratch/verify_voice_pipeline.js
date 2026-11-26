const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9235;
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
  console.log("Launching headless Chrome on port", CDP_PORT);
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
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
    await cdp.send("Runtime.enable");

    console.log("Navigated to home. Waiting for hydration & dismissing intro...");
    await delay(1500);

    // Skip intro animation
    await cdp.send("Runtime.evaluate", {
      expression: `
        sessionStorage.setItem("portfolio_intro_seen", "true");
        window.location.reload();
      `
    });

    await delay(2500);

    // 1. Open Friday mascot dialog
    console.log("Opening Friday assistant dialog via data-testid...");
    const openRes = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-testid="mascot-assistant-trigger"]');
          if (btn) {
            btn.click();
            return { clicked: true };
          }
          return { clicked: false, error: "Trigger not found" };
        })()
      `,
      returnByValue: true
    });
    console.log("Open dialog:", openRes.result.value);

    await delay(1200);

    // 2. Click Voice Mode button in composer
    console.log("Clicking Voice Mode button...");
    const voiceModeRes = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const micBtn = document.querySelector('button[title="Voice Mode"]') || document.querySelector('button[aria-label="Start Voice Mode"]');
          if (micBtn) {
            micBtn.click();
            return { clicked: true };
          }
          return { clicked: false, error: "Voice mode button not found" };
        })()
      `,
      returnByValue: true
    });
    console.log("Start Voice Mode:", voiceModeRes.result.value);

    await delay(1500);

    // 3. Inspect Voice Overlay State
    const overlayState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stateSpan = document.querySelector('span[data-testid="voice-state-label"]');
          const promptCard = document.querySelector('div.shadow-lg p');
          const isMicActive = !!document.querySelector('button[aria-label="Mute microphone"]');
          return {
            stateLabel: stateSpan ? stateSpan.textContent : null,
            cardText: promptCard ? promptCard.textContent : null,
            hasMuteBtn: isMicActive
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Voice Overlay Active State:", overlayState.result.value);

    // Capture screenshot 1: Voice Mode Active
    const artifactDir = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
    const shot1 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_voice_mediarecorder_active.png"), Buffer.from(shot1.data, "base64"));
    console.log("Saved artifact: friday_voice_mediarecorder_active.png");

    // 4. Test In-Overlay Query to verify full conversational pipeline & Friday vocalization
    console.log("Submitting test query inside Voice Overlay with React input setter...");
    const submitQueryRes = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('input[placeholder*="type question"]');
          if (input) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(input, "What technologies does Nitin use?");
            input.dispatchEvent(new Event('input', { bubbles: true }));

            const submitBtn = document.querySelector('button[aria-label="Send typed query"]');
            if (submitBtn && !submitBtn.disabled) {
              submitBtn.click();
              return { submitted: true, value: input.value };
            }
          }
          return { submitted: false };
        })()
      `,
      returnByValue: true
    });
    console.log("Submit Query Result:", submitQueryRes.result.value);

    // Wait for Friday's response to generate & vocalize
    await delay(5000);

    const postQueryState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stateSpan = document.querySelector('span[data-testid="voice-state-label"]');
          const statusCard = document.querySelector('div.shadow-lg p');
          const interruptBtn = !!document.querySelector('button[aria-label="Interrupt Friday"]');
          return {
            stateLabel: stateSpan ? stateSpan.textContent : null,
            statusText: statusCard ? statusCard.textContent : null,
            hasInterruptBtn: interruptBtn
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Voice Response State:", postQueryState.result.value);

    // Capture screenshot 2: Friday Response / Speaking
    const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_voice_response_speaking.png"), Buffer.from(shot2.data, "base64"));
    console.log("Saved artifact: friday_voice_response_speaking.png");

    // 5. Exit Voice Mode to verify conversation history in text chat
    console.log("Exiting voice mode to verify chat history...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const exitBtn = document.querySelector('button[aria-label="Exit Voice Mode"]');
          if (exitBtn) exitBtn.click();
        })()
      `
    });

    await delay(1200);

    const historyCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const bubbles = Array.from(document.querySelectorAll('div[class*="bubble"]')).map(b => b.textContent.trim());
          return {
            bubbleCount: bubbles.length,
            messages: bubbles.map(t => t.substring(0, 60) + "...")
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Chat History Preserved:", historyCheck.result.value);

    // Capture screenshot 3: Text chat history preserved
    const shot3 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_voice_history_preserved.png"), Buffer.from(shot3.data, "base64"));
    console.log("Saved artifact: friday_voice_history_preserved.png");

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
