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

  // Set sessionStorage and dismiss intro
  await cdp.send("Runtime.evaluate", {
    expression: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
      document.documentElement.classList.add('dark');
      const enterBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('EXPLORE'));
      if (enterBtn) enterBtn.click();
    `
  });
  await sleep(800);

  // Wait for gallery element
  let found = false;
  for (let i = 0; i < 20; i++) {
    const check = await cdp.send("Runtime.evaluate", {
      expression: `!!document.querySelector('[aria-label="Nitin Shukla Photograph Gallery"]')`,
      returnByValue: true
    });
    if (check.result.value) {
      found = true;
      break;
    }
    await sleep(300);
  }
  if (!found) throw new Error("Gallery container not found!");

  // 1. Initial Default Centered State
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "photo_01_default_centered.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved photo_01_default_centered.png");

  // Open Fan via keyboard Enter or click
  console.log("Opening gallery fan...");
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const gal = document.querySelector('[aria-label="Nitin Shukla Photograph Gallery"]');
        if (gal) {
          gal.focus();
          gal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      })()
    `
  });
  await sleep(900); // Allow spring to settle smoothly

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "photo_02_fanned_initial_apex.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved photo_02_fanned_initial_apex.png");

  // Get coordinates of Photo 1
  const card1Coord = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const c = document.querySelector('[data-photo-index="1"]');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    `,
    returnByValue: true
  });
  console.log("Card 1 coordinate:", card1Coord.result.value);

  // 3. Hover over Photo 1 (right side card)
  console.log("Hovering over Photo 1 (right card)...");
  if (card1Coord.result.value) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(card1Coord.result.value.x),
      y: Math.round(card1Coord.result.value.y)
    });
  }
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const card1 = document.querySelector('[data-photo-index="1"]');
        if (card1) {
          const r = card1.getBoundingClientRect();
          card1.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
          card1.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse', clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
        }
      })()
    `
  });

  // Sample midway glide (t = 250ms)
  await sleep(250);
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "photo_03_gliding_midway_transition.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved photo_03_gliding_midway_transition.png");

  // Allow photo 1 to finish settling gently into foreground (t = 650ms more, total 900ms)
  await sleep(650);
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "photo_04_settled_photo1_center.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved photo_04_settled_photo1_center.png");

  // 4. Hover over Photo 2 (far left card)
  console.log("Hovering over Photo 2 (left card)...");
  const card2Coord = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const c = document.querySelector('[data-photo-index="2"]');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    `,
    returnByValue: true
  });
  if (card2Coord.result.value) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(card2Coord.result.value.x),
      y: Math.round(card2Coord.result.value.y)
    });
  }
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const card2 = document.querySelector('[data-photo-index="2"]');
        if (card2) {
          const r = card2.getBoundingClientRect();
          card2.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
          card2.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse', clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
        }
      })()
    `
  });
  await sleep(900); // Allow full smooth settling

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "photo_05_settled_photo2_center.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved photo_05_settled_photo2_center.png");

  // 5. Test Mobile Viewport (390x844)
  console.log("Testing mobile viewport 390x844 touch interaction...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(800);

  // Open fan on mobile
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const gal = document.querySelector('[aria-label="Nitin Shukla Photograph Gallery"]');
        if (gal) {
          gal.focus();
          gal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      })()
    `
  });
  await sleep(900);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "photo_06_mobile_fanned_smooth.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved photo_06_mobile_fanned_smooth.png");

  cdp.close();
  console.log("All transition verification tests completed successfully!");
}

run().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
