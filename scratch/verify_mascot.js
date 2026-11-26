const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";

function checkPort(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(true);
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
  console.log("Checking CDP target on 9222...");
  const isRunning = await checkPort(9222);
  if (!isRunning) {
    console.log("Launching Chrome...");
    spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
      "--headless=new",
      "--remote-debugging-port=9222",
      "--disable-gpu",
      "--no-sandbox",
      "about:blank"
    ], { detached: true });
    await sleep(2000);
  }

  const targets = await getCdpTargets();
  const pageTarget = targets.find(t => t.type === "page");
  if (!pageTarget) throw new Error("No page target found");

  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log("Connected to CDP!");

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");

  // Desktop Viewport (1440x900)
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log("Navigating to http://127.0.0.1:3000...");
  await cdp.send("Page.navigate", { url: "http://127.0.0.1:3000" });
  await sleep(1500);

  // Dismiss intro by clicking Skip Intro or pressing Esc
  await cdp.send("Runtime.evaluate", {
    expression: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
      document.documentElement.classList.add('dark');
      const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Skip Intro'));
      if (skipBtn) skipBtn.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `
  });
  await sleep(1200);

  // Capture Desktop Screenshot
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "mascot_01_desktop.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved mascot_01_desktop.png");

  // Capture Desktop Light Mode
  console.log("Testing Light Mode...");
  await cdp.send("Runtime.evaluate", {
    expression: `
      document.documentElement.classList.remove('dark');
      localStorage.setItem('portfolio-theme', 'light');
    `
  });
  await sleep(500);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "mascot_03_desktop_light.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved mascot_03_desktop_light.png");

  // Restore Dark Mode
  await cdp.send("Runtime.evaluate", {
    expression: `
      document.documentElement.classList.add('dark');
      localStorage.setItem('portfolio-theme', 'dark');
    `
  });
  await sleep(300);

  cdp.close();
  console.log("Verification completed successfully!");
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
