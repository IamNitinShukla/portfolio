const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9245;
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
  console.log("=== Testing Automatic Voice Interruption (Barge-in) ===");
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

    // Skip intro
    await cdp.send("Runtime.evaluate", {
      expression: `
        sessionStorage.setItem("portfolio_intro_seen", "true");
        window.location.reload();
      `
    });

    await delay(2500);

    // 1. Open Friday assistant dialog
    console.log("Opening Friday assistant dialog...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        const btn = document.querySelector('button[data-testid="mascot-assistant-trigger"]');
        if (btn) btn.click();
      `
    });

    await delay(1200);

    // 2. Open Voice Mode
    console.log("Activating voice mode...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        const micBtn = document.querySelector('button[title="Voice Mode"]') || document.querySelector('button[aria-label="Start Voice Mode"]');
        if (micBtn) micBtn.click();
      `
    });

    await delay(1500);

    // 3. Verify UI state: No dedicated interrupt button
    const uiCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stateSpan = document.querySelector('span[data-testid="voice-state-label"]');
          const hasDedicatedInterruptBtn = !!document.querySelector('button[aria-label="Interrupt Friday"]');
          const hasMuteBtn = !!document.querySelector('button[aria-label="Mute microphone"]');
          const hasExitBtn = !!document.querySelector('button[aria-label="Exit Voice Mode"]');
          return {
            state: stateSpan ? stateSpan.textContent : null,
            hasDedicatedInterruptBtn,
            hasMuteBtn,
            hasExitBtn
          };
        })()
      `,
      returnByValue: true
    });
    console.log("UI Check (Interrupt Button Removed):", uiCheck.result.value);

    // 4. Submit a query for Friday to start speaking
    console.log("Sending query so Friday starts speaking...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('input[placeholder*="type question"]');
          if (input) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(input, "Explain in detail all seven technology skills Nitin possesses");
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const submitBtn = document.querySelector('button[aria-label="Send typed query"]');
            if (submitBtn) submitBtn.click();
          }
        })()
      `
    });

    // Wait for Friday to start speaking
    console.log("Waiting for Friday to formulate and start vocalizing...");
    let isSpeaking = false;
    for (let i = 0; i < 20; i++) {
      await delay(500);
      const state = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => {
            const span = document.querySelector('span[data-testid="voice-state-label"]');
            const speaking = window.speechSynthesis.speaking;
            return {
              label: span ? span.textContent : "",
              speechSynthesisSpeaking: speaking
            };
          })()
        `,
        returnByValue: true
      });
      if (state.result.value.label === "Friday Speaking" || state.result.value.speechSynthesisSpeaking) {
        isSpeaking = true;
        console.log("Friday Speaking reached:", state.result.value);
        break;
      }
    }

    if (!isSpeaking) {
      console.warn("Friday took longer than expected to speak, checking again...");
      await delay(2000);
    }

    // Save screenshot while Friday is speaking
    const artifactDir = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
    const shot1 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_speaking_before_barge_in.png"), Buffer.from(shot1.data, "base64"));
    console.log("Saved artifact: friday_speaking_before_barge_in.png");

    // 5. Trigger Automatic Barge-in via Microphone Audio Energy Detection
    console.log("Triggering audio energy on AnalyserNode to simulate user speaking (barge-in)...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          if (window.__voiceAssistantTest && typeof window.__voiceAssistantTest.triggerBargeInTest === 'function') {
            window.__voiceAssistantTest.triggerBargeInTest();
            return { triggered: true };
          }
          return { triggered: false };
        })()
      `
    });

    // Wait 350ms for confirmation window (3 consecutive frames ~200ms) to trigger automatic interruption
    await delay(450);

    // Inspect post-barge-in state
    const postBargeInState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stateSpan = document.querySelector('span[data-testid="voice-state-label"]');
          const statusCard = document.querySelector('div.shadow-lg p');
          const speechSpeaking = window.speechSynthesis.speaking;
          const voiceState = window.__voiceAssistantTest ? window.__voiceAssistantTest.getVoiceState() : null;
          return {
            stateLabel: stateSpan ? stateSpan.textContent : null,
            statusText: statusCard ? statusCard.textContent : null,
            speechSynthesisSpeaking: speechSpeaking,
            internalVoiceState: voiceState
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Post-Barge-in State (Interrupted Automatically):", postBargeInState.result.value);

    // Save screenshot of automatically interrupted state
    const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_barge_in_interrupted.png"), Buffer.from(shot2.data, "base64"));
    console.log("Saved artifact: friday_barge_in_interrupted.png");

    // 6. Test Microphone Release on Exit
    console.log("Testing exit and hardware cleanup...");
    const exitResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const testHandle = window.__voiceAssistantTest;
          const streamBefore = testHandle ? testHandle.getStream() : null;
          const tracksBefore = streamBefore ? streamBefore.getTracks().map(t => t.readyState) : [];

          const exitBtn = document.querySelector('button[aria-label="Exit Voice Mode"]');
          if (exitBtn) exitBtn.click();

          const tracksAfter = streamBefore ? streamBefore.getTracks().map(t => t.readyState) : [];
          return {
            tracksBefore,
            tracksAfterAllEnded: tracksAfter.every(s => s === "ended"),
            speechSynthesisSpeaking: window.speechSynthesis.speaking
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Hardware Cleanup Verification:", exitResult.result.value);

    // Save final screenshot
    const shot3 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_voice_after_barge_in_exit.png"), Buffer.from(shot3.data, "base64"));
    console.log("Saved artifact: friday_voice_after_barge_in_exit.png");

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
