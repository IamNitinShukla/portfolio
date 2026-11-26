const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ARTIFACT_PATH = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\friday_welcome_verified.png";
const PORT = 3000;
const CDP_PORT = 9223;
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
  console.log("Launching headless Chrome on port", CDP_PORT);
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
    while (!connected && attempts < 20) {
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
    console.log("Connected to CDP!");

    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    // Wait for Next.js page load
    await delay(2500);

    // Open Friday assistant dialog by clicking the mascot button
    console.log("Clicking mascot trigger...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const btn = document.querySelector('button[data-testid="mascot-assistant-trigger"]');
          if (btn) { btn.click(); return 'CLICKED'; }
          return 'NOT_FOUND';
        })()
      `,
    });

    // Wait for dialog entrance animation to complete
    await delay(1500);

    // Inspect dialogue title and greeting text in DOM
    const inspectResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const title = document.querySelector('header h2')?.textContent;
          const welcomeMsg = document.querySelector('div[class*="welcomeBody"]')?.textContent;
          return { title, welcomeMsg };
        })()
      `,
      returnByValue: true
    });

    console.log("DOM Inspection Result:", inspectResult.result?.value);

    // Capture screenshot of the viewport
    console.log("Capturing screenshot...");
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
    });

    fs.writeFileSync(ARTIFACT_PATH, Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot written to:", ARTIFACT_PATH);

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
