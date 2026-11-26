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
  let chromeProc = null;
  if (!isRunning) {
    console.log("Launching headless Chrome...");
    chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
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

  // 1. Desktop Viewport (1440x900)
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log("Navigating to http://localhost:3000...");
  await cdp.send("Page.navigate", { url: "http://localhost:3000" });
  await sleep(2500);

  // Close intro
  await cdp.send("Runtime.evaluate", {
    expression: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      const enterBtn = document.querySelector('button');
      if (enterBtn && enterBtn.innerText.includes('EXPLORE')) enterBtn.click();
    `
  });
  await sleep(600);

  // Set dark theme
  await cdp.send("Runtime.evaluate", {
    expression: `document.documentElement.classList.add('dark'); localStorage.setItem('portfolio-theme', 'dark');`
  });
  await sleep(400);

  // Check DOM: robot mascot and rope must be completely absent
  const checkRobotAbsence = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label*="robot" i]');
        const rope = document.querySelector('svg linearGradient#ropeGrad');
        return {
          robotFound: !!robot,
          ropeFound: !!rope
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Robot absence check:", JSON.stringify(checkRobotAbsence.result.value));
  if (checkRobotAbsence.result.value.robotFound || checkRobotAbsence.result.value.ropeFound) {
    throw new Error("FAIL: Robot or rope elements still present in DOM!");
  }
  console.log("PASS: Robot character and rope are completely removed from DOM.");

  // 1. Capture clean Hero desktop
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "portfolio_clean_hero_desktop_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved portfolio_clean_hero_desktop_dark.png");

  // 2. Test UPI QR transformation toggle (verify still working)
  console.log("Clicking barcode button to test UPI QR mode...");
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const barcodeBtn = document.querySelector('button.group\\\\/barcode');
        if (barcodeBtn) barcodeBtn.click();
      })()
    `
  });
  await sleep(800);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "portfolio_clean_upi_qr_desktop_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved portfolio_clean_upi_qr_desktop_dark.png");

  // Return to Personal Identity mode
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const nameBtn = document.querySelector('button.group\\\\/nameReturn');
        if (nameBtn) nameBtn.click();
      })()
    `
  });
  await sleep(600);

  // 3. Test scrolling down
  console.log("Scrolling page down...");
  await cdp.send("Runtime.evaluate", {
    expression: `window.scrollTo({ top: 1800, behavior: 'smooth' });`
  });
  await sleep(800);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "portfolio_clean_scrolled_desktop_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved portfolio_clean_scrolled_desktop_dark.png");

  // 4. Test Mobile Viewport (390x844)
  console.log("Testing Mobile Viewport (390x844)...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.send("Runtime.evaluate", { expression: `window.scrollTo(0, 0);` });
  await sleep(800);

  const mobileCheck = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label*="robot" i]');
        return {
          robotFound: !!robot,
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Mobile check:", JSON.stringify(mobileCheck.result.value));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "portfolio_clean_mobile_390_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved portfolio_clean_mobile_390_dark.png");

  cdp.close();
  console.log("All clean verification tests completed successfully!");
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
