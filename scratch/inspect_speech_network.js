const http = require('http');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9238;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + CDP_PORT + '/json', (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
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
  console.log("=== Inspecting SpeechRecognition Network Traffic and Error Codes ===");
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
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
    await cdp.send("Network.enable");

    // Capture network requests
    await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          const details = [];

          function testRec(lang) {
            return new Promise((resolve) => {
              const rec = new SR();
              rec.lang = lang;
              rec.continuous = false;
              rec.interimResults = false;

              const run = { lang, events: [] };
              rec.onstart = () => run.events.push('onstart');
              rec.onaudiostart = () => run.events.push('onaudiostart');
              rec.onsoundstart = () => run.events.push('onsoundstart');
              rec.onspeechstart = () => run.events.push('onspeechstart');
              rec.onspeechend = () => run.events.push('onspeechend');
              rec.onsoundend = () => run.events.push('onsoundend');
              rec.onaudioend = () => run.events.push('onaudioend');
              rec.onerror = (e) => run.events.push({ error: e.error, message: e.message });
              rec.onend = () => { run.events.push('onend'); resolve(run); };

              try {
                rec.start();
                setTimeout(() => {
                  try { rec.stop(); } catch {}
                }, 2000);
              } catch(e) {
                run.exception = e.message;
                resolve(run);
              }
            });
          }

          const r1 = await testRec('en-IN');
          const r2 = await testRec('en-US');
          return [r1, r2];
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    // Check CDP network logs or see if any HTTP requests were made to speech.googleapis.com
    console.log("Recognition run finished.");
    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
