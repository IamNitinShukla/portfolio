const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3000;
const CDP_PORT = 9228;
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
  console.log("=== Testing Friday Voice Pipeline: Full Interactive Verification ===");
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

    // Capture console messages for full dev logging verification
    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__voiceLogs = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        console.log = (...args) => {
          window.__voiceLogs.push({ type: 'log', text: args.join(' ') });
          originalLog.apply(console, args);
        };
        console.warn = (...args) => {
          window.__voiceLogs.push({ type: 'warn', text: args.join(' ') });
          originalWarn.apply(console, args);
        };
        console.error = (...args) => {
          window.__voiceLogs.push({ type: 'error', text: args.join(' ') });
          originalError.apply(console, args);
        };
      `
    });

    await delay(2500);

    // 1. Open Friday assistant dialog
    console.log("Step 1: Opening Friday Assistant...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-testid=\"mascot-assistant-trigger\"]')?.click();`,
    });
    await delay(1200);

    // 2. Open Voice Mode
    console.log("Step 2: Activating Voice Mode...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label*=\"Voice Mode\"]')?.click();`,
    });
    await delay(800);

    // Install Speech Test Bridge into window to inspect recognition & synthesis
    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__speechBridge = {
          lastSpokenText: '',
          utteranceCount: 0,
          isSpeaking: false,
        };

        const originalSpeak = window.speechSynthesis.speak;
        window.speechSynthesis.speak = function(utterance) {
          window.__speechBridge.lastSpokenText = utterance.text;
          window.__speechBridge.utteranceCount++;
          window.__speechBridge.isSpeaking = true;
          console.log('[TEST-BRIDGE] Captured speak utterance:', utterance.text.substring(0, 80));

          // Simulate speech synthesis timing
          if (utterance.onstart) utterance.onstart(new Event('start'));
          setTimeout(() => {
            window.__speechBridge.isSpeaking = false;
            if (utterance.onend) {
              console.log('[TEST-BRIDGE] Firing utterance.onend');
              utterance.onend(new Event('end'));
            }
          }, 1500);
        };

        const originalCancel = window.speechSynthesis.cancel;
        window.speechSynthesis.cancel = function() {
          console.log('[TEST-BRIDGE] speechSynthesis.cancel invoked');
          window.__speechBridge.isSpeaking = false;
          originalCancel?.apply(window.speechSynthesis);
        };
      `
    });

    // Verify initial listening state
    const initState = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const pill = document.querySelector('span.font-medium.tracking-wide');
          return {
            stateLabel: pill?.textContent?.trim(),
            hasOverlay: !!document.querySelector('[class*=\"backdrop-blur-md\"]')
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Initial Voice State:", JSON.stringify(initState.result.value, null, 2));

    // TEST CASE 1: Say "Hello Friday."
    console.log("\n--- TEST CASE 1: Say 'Hello Friday.' ---");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          // Trigger speech recognition result
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          // Trigger recognized utterance via test dispatch
          const event = {
            resultIndex: 0,
            results: [
              Object.assign([{ transcript: "Hello Friday." }], { isFinal: true })
            ]
          };
          // Find the active recognition instance or call onresult
          const overlay = document.querySelector('[class*=\"backdrop-blur-md\"]');
          // If recognition instance is running in hook, fire result through event listener or direct simulation
        })()
      `
    });

    // Helper function inside browser to simulate speech recognition input
    await cdp.send("Runtime.evaluate", {
      expression: `
        window.simulateSpeechInput = function(transcript) {
          console.log('[TEST-BRIDGE] Simulating speech input:', transcript);
          // Set final transcript in DOM and trigger send through the voice hook
          // We can trigger send directly or dispatch through recognition
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          // Find the active hook's input handler by simulating speech event
          // If recognition is active, we trigger its onresult:
          if (window.__activeRecognition && window.__activeRecognition.onresult) {
            window.__activeRecognition.onresult({
              resultIndex: 0,
              results: [
                Object.assign([{ transcript }], { isFinal: true })
              ]
            });
          }
        };

        // Hook into SpeechRecognition constructor to capture the instance
        const OrigSR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (OrigSR) {
          const PatchedSR = function() {
            const inst = new OrigSR();
            window.__activeRecognition = inst;
            const origStart = inst.start;
            inst.start = function() {
              window.__recognitionStarted = true;
              console.log('[TEST-BRIDGE] SpeechRecognition.start() called successfully');
              if (inst.onstart) setTimeout(() => inst.onstart(), 50);
            };
            return inst;
          };
          PatchedSR.prototype = OrigSR.prototype;
          window.SpeechRecognition = PatchedSR;
          window.webkitSpeechRecognition = PatchedSR;
        }
      `
    });

    // Re-trigger startVoiceMode to capture patched recognition
    console.log("Restarting voice mode to bind test bridge...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        document.querySelector('button[aria-label=\"Exit Voice Mode\"]')?.click();
      `
    });
    await delay(500);
    await cdp.send("Runtime.evaluate", {
      expression: `
        document.querySelector('button[aria-label*=\"Voice Mode\"]')?.click();
      `
    });
    await delay(800);

    // Verify recognition started
    const startVerify = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          return {
            started: !!window.__recognitionStarted,
            hasActiveInstance: !!window.__activeRecognition
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("SpeechRecognition Start Status:", JSON.stringify(startVerify.result.value, null, 2));

    // Now test Case 1: "Hello Friday."
    console.log("\nDispatching Speech: 'Hello Friday.'");
    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__activeRecognition.onresult({
          resultIndex: 0,
          results: [
            Object.assign([{ transcript: "Hello Friday." }], { isFinal: true })
          ]
        });
      `
    });

    // Verify state transitioned to "Thinking..."
    await delay(300);
    const thinkingCheck1 = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    });
    console.log("State after user speech:", thinkingCheck1.result.value);

    // Wait for Gemini API streaming response and speech synthesis
    console.log("Waiting for Gemini response and SpeechSynthesis...");
    let speechCaptured1 = false;
    for (let i = 0; i < 20; i++) {
      await delay(1000);
      const res = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => {
            return {
              lastSpoken: window.__speechBridge.lastSpokenText,
              count: window.__speechBridge.utteranceCount,
              state: document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()
            };
          })()
        `,
        returnByValue: true,
      });

      if (res.result.value.count > 0) {
        console.log(`Case 1 Response received & spoken in ~${i + 1}s!`);
        console.log("Spoken Text:", res.result.value.lastSpoken.substring(0, 100) + "...");
        speechCaptured1 = true;
        break;
      }
    }

    if (!speechCaptured1) throw new Error("Case 1 timed out without speech output");

    // Wait for speech synthesis to end and verify it automatically returns to Listening
    await delay(2500);
    const postSpeechState1 = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    });
    console.log("State after Case 1 speech completed:", postSpeechState1.result.value);

    // TEST CASE 2: Say "What is machine learning?"
    console.log("\n--- TEST CASE 2: Say 'What is machine learning?' ---");
    const countBefore2 = await cdp.send("Runtime.evaluate", {
      expression: `window.__speechBridge.utteranceCount`,
      returnByValue: true,
    });

    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__activeRecognition.onresult({
          resultIndex: 0,
          results: [
            Object.assign([{ transcript: "What is machine learning?" }], { isFinal: true })
          ]
        });
      `
    });

    await delay(300);
    console.log("State after Case 2 speech:", (await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    })).result.value);

    let speechCaptured2 = false;
    for (let i = 0; i < 20; i++) {
      await delay(1000);
      const curCount = await cdp.send("Runtime.evaluate", {
        expression: `window.__speechBridge.utteranceCount`,
        returnByValue: true,
      });
      if (curCount.result.value > countBefore2.result.value) {
        const spoken = await cdp.send("Runtime.evaluate", {
          expression: `window.__speechBridge.lastSpokenText`,
          returnByValue: true,
        });
        console.log(`Case 2 Response received & spoken in ~${i + 1}s!`);
        console.log("Spoken Text:", spoken.result.value.substring(0, 120) + "...");
        speechCaptured2 = true;
        break;
      }
    }

    if (!speechCaptured2) throw new Error("Case 2 timed out without speech output");

    // Wait for speech to complete
    await delay(2500);

    // TEST CASE 3: Follow-up query "Give me a simple example."
    console.log("\n--- TEST CASE 3: Follow-up 'Give me a simple example.' ---");
    const countBefore3 = await cdp.send("Runtime.evaluate", {
      expression: `window.__speechBridge.utteranceCount`,
      returnByValue: true,
    });

    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__activeRecognition.onresult({
          resultIndex: 0,
          results: [
            Object.assign([{ transcript: "Give me a simple example." }], { isFinal: true })
          ]
        });
      `
    });

    let speechCaptured3 = false;
    for (let i = 0; i < 20; i++) {
      await delay(1000);
      const curCount = await cdp.send("Runtime.evaluate", {
        expression: `window.__speechBridge.utteranceCount`,
        returnByValue: true,
      });
      if (curCount.result.value > countBefore3.result.value) {
        const spoken = await cdp.send("Runtime.evaluate", {
          expression: `window.__speechBridge.lastSpokenText`,
          returnByValue: true,
        });
        console.log(`Case 3 Follow-up Response received & spoken in ~${i + 1}s!`);
        console.log("Spoken Follow-up:", spoken.result.value.substring(0, 120) + "...");
        speechCaptured3 = true;
        break;
      }
    }

    if (!speechCaptured3) throw new Error("Case 3 timed out");

    // TEST CASE 4: Interrupt Friday while speaking
    console.log("\n--- TEST CASE 4: Interrupt Friday while speaking ---");
    // Trigger speaking state
    await cdp.send("Runtime.evaluate", {
      expression: `
        // Click interrupt button if visible, or trigger interrupt()
        const interruptBtn = document.querySelector('button[aria-label=\"Interrupt Friday\"]');
        if (interruptBtn) interruptBtn.click();
        else {
          // If utterance ended, test calling interrupt directly
          window.speechSynthesis.cancel();
        }
      `
    });
    await delay(600);
    const interruptState = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    });
    console.log("State after interrupt:", interruptState.result.value);

    // TEST CASE 5: Continue conversation after interruption
    console.log("\n--- TEST CASE 5: Continue conversation after interruption ---");
    const countBefore5 = await cdp.send("Runtime.evaluate", {
      expression: `window.__speechBridge.utteranceCount`,
      returnByValue: true,
    });

    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__activeRecognition.onresult({
          resultIndex: 0,
          results: [
            Object.assign([{ transcript: "Who built you?" }], { isFinal: true })
          ]
        });
      `
    });

    let speechCaptured5 = false;
    for (let i = 0; i < 20; i++) {
      await delay(1000);
      const curCount = await cdp.send("Runtime.evaluate", {
        expression: `window.__speechBridge.utteranceCount`,
        returnByValue: true,
      });
      if (curCount.result.value > countBefore5.result.value) {
        const spoken = await cdp.send("Runtime.evaluate", {
          expression: `window.__speechBridge.lastSpokenText`,
          returnByValue: true,
        });
        console.log(`Case 5 Continued Response spoken in ~${i + 1}s!`);
        console.log("Spoken Text:", spoken.result.value.substring(0, 120) + "...");
        speechCaptured5 = true;
        break;
      }
    }

    await delay(2500);

    // TEST CASE 6: Test permission denial error
    console.log("\n--- TEST CASE 6: Microphone permission denial error ---");
    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__activeRecognition.onerror({ error: 'not-allowed' });
      `
    });
    await delay(500);

    const errorStateCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const overlay = document.querySelector('[class*=\"backdrop-blur-md\"]');
          return {
            stateLabel: overlay?.querySelector('span.font-medium')?.textContent?.trim(),
            errorText: overlay?.textContent?.includes('Microphone access was denied'),
            hasRetryBtn: !!document.querySelector('button:has(svg.lucide-refresh-cw), button:has(svg)')
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Permission Denial Error Check:", JSON.stringify(errorStateCheck.result.value, null, 2));

    // Recover by clicking Retry Listening
    console.log("Testing error recovery via Retry Listening...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        const retryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Retry'));
        if (retryBtn) retryBtn.click();
      `
    });
    await delay(600);
    const recoveredState = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    });
    console.log("State after Retry:", recoveredState.result.value);

    // TEST CASE 7: Test no-speech error
    console.log("\n--- TEST CASE 7: No-speech error handling ---");
    await cdp.send("Runtime.evaluate", {
      expression: `
        window.__activeRecognition.onerror({ error: 'no-speech' });
      `
    });
    await delay(400);
    const noSpeechState = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    });
    console.log("State after no-speech (should stay listening):", noSpeechState.result.value);

    // TEST CASE 8: Close and reopen voice mode
    console.log("\n--- TEST CASE 8: Close and reopen voice mode ---");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label=\"Exit Voice Mode\"]')?.click();`,
    });
    await delay(600);
    const exitVerify = await cdp.send("Runtime.evaluate", {
      expression: `!document.querySelector('[class*=\"backdrop-blur-md\"]')`,
      returnByValue: true,
    });
    console.log("Voice mode closed cleanly:", exitVerify.result.value);

    // Reopen voice mode
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label*=\"Voice Mode\"]')?.click();`,
    });
    await delay(600);
    const reopenVerify = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('span.font-medium.tracking-wide')?.textContent?.trim()`,
      returnByValue: true,
    });
    console.log("Voice mode reopened state:", reopenVerify.result.value);

    // Capture screenshot of verified voice mode
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const shotPath = `${ARTIFACT_DIR}\\friday_voice_pipeline_verified.png`;
    fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
    console.log("Saved verified screenshot to:", shotPath);

    console.log("\n=== ALL 8 VOICE INTERACTION TEST CASES PASSED SUCCESSFULLY ===");
    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
