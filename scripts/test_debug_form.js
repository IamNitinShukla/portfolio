const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,900',
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.type === 'page');
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

  const evalCode = async (code) => {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  };

  await new Promise(r => setTimeout(r, 1000));

  const testResult = await evalCode(`
    (async () => {
      const form = document.querySelector('#contact form');
      if (!form) return { error: 'Form not found' };

      const submitBtn = form.querySelector('button[type="submit"]');

      // Test 1: Empty submit
      submitBtn.click();
      await new Promise(r => setTimeout(r, 200));
      const emptyErrs = Array.from(form.querySelectorAll('.text-red-400 span')).map(s => s.innerText);

      return {
        emptyErrs
      };
    })()
  `);

  console.log('Empty submit result:', testResult);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
