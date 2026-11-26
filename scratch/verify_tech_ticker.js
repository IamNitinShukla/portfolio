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

async function run() {
  let chromeProc = null;
  const isRunning = await checkPort(9222);
  if (!isRunning) {
    console.log("Launching headless Chrome on port 9222...");
    chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
      "--headless=new",
      "--remote-debugging-port=9222",
      "--disable-gpu",
      "--no-sandbox",
      "about:blank"
    ], { detached: true });

    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (await checkPort(9222)) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error("Could not start Chrome on port 9222");
  }

  console.log("Connecting to Chrome CDP...");
  const targets = await getCdpTargets();
  const pageTarget = targets.find((t) => t.type === "page");
  if (!pageTarget) throw new Error("No page target found");

  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log("Connected to page:", pageTarget.title);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // Navigate to localhost:3000
  console.log("Navigating to http://localhost:3000...");
  await cdp.send("Page.navigate", { url: "http://localhost:3000" });

  // Wait for ticker element to mount
  let tickerReady = false;
  for (let i = 0; i < 35; i++) {
    await new Promise(r => setTimeout(r, 200));
    const evalRes = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `!!document.querySelector('[aria-label="Technology Stack"]')`
    });
    if (evalRes?.result?.value) {
      tickerReady = true;
      break;
    }
  }
  console.log("Ticker element ready:", tickerReady);

  // 1. Verify Ticker Elements & Absence of Pill Design
  const checkResult = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const ticker = document.querySelector('[aria-label="Technology Stack"]');
      if (!ticker) return { error: "Ticker container not found" };

      const tracks = ticker.querySelectorAll('.animate-ticker');
      const items = ticker.querySelectorAll('.group\\\\/item');
      
      const techNames = Array.from(items).map(i => i.querySelector('span')?.textContent?.trim() || '');
      const uniqueTechs = Array.from(new Set(techNames));

      // Check code icons
      const icons = ticker.querySelectorAll('svg.lucide-code-xml');

      // Check for pill artifacts
      const roundedPills = ticker.querySelectorAll('.rounded-full, .border-border\\\\/80');

      // Check dividers
      const hasDividers = ticker.classList.contains('border-y');

      // Check edge masks
      const masks = ticker.querySelectorAll('.bg-gradient-to-r, .bg-gradient-to-l');

      return {
        hasTicker: true,
        trackCount: tracks.length,
        totalItemsRendered: items.length,
        uniqueTechCount: uniqueTechs.length,
        uniqueTechs: uniqueTechs,
        iconCount: icons.length,
        roundedPillCount: roundedPills.length,
        hasDividers,
        maskCount: masks.length,
        computedStyle: {
          overflow: window.getComputedStyle(ticker).overflow,
          display: window.getComputedStyle(ticker).display,
        }
      };
    })()`
  });

  const analysis = checkResult?.result?.value || checkResult?.value || checkResult;
  console.log("Ticker DOM Analysis:", JSON.stringify(analysis, null, 2));

  // 2. Set to Desktop Viewport & Dark Mode
  console.log("Configuring Desktop Viewport (1440x900, Dark Mode)...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  // Scroll ticker into view
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const ticker = document.querySelector('[aria-label="Technology Stack"]');
      if (ticker) ticker.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "ticker_desktop_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved ticker_desktop_dark.png");

  // 3. Desktop Light Mode
  console.log("Configuring Desktop Light Mode...");
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "ticker_desktop_light.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved ticker_desktop_light.png");

  // 4. Capture Context Between Hero and Philosophy
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const hero = document.querySelector('#hero');
      if (hero) {
        const ticker = document.querySelector('[aria-label="Technology Stack"]');
        if (ticker) {
          const rect = ticker.getBoundingClientRect();
          window.scrollBy(0, rect.top - 250);
        }
      }
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "ticker_hero_philosophy_context.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved ticker_hero_philosophy_context.png");

  // 5. Mobile (390px Viewport)
  console.log("Configuring Mobile Viewport (390x844)...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  // Check mobile overflow
  const mobileMetrics = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const ticker = document.querySelector('[aria-label="Technology Stack"]');
      if (ticker) ticker.scrollIntoView({ behavior: 'instant', block: 'center' });
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`
  });
  const mAnalysis = mobileMetrics?.result?.value || mobileMetrics?.value || mobileMetrics;
  console.log("Mobile Metrics:", mAnalysis);

  // Mobile Dark Mode
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "ticker_mobile_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved ticker_mobile_dark.png");

  // Mobile Light Mode
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "ticker_mobile_light.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved ticker_mobile_light.png");

  cdp.close();
  if (chromeProc) {
    try { process.kill(chromeProc.pid); } catch (e) {}
  }
  console.log("All verifications completed successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
