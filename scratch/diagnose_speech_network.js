const http = require('http');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9229;
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
  console.log("=== Diagnosing SpeechRecognition Network Failure ===");
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

    await delay(2000);

    // 1. Inspect Browser Environment & APIs
    console.log("\n1. Inspecting Browser Environment & APIs:");
    const envInfo = await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          let micPermission = 'unknown';
          try {
            const p = await navigator.permissions.query({ name: 'microphone' });
            micPermission = p.state;
          } catch (e) {
            micPermission = 'error: ' + e.message;
          }

          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

          return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            isOnline: navigator.onLine,
            isSecureContext: window.isSecureContext,
            protocol: window.location.protocol,
            host: window.location.host,
            micPermission,
            hasSpeechRecognition: !!window.SpeechRecognition,
            hasWebkitSpeechRecognition: !!window.webkitSpeechRecognition,
            // Check for on-device recognition API properties
            processLocallyOnProto: SR ? 'processLocally' in SR.prototype : false,
            availableOnSR: SR ? typeof SR.available === 'function' : false,
            installOnSR: SR ? typeof SR.install === 'function' : false,
            srProperties: SR ? Object.getOwnPropertyNames(SR) : [],
            srProtoProperties: SR ? Object.getOwnPropertyNames(SR.prototype) : [],
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(JSON.stringify(envInfo.result.value, null, 2));

    // 2. Test Real SpeechRecognition in Chrome with Different Languages
    console.log("\n2. Testing Real SpeechRecognition with different language configurations:");
    const testResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SR) return { supported: false };

          function testLang(lang) {
            return new Promise((resolve) => {
              const rec = new SR();
              rec.lang = lang;
              rec.continuous = false;
              rec.interimResults = true;

              const events = [];
              rec.onstart = () => events.push('onstart');
              rec.onaudiostart = () => events.push('onaudiostart');
              rec.onsoundstart = () => events.push('onsoundstart');
              rec.onspeechstart = () => events.push('onspeechstart');
              rec.onresult = (e) => events.push('onresult: ' + e.results[0][0].transcript);
              rec.onerror = (e) => {
                events.push({ error: e.error, message: e.message });
              };
              rec.onend = () => {
                events.push('onend');
                resolve({ lang, events });
              };

              try {
                rec.start();
                // Timeout after 4s
                setTimeout(() => {
                  try { rec.abort(); } catch {}
                  resolve({ lang, events, timedOut: true });
                }, 4000);
              } catch (err) {
                resolve({ lang, error: err.message, name: err.name });
              }
            });
          }

          const resEnIN = await testLang('en-IN');
          const resEnUS = await testLang('en-US');
          const resDefault = await testLang(navigator.language || '');

          return { resEnIN, resEnUS, resDefault };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(JSON.stringify(testResult.result.value, null, 2));

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
