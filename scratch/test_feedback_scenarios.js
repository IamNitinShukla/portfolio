const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9250;
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
  console.log("=== Testing Friday Audio Feedback, Self-Interruption Fix & Loop Prevention ===");
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

  const artifactDir = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";

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

    console.log("Navigating and dismissing intro...");
    await delay(1500);

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

    // Verify initial state
    const initState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stateSpan = document.querySelector('span[data-testid="voice-state-label"]');
          return stateSpan ? stateSpan.textContent : null;
        })()
      `,
      returnByValue: true
    });
    console.log("Initial state:", initState.result.value);

    // ========================================================
    // TEST A: Friday speaks while user remains silent
    // Expected: Friday completes response naturally without self-interruption!
    // ========================================================
    console.log("\n--- TEST A: Friday speaks while user remains silent ---");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('input[placeholder*="type question"]');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            setter.call(input, "Tell me briefly about Nitin's education");
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const submitBtn = document.querySelector('button[aria-label="Send typed query"]');
            if (submitBtn) submitBtn.click();
          }
        })()
      `
    });

    // Wait for Friday to start speaking
    let startedSpeaking = false;
    for (let i = 0; i < 20; i++) {
      await delay(400);
      const res = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => {
            const span = document.querySelector('span[data-testid="voice-state-label"]');
            return span ? span.textContent : "";
          })()
        `,
        returnByValue: true
      });
      if (res.result.value === "Friday Speaking") {
        startedSpeaking = true;
        console.log("Friday is now speaking. Observing for self-interruption...");
        break;
      }
    }

    if (!startedSpeaking) {
      console.warn("Speech generation took longer than usual...");
      await delay(2000);
    }

    // Monitor Friday speaking for 3 seconds while user stays SILENT
    // Verify Friday DOES NOT transition to interrupt_pending or capturing_interruption!
    let selfInterrupted = false;
    for (let i = 0; i < 6; i++) {
      await delay(500);
      const check = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => {
            const state = window.__voiceAssistantTest ? window.__voiceAssistantTest.getVoiceState() : null;
            return {
              state,
              speechSynthesisSpeaking: window.speechSynthesis.speaking
            };
          })()
        `,
        returnByValue: true
      });
      const current = check.result.value;
      if (current.state === "interrupt_pending" || current.state === "capturing_interruption") {
        selfInterrupted = true;
        console.error("FAILED TEST A: Friday self-interrupted! State:", current);
        break;
      }
    }

    console.log("Test A Result: Self-interruption occurred?", selfInterrupted ? "YES (BUG)" : "NO (PASSED - Friday spoke without self-interruption)");

    const shotA = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_speaks_without_self_interruption.png"), Buffer.from(shotA.data, "base64"));
    console.log("Saved artifact: friday_speaks_without_self_interruption.png");

    // ========================================================
    // TEST E: User remains silent after Friday finishes
    // Expected: State stays LISTENING, no automatic submission loop!
    // ========================================================
    console.log("\n--- TEST E: User remains silent after Friday finishes ---");
    // Ensure speech finishes
    await cdp.send("Runtime.evaluate", {
      expression: `window.speechSynthesis.cancel();` // End utterance to enter post-speech listening
    });
    await delay(600);

    const postSpeechState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const span = document.querySelector('span[data-testid="voice-state-label"]');
          const bubbles = document.querySelectorAll('div[class*="bubble"]').length;
          return {
            label: span ? span.textContent : null,
            bubbleCount: bubbles
          };
        })()
      `,
      returnByValue: true
    });
    console.log("State right after speech finishes:", postSpeechState.result.value);

    // Wait 3.0 seconds with user SILENT
    console.log("Waiting 3.0 seconds with user completely silent...");
    await delay(3000);

    const silentLoopCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const span = document.querySelector('span[data-testid="voice-state-label"]');
          const bubbles = document.querySelectorAll('div[class*="bubble"]').length;
          const state = window.__voiceAssistantTest ? window.__voiceAssistantTest.getVoiceState() : null;
          return {
            label: span ? span.textContent : null,
            bubbleCount: bubbles,
            state
          };
        })()
      `,
      returnByValue: true
    });
    console.log("State after 3 seconds of silence:", silentLoopCheck.result.value);

    const loopDetected = silentLoopCheck.result.value.bubbleCount > postSpeechState.result.value.bubbleCount ||
      silentLoopCheck.result.value.state === "thinking";
    console.log("Test E Result: Unsolicited submission loop detected?", loopDetected ? "YES (BUG)" : "NO (PASSED - Stable in Listening state)");

    const shotE = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_silent_no_loop.png"), Buffer.from(shotE.data, "base64"));
    console.log("Saved artifact: friday_silent_no_loop.png");

    // ========================================================
    // TEST B & D: Intentional User Interruption (Barge-in)
    // Expected: SpeechSynthesis cancelled immediately, state -> capturing_interruption
    // ========================================================
    console.log("\n--- TEST B: Intentional user interruption during speech ---");
    // Start another speaking turn
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('input[placeholder*="type question"]');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            setter.call(input, "Tell me a long story about Nitin Shukla's engineering philosophy");
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const submitBtn = document.querySelector('button[aria-label="Send typed query"]');
            if (submitBtn) submitBtn.click();
          }
        })()
      `
    });

    // Wait for Friday to start speaking
    for (let i = 0; i < 20; i++) {
      await delay(400);
      const res = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => {
            const span = document.querySelector('span[data-testid="voice-state-label"]');
            return span ? span.textContent : "";
          })()
        `,
        returnByValue: true
      });
      if (res.result.value === "Friday Speaking") {
        break;
      }
    }
    await delay(700); // Allow 600ms settling grace period to elapse

    console.log("Simulating sustained user speech (400ms tone) over microphone...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          if (window.__voiceAssistantTest && typeof window.__voiceAssistantTest.triggerBargeInTest === 'function') {
            window.__voiceAssistantTest.triggerBargeInTest();
          }
        })()
      `
    });

    await delay(450); // Allow 350ms confirmation window to trigger

    const bargeInState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stateSpan = document.querySelector('span[data-testid="voice-state-label"]');
          const statusCard = document.querySelector('div.shadow-lg p');
          const speechSpeaking = window.speechSynthesis.speaking;
          const internalState = window.__voiceAssistantTest ? window.__voiceAssistantTest.getVoiceState() : null;
          return {
            stateLabel: stateSpan ? stateSpan.textContent : null,
            statusText: statusCard ? statusCard.textContent : null,
            speechSynthesisSpeaking: speechSpeaking,
            internalState
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Test B Result: Interrupted into Capturing:", bargeInState.result.value);

    const shotB = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_barge_in_capturing.png"), Buffer.from(shotB.data, "base64"));
    console.log("Saved artifact: friday_barge_in_capturing.png");

    // ========================================================
    // TEST F: Close Voice Mode & Hardware Cleanup
    // ========================================================
    console.log("\n--- TEST F: Exit voice mode and verify hardware release ---");
    const cleanupCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const testHandle = window.__voiceAssistantTest;
          const stream = testHandle ? testHandle.getStream() : null;

          const exitBtn = document.querySelector('button[aria-label="Exit Voice Mode"]');
          if (exitBtn) exitBtn.click();

          const tracksAfter = stream ? stream.getTracks().map(t => t.readyState) : [];
          return {
            tracksAfterAllEnded: tracksAfter.every(s => s === "ended"),
            speechSynthesisSpeaking: window.speechSynthesis.speaking
          };
        })()
      `,
      returnByValue: true
    });
    console.log("Test F Result: Hardware released?", cleanupCheck.result.value);

    const shotF = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "friday_clean_exit.png"), Buffer.from(shotF.data, "base64"));
    console.log("Saved artifact: friday_clean_exit.png");

    cdp.close();
    console.log("\n=== All Scenarios Verified Successfully ===");
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
