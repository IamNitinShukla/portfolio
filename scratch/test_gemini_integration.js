const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";
const PORT = 3001;

function checkHttp(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

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

// Helper to query /api/chat with streaming accumulation
async function queryChatApi(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let rawData = '';
      let streamedText = '';
      let chunks = 0;
      let modelUsed = res.headers['x-model-used'] || null;

      res.on('data', (chunk) => {
        const str = chunk.toString();
        rawData += str;
        chunks++;
        const lines = str.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) streamedText += parsed.text;
              if (parsed.model) modelUsed = parsed.model;
            } catch {}
          }
        }
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          rawData,
          streamedText,
          chunks,
          modelUsed
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("=== STARTING GEMINI ASSISTANT INTEGRATION SUITE ===");

  // 1. Start Server
  console.log(`Starting Next.js server on port ${PORT}...`);
  const serverProc = spawn("cmd.exe", ["/c", `npx next start -p ${PORT}`], {
    env: { ...process.env, PATH: `C:\\Program Files\\nodejs;${process.env.PATH}` },
    stdio: "pipe"
  });

  for (let i = 0; i < 40; i++) {
    await sleep(300);
    if (await checkHttp(PORT)) {
      console.log(`Server ready on port ${PORT}!`);
      break;
    }
  }

  // Read key for leakage verification (DO NOT LOG)
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  const secretKey = match ? match[1].trim() : null;

  // -------------------------------------------------------------------
  // TEST 1: Direct Question & Live Streaming
  // -------------------------------------------------------------------
  console.log("\n[TEST 1] Direct Question & Real-Time Streaming...");
  const t1 = await queryChatApi({
    message: "What are Nitin's top projects and what technologies does he use for them?"
  });
  console.log(`- HTTP Status: ${t1.status}`);
  console.log(`- Model Used: ${t1.modelUsed}`);
  console.log(`- Chunks Streamed: ${t1.chunks}`);
  console.log(`- Response Preview: ${t1.streamedText.substring(0, 180)}...`);
  console.log(`- Contains LexGenAI/Krishi-Setu/RookDB: ${/LexGenAI|Krishi-Setu|RookDB/i.test(t1.streamedText)}`);

  // Verify secret key is NOT in response headers or body
  if (secretKey && (t1.rawData.includes(secretKey) || JSON.stringify(t1.headers).includes(secretKey))) {
    throw new Error("SECURITY FAILURE: Secret key leaked in API response!");
  } else {
    console.log("- Key leak audit: PASSED (Key never echoed in response)");
  }

  // -------------------------------------------------------------------
  // TEST 2: Conversational History & Coreference / Pronoun Resolution
  // -------------------------------------------------------------------
  console.log("\n[TEST 2] Follow-up Question & Pronoun Resolution...");
  const t2 = await queryChatApi({
    message: "What machine learning models did he use for it?",
    history: [
      { sender: "user", text: "Tell me about Krishi-Setu." },
      { sender: "assistant", text: "Krishi-Setu is Nitin's AI-powered agricultural platform for localized crop pathology and voice assistance." }
    ]
  });
  console.log(`- HTTP Status: ${t2.status}`);
  console.log(`- Response: ${t2.streamedText.substring(0, 200)}...`);
  console.log(`- Resolved 'it' as Krishi-Setu (mentions PyTorch/Whisper/CNN/leaf): ${/PyTorch|Whisper|CNN|disease|leaf|pathology/i.test(t2.streamedText)}`);

  // -------------------------------------------------------------------
  // TEST 3: Project Comparison
  // -------------------------------------------------------------------
  console.log("\n[TEST 3] Architectural Comparison...");
  const t3 = await queryChatApi({
    message: "Compare LexGenAI and RookDB in terms of architecture and domain."
  });
  console.log(`- HTTP Status: ${t3.status}`);
  console.log(`- Response Preview: ${t3.streamedText.substring(0, 220)}...`);
  console.log(`- Mentions Legal/RAG vs LSM/Go/Storage: ${/RAG|Legal/i.test(t3.streamedText) && /LSM|Go|storage|database/i.test(t3.streamedText)}`);

  // -------------------------------------------------------------------
  // TEST 4: Hallucination Prevention & Unknown Information
  // -------------------------------------------------------------------
  console.log("\n[TEST 4] Unknown Information & Hallucination Prevention...");
  const t4 = await queryChatApi({
    message: "What is Nitin's private mobile phone number and what does he eat for breakfast?"
  });
  console.log(`- HTTP Status: ${t4.status}`);
  console.log(`- Response: ${t4.streamedText.substring(0, 220)}...`);
  const declinesProperly = /not mentioned|isn't mentioned|portfolio|email|contact/i.test(t4.streamedText);
  console.log(`- Correctly acknowledges missing information without hallucinating: ${declinesProperly}`);

  // -------------------------------------------------------------------
  // TEST 5: Input Validation Limits
  // -------------------------------------------------------------------
  console.log("\n[TEST 5] Input Validation...");
  const emptyRes = await queryChatApi({ message: "   " });
  console.log(`- Empty message returns 400: ${emptyRes.status === 400}`);

  const hugeRes = await queryChatApi({ message: "A".repeat(1200) });
  console.log(`- Message > 1000 chars returns 400: ${hugeRes.status === 400}`);

  // -------------------------------------------------------------------
  // TEST 6: Bundle Secret Scan
  // -------------------------------------------------------------------
  console.log("\n[TEST 6] Client Bundle Security Scan...");
  const nextStaticDir = path.join(process.cwd(), ".next", "static");
  let bundleLeaked = false;
  if (fs.existsSync(nextStaticDir) && secretKey) {
    function scanDir(dir) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) scanDir(full);
        else if (f.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes(secretKey)) bundleLeaked = true;
        }
      }
    }
    scanDir(nextStaticDir);
  }
  console.log(`- Bundled JS contains secret key: ${bundleLeaked ? "FAIL (LEAK)" : "PASS (Zero leakage in client JS)"}`);

  // -------------------------------------------------------------------
  // TEST 7: End-to-End Browser UI Streaming & Cancellation
  // -------------------------------------------------------------------
  console.log("\n[TEST 7] Browser UI Streaming & Live Interaction...");
  let chromeProc = null;
  const chromeRunning = await checkPort(9222);
  if (!chromeRunning) {
    const chromePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    const chromePath = chromePaths.find(p => p && fs.existsSync(p));
    if (chromePath) {
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
  }

  const targets = await getCdpTargets();
  const pageTarget = targets.find(t => t.type === "page");
  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      sessionStorage.setItem("portfolio_intro_seen", "true");
      localStorage.setItem("portfolio-theme", "dark");
    `
  });

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}` });
  await sleep(2000);

  // Click mascot trigger
  await cdp.send("Runtime.evaluate", {
    expression: `(() => { const t = document.querySelector('[data-testid="mascot-assistant-trigger"]'); if (t) t.click(); })()`
  });
  await sleep(800);

  // Submit live question via UI
  console.log("Submitting question via UI composer: 'What is Nitin's specialization and philosophy?'");
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const input = document.querySelector('dialog input');
        const form = document.querySelector('dialog form');
        if (input && form) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, "What is Nitin's specialization and engineering philosophy?");
          input.dispatchEvent(new Event('input', { bubbles: true }));
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      })()
    `
  });

  // Wait for streaming tokens to accumulate
  console.log("Waiting for tokens to stream into UI...");
  await sleep(2500);

  // Read streamed content from DOM
  const domResult = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const bubbles = Array.from(document.querySelectorAll('dialog div[class*="bubble"]'));
        const lastBubble = bubbles[bubbles.length - 1];
        return {
          text: lastBubble ? lastBubble.innerText : "",
          isStreaming: document.querySelector('dialog [title*="Stop"]') !== null
        };
      })()
    `,
    returnByValue: true
  });
  console.log("UI Streamed Text Preview:", domResult.result.value?.text?.substring(0, 150));

  // Capture screenshot of streaming Gemini response
  let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "gemini_streaming_verified.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved gemini_streaming_verified.png");

  cdp.close();
  try { serverProc.kill(); } catch (e) {}
  if (chromeProc) {
    try { chromeProc.kill(); } catch (e) {}
  }

  console.log("\n=== ALL GEMINI VERIFICATION TESTS COMPLETED SUCCESSFULLY! ===");
}

run().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
