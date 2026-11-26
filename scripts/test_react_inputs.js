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

  const result = await evalCode(`
    (async () => {
      function setReactInput(el, val) {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setVal = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setVal.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Test Contact Form with React input setter
      const form = document.querySelector('#contact form');
      const nameInp = form.querySelector('input[placeholder*="Sarah"]');
      const emailInp = form.querySelector('input[placeholder*="@"]');
      const msgInp = form.querySelector('textarea');
      const submitBtn = form.querySelector('button[type="submit"]');

      setReactInput(nameInp, 'Ada Lovelace');
      setReactInput(emailInp, 'bad-email');
      setReactInput(msgInp, 'Testing system integrity.');

      submitBtn.click();
      await new Promise(r => setTimeout(r, 150));
      const invalidEmailErrors = Array.from(form.querySelectorAll('.text-red-400 span')).map(s => s.innerText);

      // Now valid email
      setReactInput(emailInp, 'ada.lovelace@example.com');
      submitBtn.click();
      await new Promise(r => setTimeout(r, 1200));

      const successH4 = document.querySelector('#contact h4')?.innerText || '';

      return {
        invalidEmailErrors,
        successH4
      };
    })()
  `);

  console.log('Result with setReactInput:', JSON.stringify(result, null, 2));

  ws.close();
  chrome.kill();
}

run().catch(console.error);
