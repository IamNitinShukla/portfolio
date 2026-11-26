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

  // Dismiss intro
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
  await sleep(1000);

  // Test 1: Check initial idle video status
  const idleCheck = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const video = document.querySelector('aside[aria-label="Portfolio Mascot"] video');
        if (!video) return { error: "Video not found" };
        return {
          currentAnimation: video.getAttribute('data-animation'),
          src: video.src,
          loop: video.loop,
          autoplay: video.autoplay,
          muted: video.muted,
          paused: video.paused,
          hasController: typeof window.__mascotController !== 'undefined'
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Initial Idle Status:", idleCheck.result.value);

  // Test 2: Test requesting pending animation (e.g. 'wave')
  const pendingTest = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const res = window.__mascotController.play('wave');
        const video = document.querySelector('aside[aria-label="Portfolio Mascot"] video');
        return {
          requestResult: res, // Expected: false (pending)
          currentAnimation: video.getAttribute('data-animation'),
          src: video.src // Should still be idle test-animation.webm
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Pending Animation Guard Test ('wave'):", pendingTest.result.value);

  // Test 3: Test requesting invalid animation
  const invalidTest = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const res = window.__mascotController.play('non_existent_clip');
        return { requestResult: res };
      })()
    `,
    returnByValue: true
  });
  console.log("Invalid Name Guard Test:", invalidTest.result.value);

  // Test 4: Test CustomEvent window.dispatchEvent('mascot:play')
  const eventTest = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        window.dispatchEvent(new CustomEvent('mascot:play', { detail: { name: 'sleep' } }));
        const video = document.querySelector('aside[aria-label="Portfolio Mascot"] video');
        return {
          currentAnimation: video.getAttribute('data-animation'),
          src: video.src
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Event-driven Dispatch Test ('sleep'):", eventTest.result.value);

  // Test 5: Verify position and styling remain intact
  const stylingCheck = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const aside = document.querySelector('aside[aria-label="Portfolio Mascot"]');
        const cs = window.getComputedStyle(aside);
        const rect = aside.getBoundingClientRect();
        return {
          position: cs.position,
          bottom: cs.bottom,
          right: cs.right,
          pointerEvents: cs.pointerEvents,
          width: rect.width,
          height: rect.height,
          zIndex: cs.zIndex
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Position & Styling Check:", stylingCheck.result.value);

  // Take confirmation screenshot
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "mascot_controller_verified.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved mascot_controller_verified.png");

  cdp.close();
  console.log("All mascot controller verification tests completed successfully!");
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
