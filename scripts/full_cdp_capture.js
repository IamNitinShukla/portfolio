const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = global.WebSocket || require('ws'); // In Node 22+, global WebSocket is built-in!

async function capture() {
  const scratch = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('Spawning Chrome with remote debugging on 9222...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'http://localhost:3000'
  ]);

  // Wait for 9222 to be ready
  await new Promise(r => setTimeout(r, 2500));

  // Get JSON version/targets
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  console.log('Found page target:', pageTarget.id);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', listener);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', listener);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => ws.addEventListener('open', r));
  console.log('Connected to CDP websocket.');

  // Wait a bit for page animations / fonts to settle
  await new Promise(r => setTimeout(r, 2000));

  // 1. Get layout metrics to find full document height
  const layoutMetrics = await send('Page.getLayoutMetrics');
  console.log('Content size:', layoutMetrics.contentSize);
  const totalH = Math.min(layoutMetrics.contentSize.height, 12000);

  // Set device metrics to full page width
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: Math.round(totalH),
    deviceScaleFactor: 1,
    mobile: false
  });

  await new Promise(r => setTimeout(r, 1000));

  // Capture full page
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true
  });

  const fullPath = path.join(scratch, 'full_page_hq.png');
  fs.writeFileSync(fullPath, Buffer.from(result.data, 'base64'));
  console.log('Saved HQ full page screenshot to:', fullPath, fs.statSync(fullPath).size, 'bytes');

  // Let's also capture specific sections by evaluating getBoundingClientRect
  const sectionIds = ['hero', 'philosophy', 'about', 'skills', 'work', 'experience', 'education', 'achievements', 'contact'];
  for (const sId of sectionIds) {
    try {
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.getElementById("${sId}");
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top + window.scrollY, width: r.width, height: r.height };
          })()
        `,
        returnByValue: true
      });

      const box = evalRes.result?.value;
      if (box && box.height > 10) {
        const secRes = await send('Page.captureScreenshot', {
          format: 'png',
          clip: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            scale: 1
          }
        });
        const secPath = path.join(scratch, `sec_${sId}.png`);
        fs.writeFileSync(secPath, Buffer.from(secRes.data, 'base64'));
        console.log(`Saved section ${sId} to ${secPath} (${fs.statSync(secPath).size} bytes)`);
      }
    } catch (e) {
      console.error(`Error capturing section ${sId}:`, e.message);
    }
  }

  ws.close();
  chrome.kill();
  console.log('Finished capturing!');
}

capture().catch(console.error);
