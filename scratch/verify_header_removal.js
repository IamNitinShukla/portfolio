const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3000;
const CDP_PORT = 9225;
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
  console.log("Launching Chrome CDP on port", CDP_PORT);
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

    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Runtime.enable");

    await delay(2500);

    // Open Friday assistant dialog by clicking the mascot button
    console.log("Clicking mascot button...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-testid="mascot-assistant-trigger"]')?.click();`,
    });

    await delay(1200);

    // Verify DOM: header, title, subtitle, status dot should NOT exist
    const domCheck = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const header = document.querySelector('header');
          const statusDot = document.querySelector('[class*="statusDot"]');
          const headerTitle = document.querySelector('header h2, [class*="headerTitle"]');
          const headerSubtitle = document.querySelector('[class*="headerSubtitle"]');
          const closeBtn = document.querySelector('button[aria-label*="Close Friday"]');
          const conversation = document.querySelector('[class*="conversation"]');
          
          return {
            hasHeader: !!header,
            hasStatusDot: !!statusDot,
            hasHeaderTitle: !!headerTitle,
            hasHeaderSubtitle: !!headerSubtitle,
            hasCloseBtn: !!closeBtn,
            closeBtnStyles: closeBtn ? {
              position: window.getComputedStyle(closeBtn).position,
              top: window.getComputedStyle(closeBtn).top,
              right: window.getComputedStyle(closeBtn).right
            } : null,
            conversationPaddingTop: conversation ? window.getComputedStyle(conversation).paddingTop : null
          };
        })()
      `,
      returnByValue: true,
    });

    console.log("DOM Header Removal Check:", JSON.stringify(domCheck.result.value, null, 2));

    // Capture Desktop Screenshot
    const deskShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const deskPath = `${ARTIFACT_DIR}\\friday_headerless_desktop.png`;
    fs.writeFileSync(deskPath, Buffer.from(deskShot.data, "base64"));
    console.log("Desktop screenshot saved:", deskPath);

    // Resize viewport for Mobile test (390 x 844)
    console.log("Testing mobile viewport 390x844...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await delay(800);

    const mobileShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const mobilePath = `${ARTIFACT_DIR}\\friday_headerless_mobile.png`;
    fs.writeFileSync(mobilePath, Buffer.from(mobileShot.data, "base64"));
    console.log("Mobile screenshot saved:", mobilePath);

    // Test clicking close button to ensure dismissing still works seamlessly
    console.log("Testing close button click...");
    const closeResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const closeBtn = document.querySelector('button[aria-label*="Close Friday"]');
          if (closeBtn) {
            closeBtn.click();
            return 'CLICKED';
          }
          return 'NOT_FOUND';
        })()
      `,
      returnByValue: true,
    });
    console.log("Close button test result:", closeResult.result.value);

    await delay(600);

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(console.error);
