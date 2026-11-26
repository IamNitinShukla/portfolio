const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3000;
const CDP_PORT = 9235;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let data = ""; res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

class SimpleCDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 1; this.callbacks = new Map(); }
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
          if (parsed.error) reject(parsed.error); else resolve(parsed.result);
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
  close() { if (this.ws) this.ws.close(); }
}

async function main() {
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    `http://127.0.0.1:${PORT}`,
  ], { stdio: "ignore" });

  try {
    let connected = false, attempts = 0;
    while (!connected && attempts < 25) {
      await delay(400);
      try { await getCdpTargets(); connected = true; } catch { attempts++; }
    }
    const targets = await getCdpTargets();
    const cdp = new SimpleCDP(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // Hook SpeechRecognition so we have access to the instance
    await cdp.send("Runtime.evaluate", {
      expression: `
        const OrigSR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (OrigSR) {
          window.SpeechRecognition = function() {
            const inst = new OrigSR();
            window.__activeRecognition = inst;
            return inst;
          };
          window.SpeechRecognition.prototype = OrigSR.prototype;
          window.SpeechRecognition.available = OrigSR.available;
          window.SpeechRecognition.install = OrigSR.install;
          window.webkitSpeechRecognition = window.SpeechRecognition;
        }
      `
    });

    await delay(1000);

    // Open Friday
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-testid=\"mascot-assistant-trigger\"]')?.click();`,
    });
    await delay(1000);

    // Open Voice Mode
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label*=\"Voice Mode\"]')?.click();`,
    });
    await delay(1000);

    // Trigger network error on active recognition
    console.log("Triggering network error on recognition...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        if (window.__activeRecognition && window.__activeRecognition.onerror) {
          // Fire network error directly
          window.__activeRecognition.onerror({ error: 'network', message: 'net::ERR_CONNECTION_REFUSED' });
          setTimeout(() => {
            if (window.__activeRecognition && window.__activeRecognition.onerror) {
              window.__activeRecognition.onerror({ error: 'network', message: 'net::ERR_CONNECTION_REFUSED' });
            }
          }, 700);
          setTimeout(() => {
            if (window.__activeRecognition && window.__activeRecognition.onerror) {
              window.__activeRecognition.onerror({ error: 'network', message: 'net::ERR_CONNECTION_REFUSED' });
            }
          }, 1500);
        }
      `
    });

    await delay(2600);

    // Capture screenshot of the error notice UI
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const shotPath = `${ARTIFACT_DIR}\\friday_voice_network_error_ui.png`;
    fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
    console.log("Captured Network Error UI Screenshot:", shotPath);

    const errorUiCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const overlay = document.querySelector('[class*=\"backdrop-blur-md\"]');
          return {
            stateText: overlay?.querySelector('span.font-medium')?.textContent,
            errorNotice: overlay?.querySelector('.text-rose-300')?.textContent,
            buttons: Array.from(overlay?.querySelectorAll('button') || []).map(b => b.textContent.trim()).filter(Boolean),
            hasInputFallback: !!overlay?.querySelector('form input')
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Error UI DOM:", JSON.stringify(errorUiCheck.result.value, null, 2));

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
