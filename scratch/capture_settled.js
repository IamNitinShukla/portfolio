const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3001;

function checkHttp(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/`, (res) => resolve(res.statusCode === 200)).on("error", () => resolve(false));
  });
}

function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9222/json", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
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
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function run() {
  const serverProc = spawn("cmd.exe", ["/c", `npx next start -p ${PORT}`], {
    env: { ...process.env, PATH: `C:\\Program Files\\nodejs;${process.env.PATH}` },
    stdio: "pipe"
  });

  for (let i = 0; i < 40; i++) {
    await sleep(300);
    if (await checkHttp(PORT)) break;
  }

  const targets = await getCdpTargets();
  const pageTarget = targets.find(t => t.type === "page");
  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
    `
  });

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}` });
  await sleep(2000);

  // Click mascot trigger
  await cdp.send("Runtime.evaluate", {
    expression: `(() => { const t = document.querySelector('[data-testid="mascot-assistant-trigger"]'); if (t) t.click(); })()`
  });
  await sleep(800);

  // Click the 'Projects' quick button
  console.log("Clicking 'Projects' quick action...");
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('dialog button'));
        const prjBtn = btns.find(b => b.innerText.includes('Projects'));
        if (prjBtn) prjBtn.click();
      })()
    `
  });

  // Wait for stream to complete
  console.log("Waiting for full stream completion...");
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    const status = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const stopBtn = document.querySelector('dialog [title*="Stop"]');
          return { isStreaming: stopBtn !== null };
        })()
      `,
      returnByValue: true
    });
    if (!status.result.value?.isStreaming) {
      console.log(`Stream settled at attempt ${i}!`);
      break;
    }
  }

  await sleep(600);
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "gemini_response_settled.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved gemini_response_settled.png");

  cdp.close();
  try { serverProc.kill(); } catch (e) {}
}

run().catch(console.error);
