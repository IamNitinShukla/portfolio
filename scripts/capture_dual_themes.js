const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratch = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';

async function getTargets(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9222/json', res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
      });
      if (Array.isArray(result) && result.length > 0) return result;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Could not connect to Chrome port 9222');
}

async function capture() {
  console.log('Capturing screenshots for visual verification...');
  fs.mkdirSync(scratch, { recursive: true });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,900',
    'http://localhost:3000'
  ]);

  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

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
  await send('Page.enable');
  await send('Runtime.enable');

  const evalCode = async (code) => {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  };

  const takeScreenshot = async (filename) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const out = path.join(scratch, filename);
    fs.writeFileSync(out, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  };

  // 1. Capture Intro in Light Mode (Default)
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('screen_upgrade_intro_light.png');

  // Dismiss intro
  await evalCode(`
    (() => {
      const skipBtn = document.querySelector('button[aria-label*="Skip website introduction"]');
      if (skipBtn) skipBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  // 2. Capture Homepage in Light Mode (Default)
  await takeScreenshot('screen_upgrade_homepage_light.png');

  // 3. Toggle to Dark Mode
  await evalCode(`
    (() => {
      const themeBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('theme'));
      if (themeBtn) themeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 500));

  // 4. Capture Homepage in Dark Mode
  await takeScreenshot('screen_upgrade_homepage_dark.png');

  // 5. Mobile view in Light Mode
  await evalCode(`
    (() => {
      const themeBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('theme'));
      if (themeBtn) themeBtn.click(); // back to light
    })()
  `);
  await new Promise(r => setTimeout(r, 300));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 400));
  await takeScreenshot('screen_upgrade_mobile_light.png');

  ws.close();
  chrome.kill();
  console.log('Visual screenshot suite completed successfully!');
}

capture().catch(console.error);
