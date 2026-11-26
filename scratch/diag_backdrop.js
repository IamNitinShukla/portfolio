const { spawn } = require('child_process');
const http = require('http');

const PORT = 9275;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 1; this.callbacks = new Map(); }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', err => reject(err));
      this.ws.addEventListener('message', event => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { res, rej });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  }
}

async function run() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-diag-backdrop',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
    'http://localhost:3000'
  ]);
  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try { targets = await getJson('http://127.0.0.1:' + PORT + '/json/list'); if (targets && targets.length > 0) break; } catch {}
  }
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1000);
  await cdp.evaluate('sessionStorage.setItem("portfolio_intro_seen", "true"); localStorage.setItem("portfolio-theme", "dark");');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1200);
  await cdp.evaluate('const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Skip Intro")); if (b) b.click();');
  await sleep(600);
  // Open modal
  await cdp.evaluate('Array.from(document.querySelectorAll("#contact button")).find(b => b.textContent.includes("SAY HELLO")).click()');
  await sleep(400);

  const diag = await cdp.evaluate(`(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    const children = Array.from(dialog.children).map(c => ({
      tag: c.tagName,
      className: c.className
    }));
    return { dialogClass: dialog.className, children };
  })()`);
  console.log('Dialog Structure:', JSON.stringify(diag, null, 2));

  // Try clicking backdrop at (50, 50) using Input.dispatchMouseEvent
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 50, y: 50, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 50, y: 50, button: 'left', clickCount: 1 });
  await sleep(400);

  const afterClick = await cdp.evaluate('!!document.querySelector(\'div[role="dialog"]\')');
  console.log('Still open after real mouse click at (50, 50)?', afterClick);

  chromeProc.kill();
}
run();
