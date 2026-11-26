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

  // Focus Name input
  await evalCode(`document.querySelector('#contact input[type="text"]').focus()`);
  await send('Input.insertText', { text: 'Ada Lovelace' });
  await new Promise(r => setTimeout(r, 100));

  // Focus Email input
  await evalCode(`document.querySelector('#contact input[type="email"]').focus()`);
  await send('Input.insertText', { text: 'invalid-email-address' });
  await new Promise(r => setTimeout(r, 100));

  // Focus Textarea
  await evalCode(`document.querySelector('#contact textarea').focus()`);
  await send('Input.insertText', { text: 'Valid system integration test.' });
  await new Promise(r => setTimeout(r, 100));

  // Click Submit
  await evalCode(`document.querySelector('#contact button[type="submit"]').click()`);
  await new Promise(r => setTimeout(r, 200));

  // Read error
  const emailError = await evalCode(`
    Array.from(document.querySelectorAll('#contact .text-red-400 span')).map(s => s.innerText)
  `);
  console.log('Errors with invalid email:', emailError);

  // Now clear email and type valid email
  await evalCode(`
    (() => {
      const el = document.querySelector('#contact input[type="email"]');
      el.focus();
      el.select();
    })()
  `);
  await send('Input.insertText', { text: 'ada@example.com' });
  await new Promise(r => setTimeout(r, 100));

  // Click Submit
  await evalCode(`document.querySelector('#contact button[type="submit"]').click()`);
  await new Promise(r => setTimeout(r, 1200));

  const successScreen = await evalCode(`document.querySelector('#contact h4')?.innerText`);
  console.log('Success title after valid submission:', successScreen);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
