const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3001;

function checkPort(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(true);
    }).on("error", () => resolve(false));
  });
}

function checkHttp(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9222/json", (res) => {
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

  let chromeProc = null;
  const chromeRunning = await checkPort(9222);
  if (!chromeRunning) {
    const chromePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    const chromePath = chromePaths.find(p => p && fs.existsSync(p));
    if (!chromePath) throw new Error("Chrome not found");
    chromeProc = spawn(chromePath, [
      "--remote-debugging-port=9222",
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "about:blank"
    ]);
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      if (await checkPort(9222)) break;
    }
  }

  const targets = await getCdpTargets();
  const pageTarget = targets.find(t => t.type === "page");
  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // ==========================================
  // FRESH LIGHT THEME TEST (Initial Welcome with 4 quick buttons)
  // ==========================================
  console.log("Loading fresh LIGHT mode...");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "light");
    `
  });

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}` });
  await sleep(2500);

  // Open dialog
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const trigger = document.querySelector('[data-testid="mascot-assistant-trigger"]');
        if (trigger) trigger.click();
      })()
    `
  });
  await sleep(1000);

  // Capture fresh light theme welcome state
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "asst_refine_03_light_desktop.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved updated asst_refine_03_light_desktop.png (initial welcome with 4 buttons)");

  // Click Tech stack button to capture conversation response
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('dialog button'));
        const techBtn = btns.find(b => b.innerText.includes('Tech stack'));
        if (techBtn) techBtn.click();
      })()
    `
  });
  await sleep(800);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "asst_refine_04_light_conversation.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved updated asst_refine_04_light_conversation.png");

  cdp.close();
  try { serverProc.kill(); } catch (e) {}
  if (chromeProc) {
    try { chromeProc.kill(); } catch (e) {}
  }
  console.log("Light theme re-verification complete!");
}

run().catch(console.error);
