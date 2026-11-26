const http = require('http');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9232;
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
  console.log("=== Testing Real SpeechRecognition Network Errors & Languages ===");
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
    await delay(1500);

    const testRuns = await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          const logs = [];

          function runTest(lang, options = {}) {
            return new Promise((resolve) => {
              const rec = new SR();
              rec.lang = lang;
              if (options.processLocally) rec.processLocally = true;
              rec.continuous = false;
              rec.interimResults = true;

              const result = { lang, options, events: [] };
              rec.onstart = () => result.events.push('onstart');
              rec.onaudiostart = () => result.events.push('onaudiostart');
              rec.onsoundstart = () => result.events.push('onsoundstart');
              rec.onspeechstart = () => result.events.push('onspeechstart');
              rec.onresult = (e) => result.events.push({ result: e.results[0][0].transcript });
              rec.onerror = (e) => result.events.push({ error: e.error, message: e.message });
              rec.onend = () => {
                result.events.push('onend');
                resolve(result);
              };

              try {
                rec.start();
                setTimeout(() => {
                  try { rec.abort(); } catch {}
                  resolve(result);
                }, 3000);
              } catch (err) {
                result.startError = err.message;
                resolve(result);
              }
            });
          }

          const t1 = await runTest('en-IN');
          const t2 = await runTest('en-US');
          const t3 = await runTest('en-US', { processLocally: true });
          const t4 = await runTest('');

          return [t1, t2, t3, t4];
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("Recognition Test Runs:", JSON.stringify(testRuns.result.value, null, 2));
    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
