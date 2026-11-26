const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8";

function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9222/json", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function run() {
  const targets = await getCdpTargets();
  const pageTarget = targets.find(t => t.type === "page");
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise(res => ws.onopen = res);

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evalRes = await send("Runtime.evaluate", {
    expression: `(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyLen: document.body.innerHTML.length,
        hasIntro: !!document.querySelector('[class*="Intro"]'),
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.outerHTML),
        htmlPreview: document.body.innerHTML.slice(0, 1000)
      };
    })()`,
    returnByValue: true
  });
  console.log("DOM state:", evalRes.value);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "page_debug.png"), Buffer.from(shot.data, "base64"));
  console.log("Saved page_debug.png");
  ws.close();
}

run().catch(console.error);
