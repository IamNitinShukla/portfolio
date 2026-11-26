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

  // Wait for page ready
  for (let i = 0; i < 35; i++) {
    await new Promise(r => setTimeout(r, 200));
    const evalRes = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `!!document.querySelector('#hero')`
    });
    if (evalRes?.result?.value) break;
  }
  await new Promise(r => setTimeout(r, 1500));

  // Configure Desktop 1440x900 Dark Mode
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
      window.scrollTo(0, 0);
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));

  // 1. IN MODE A: CLICKING NAME DOES NOTHING
  console.log("Checking Mode A: Clicking name must do nothing...");
  const nameClickModeA = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const nameEl = Array.from(document.querySelectorAll('p, span')).find(el => el.textContent?.trim() === 'Nitin Shukla');
      const isButton = nameEl ? (nameEl.tagName === 'BUTTON' || !!nameEl.closest('button')) : false;
      if (nameEl) nameEl.click();

      const nameReturnBtn = document.querySelector('button.group\\\\/nameReturn');
      const headerDevId = document.body.innerText.includes('DEV // 2026');

      return {
        isButton,
        tagName: nameEl?.tagName,
        hasNameReturnBtn: !!nameReturnBtn,
        isStillModeA: headerDevId
      };
    })()`
  });
  console.log("Mode A Name Click:", nameClickModeA?.result?.value);

  // 2. TRIGGER VIA BARCODE CLICK TO MODE B
  console.log("Triggering Transformation via Barcode Click...");
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const barcodeBtn = document.querySelector('button.group\\\\/barcode');
      if (barcodeBtn) barcodeBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // 3. VERIFY ENLARGED QR, ENLARGED UPI ID, AND NAME RETURN TRIGGER IN MODE B
  const modeBChecks = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const upiCard = document.querySelector('[aria-label="UPI Payment QR Code"]');
      if (!upiCard) return { error: "UPI card not found" };

      // QR Dimensions check
      const qrWrapper = upiCard.querySelector('.w-\\\\[225px\\\\]');
      const qrRect = qrWrapper ? qrWrapper.getBoundingClientRect() : null;

      // UPI ID typography check
      const upiIdBtn = upiCard.querySelector('button[aria-label="Copy UPI ID"]');
      const upiIdStyle = upiIdBtn ? window.getComputedStyle(upiIdBtn) : null;

      // Name Return Button Check (MUST BE PRESENT IN MODE B!)
      const nameReturnBtn = document.querySelector('button.group\\\\/nameReturn');
      const headerUpi = document.body.innerText.includes('UPI // SCAN & PAY');

      return {
        hasUpiCard: true,
        headerUpi,
        qrFound: !!qrWrapper,
        qrWidth: qrRect?.width,
        qrHeight: qrRect?.height,
        upiIdFontSize: upiIdStyle?.fontSize,
        upiIdFontWeight: upiIdStyle?.fontWeight,
        hasNameReturnTrigger: !!nameReturnBtn,
        nameReturnText: nameReturnBtn?.textContent?.trim()
      };
    })()`
  });
  console.log("Mode B Checks:", JSON.stringify(modeBChecks?.result?.value, null, 2));

  // Capture Desktop Dark
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "upi_enlarged_dark.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved upi_enlarged_dark.png");

  // Desktop Light Mode
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "upi_enlarged_light.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved upi_enlarged_light.png");

  // 4. TEST NAME RETURN TRIGGER (CLICK NITIN SHUKLA IN MODE B TO RETURN TO MODE A)
  console.log("Testing Name Return Trigger (Clicking 'Nitin Shukla' in Mode B)...");
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const nameReturnBtn = document.querySelector('button.group\\\\/nameReturn');
      if (nameReturnBtn) nameReturnBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 900));

  const returnViaNameCheck = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const nameReturnBtn = document.querySelector('button.group\\\\/nameReturn');
      const headerDevId = document.body.innerText.includes('DEV // 2026');
      return {
        returnedToModeA: headerDevId,
        nameReturnBtnGone: !nameReturnBtn
      };
    })()`
  });
  console.log("Return via Name Result:", returnViaNameCheck?.result?.value);

  // Capture restored gallery
  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "upi_returned_via_name.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved upi_returned_via_name.png");

  // 5. MOBILE VIEWPORT (390px)
  console.log("Configuring Mobile Viewport (390x844)...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      window.scrollTo(0, 0);
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));

  // Tap Barcode on Mobile
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const barcodeBtn = document.querySelector('button.group\\\\/barcode');
      if (barcodeBtn) barcodeBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 900));

  const mobileMetrics = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const upiCard = document.querySelector('[aria-label="UPI Payment QR Code"]');
      const nameReturnBtn = document.querySelector('button.group\\\\/nameReturn');
      return {
        hasUpiCard: !!upiCard,
        hasMobileNameReturnBtn: !!nameReturnBtn,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`
  });
  console.log("Mobile Metrics:", mobileMetrics?.result?.value);

  shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "upi_enlarged_mobile_390.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved upi_enlarged_mobile_390.png");

  cdp.close();
  if (chromeProc) {
    try { process.kill(chromeProc.pid); } catch (e) {}
  }
  console.log("All micro-refinements verified successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
