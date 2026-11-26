const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9260;
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

async function runDiagnosis() {
  console.log("=== Launching Chrome with Structured Diagnostic Telemetry ===");
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

    // Capture all console logs from the page in real-time
    cdp.ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === "Runtime.consoleAPICalled") {
          const text = msg.params.args.map((a) => a.value || JSON.stringify(a)).join(" ");
          if (text.includes("[DIAG_")) {
            console.log(text);
          }
        }
      } catch {}
    });

    console.log("Navigating to home and bypassing intro...");
    await delay(1500);

    await cdp.send("Runtime.evaluate", {
      expression: `
        sessionStorage.setItem("portfolio_intro_seen", "true");
        window.location.reload();
      `
    });

    await delay(2500);

    // 1. Open Friday assistant dialog
    console.log("\n[DIAGNOSTIC TEST 1] Opening Friday dialog...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        const btn = document.querySelector('button[data-testid="mascot-assistant-trigger"]');
        if (btn) btn.click();
      `
    });

    await delay(1200);

    // 2. Open Voice Mode
    console.log("[DIAGNOSTIC TEST 2] Activating Voice Mode (Microphone Stream Acquisition)...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        const micBtn = document.querySelector('button[title="Voice Mode"]') || document.querySelector('button[aria-label="Start Voice Mode"]');
        if (micBtn) micBtn.click();
      `
    });

    await delay(1500);

    // Inspect active audio tracks & hardware settings
    const trackDiag = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const handle = window.__voiceAssistantTest;
          const stream = handle ? handle.getStream() : null;
          const track = stream ? stream.getAudioTracks()[0] : null;
          return {
            trackFound: !!track,
            label: track ? track.label : null,
            settings: track && track.getSettings ? track.getSettings() : null,
            constraints: track && track.getConstraints ? track.getConstraints() : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log("\n--- Microphone Stream & Hardware Inspection ---");
    console.log(JSON.stringify(trackDiag.result.value, null, 2));

    // 3. Submit question to trigger Gemini and Assistant Speech
    console.log("\n[DIAGNOSTIC TEST 3] Submitting query to trigger Friday speech synthesis...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const input = document.querySelector('input[placeholder*="type question"]');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            setter.call(input, "Explain in detail how Nitin built LexGenAI and what technologies were involved");
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const submitBtn = document.querySelector('button[aria-label="Send typed query"]');
            if (submitBtn) submitBtn.click();
          }
        })()
      `
    });

    // Monitor for 8 seconds through thinking, speaking, and post-speaking
    console.log("\n--- Telemetry Logging Active (Observing Speaking Phase & VAD Feedback) ---");
    for (let i = 0; i < 20; i++) {
      await delay(400);
      const liveCheck = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => {
            const span = document.querySelector('span[data-testid="voice-state-label"]');
            const state = window.__voiceAssistantTest ? window.__voiceAssistantTest.getVoiceState() : null;
            const speaking = window.speechSynthesis.speaking;
            const audioLvl = window.__voiceAssistantTest ? window.__voiceAssistantTest.getAudioLevel() : 0;
            return {
              label: span ? span.textContent : null,
              state,
              speechSynthesisSpeaking: speaking,
              audioLevel: audioLvl
            };
          })()
        `,
        returnByValue: true
      });
      if (i % 3 === 0) {
        console.log(`[Turn Step ${i}] Status:`, liveCheck.result.value);
      }
    }

    // 4. Retrieve complete in-memory structured diagnostic logs
    console.log("\n--- Extracting All In-Memory Diagnostic Logs ---");
    const extractedLogs = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          return (window.__voiceDiagnosticLogs || []).map(entry => ({
            time: entry.timeStr,
            category: entry.category,
            message: entry.message,
            data: entry.data
          }));
        })()
      `,
      returnByValue: true
    });

    const logs = extractedLogs.result.value || [];
    console.log(`Total diagnostic entries collected: ${logs.length}`);

    // Categorize logs for inspection
    const ttsLogs = logs.filter(l => l.category === "TTS");
    const vadLogs = logs.filter(l => l.category === "VAD");
    const stateLogs = logs.filter(l => l.category === "STATE");
    const geminiLogs = logs.filter(l => l.category === "GEMINI");
    const recorderLogs = logs.filter(l => l.category === "RECORDER");

    console.log("\n=== TTS Lifecycle Events ===");
    console.log(JSON.stringify(ttsLogs, null, 2));

    console.log("\n=== State Machine Transitions ===");
    console.log(JSON.stringify(stateLogs, null, 2));

    console.log("\n=== VAD Events ===");
    console.log(JSON.stringify(vadLogs, null, 2));

    console.log("\n=== Recorder Events ===");
    console.log(JSON.stringify(recorderLogs, null, 2));

    console.log("\n=== Gemini Events ===");
    console.log(JSON.stringify(geminiLogs, null, 2));

    // Save diagnostic report artifact
    const diagnosticReport = {
      timestamp: new Date().toISOString(),
      microphoneSettings: trackDiag.result.value,
      ttsEvents: ttsLogs,
      stateTransitions: stateLogs,
      vadEvents: vadLogs,
      recorderEvents: recorderLogs,
      geminiEvents: geminiLogs,
      allLogs: logs
    };

    fs.writeFileSync(
      path.join(artifactDir, "voice_pipeline_diagnostic_dump.json"),
      JSON.stringify(diagnosticReport, null, 2)
    );
    console.log("\nSaved diagnostic dump to: voice_pipeline_diagnostic_dump.json");

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

runDiagnosis().catch(console.error);
