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
  console.log("Checking CDP target on port 9222...");
  const isRunning = await checkPort(9222);
  let chromeProc = null;
  if (!isRunning) {
    console.log("Launching headless Chrome on 9222...");
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

  // ==========================================
  // PART 1: DESKTOP TESTING (1440 x 900)
  // ==========================================
  console.log("Setting Desktop viewport (1440x900)...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log("Navigating to http://localhost:3000...");
  await cdp.send("Page.navigate", { url: "http://localhost:3000" });
  await sleep(2500);

  // Close Intro if present
  await cdp.send("Runtime.evaluate", {
    expression: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      const enterBtn = document.querySelector('button');
      if (enterBtn && enterBtn.innerText.includes('EXPLORE')) enterBtn.click();
    `
  });
  await sleep(800);

  // Set dark theme
  await cdp.send("Runtime.evaluate", {
    expression: `document.documentElement.classList.add('dark'); localStorage.setItem('portfolio-theme', 'dark');`
  });
  await sleep(400);

  // 1. Top Hanging Desktop
  await cdp.send("Runtime.evaluate", {
    expression: `
      if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
      window.scrollTo(0, 0);
    `
  });
  await sleep(1000);

  const topDesktop = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label="Interactive red robot mascot"]');
        if (!robot) return { error: "Robot mascot not found" };
        const rect = robot.getBoundingClientRect();
        const svgRope = document.querySelector('svg path[d*="M"]');
        return {
          found: true,
          top: Math.round(rect.top),
          right: Math.round(window.innerWidth - rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hasRope: !!svgRope,
          scrollY: window.scrollY
        };
      })()
    `,
    returnByValue: true
  });
  console.log("1. Desktop Top Hanging:", JSON.stringify(topDesktop.result.value));

  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_01_desktop_top_hanging.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_01_desktop_top_hanging.png");

  // 2. Mid-Page Climbing Desktop (~45%)
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.round(maxScroll * 0.45);
        if (window.__lenis) window.__lenis.scrollTo(target, { immediate: true });
        window.scrollTo(0, target);
      })()
    `
  });
  await sleep(1000);

  const midDesktop = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label="Interactive red robot mascot"]');
        const rect = robot.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          right: Math.round(window.innerWidth - rect.right),
          scrollY: Math.round(window.scrollY)
        };
      })()
    `,
    returnByValue: true
  });
  console.log("2. Desktop Mid-Page Climbing:", JSON.stringify(midDesktop.result.value));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_02_desktop_mid_climbing.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_02_desktop_mid_climbing.png");

  // 3. Bottom Landing Desktop (100%)
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (window.__lenis) window.__lenis.scrollTo(maxScroll, { immediate: true });
        window.scrollTo(0, maxScroll);
      })()
    `
  });
  await sleep(1500); // Allow landing bounce & rope release

  const bottomDesktop = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label="Interactive red robot mascot"]');
        const rect = robot.getBoundingClientRect();
        // Check if rope is retracted
        const svgRope = document.querySelector('svg path[d*="M"]');
        return {
          top: Math.round(rect.top),
          bottom: Math.round(window.innerHeight - rect.bottom),
          right: Math.round(window.innerWidth - rect.right),
          hasRope: !!svgRope,
          scrollY: Math.round(window.scrollY)
        };
      })()
    `,
    returnByValue: true
  });
  console.log("3. Desktop Bottom Landed:", JSON.stringify(bottomDesktop.result.value));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_03_desktop_bottom_landing.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_03_desktop_bottom_landing.png");

  // 4. Wait for idle activity at bottom
  console.log("Waiting 3.6s for random idle activities at bottom...");
  await sleep(3600);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_04_desktop_bottom_idle.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_04_desktop_bottom_idle.png");

  // 5. Scroll back up to ~25% (Grab rope and climb up)
  console.log("Scrolling up to ~25%...");
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.round(maxScroll * 0.25);
        if (window.__lenis) window.__lenis.scrollTo(target, { immediate: true });
        window.scrollTo(0, target);
      })()
    `
  });
  await sleep(1200);

  const upDesktop = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label="Interactive red robot mascot"]');
        const rect = robot.getBoundingClientRect();
        const svgRope = document.querySelector('svg path[d*="M"]');
        return {
          top: Math.round(rect.top),
          right: Math.round(window.innerWidth - rect.right),
          hasRope: !!svgRope,
          scrollY: Math.round(window.scrollY)
        };
      })()
    `,
    returnByValue: true
  });
  console.log("5. Desktop Scrolled Up (Rope Reconnected):", JSON.stringify(upDesktop.result.value));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_05_desktop_scroll_up.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_05_desktop_scroll_up.png");

  // ==========================================
  // PART 2: MOBILE TESTING (390 x 844)
  // ==========================================
  console.log("Switching to Mobile Viewport (390x844)...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  // Scroll to top
  await cdp.send("Runtime.evaluate", {
    expression: `
      if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
      window.scrollTo(0, 0);
    `
  });
  await sleep(1000);

  const topMobile = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label="Interactive red robot mascot"]');
        const rect = robot.getBoundingClientRect();
        const hamburger = document.querySelector('button[aria-label="Toggle navigation menu"]');
        const hamRect = hamburger ? hamburger.getBoundingClientRect() : null;
        return {
          top: Math.round(rect.top),
          right: Math.round(window.innerWidth - rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hamburgerBottom: hamRect ? Math.round(hamRect.bottom) : null,
          clearOfHamburger: hamRect ? rect.top >= hamRect.bottom : true,
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      })()
    `,
    returnByValue: true
  });
  console.log("6. Mobile Top Hanging:", JSON.stringify(topMobile.result.value));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_06_mobile_top_hanging.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_06_mobile_top_hanging.png");

  // Mobile Scroll to Bottom (100%)
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (window.__lenis) window.__lenis.scrollTo(maxScroll, { immediate: true });
        window.scrollTo(0, maxScroll);
      })()
    `
  });
  await sleep(1500);

  const bottomMobile = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const robot = document.querySelector('[aria-label="Interactive red robot mascot"]');
        const rect = robot.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(window.innerHeight - rect.bottom),
          right: Math.round(window.innerWidth - rect.right),
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      })()
    `,
    returnByValue: true
  });
  console.log("7. Mobile Bottom Landed:", JSON.stringify(bottomMobile.result.value));

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "robot_07_mobile_bottom_landed.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved robot_07_mobile_bottom_landed.png");

  cdp.close();
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
