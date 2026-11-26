const http = require('http');
const { spawn } = require('child_process');

const PORT = 3000;
const CDP_PORT = 9230;
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

    const onDeviceCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          const results = {};

          try {
            results.availableEnUS = await SR.available({ langs: ['en-US'], processLocally: true });
          } catch (e) {
            results.availableEnUSErr = e.message;
          }

          try {
            results.availableEnIN = await SR.available({ langs: ['en-IN'], processLocally: true });
          } catch (e) {
            results.availableEnINErr = e.message;
          }

          try {
            results.availableEnUSGeneral = await SR.available({ langs: ['en-US'] });
          } catch (e) {
            results.availableEnUSGeneralErr = e.message;
          }

          // Check install method signature without actually calling it or see its properties
          results.hasInstall = typeof SR.install === 'function';

          // Test instantiation with processLocally = true
          try {
            const rec = new SR();
            rec.processLocally = true;
            rec.lang = 'en-US';
            results.processLocallyProperty = rec.processLocally;
          } catch (e) {
            results.processLocallyErr = e.message;
          }

          return results;
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("On-Device SpeechRecognition API Check:", JSON.stringify(onDeviceCheck.result.value, null, 2));

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
