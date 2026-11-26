const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function main() {
  const scratch = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('Launching headless Chrome...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,1000',
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 3000));

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
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

  // Measure all sections
  const report = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const sections = Array.from(document.querySelectorAll('section, footer')).map(el => {
          const r = el.getBoundingClientRect();
          return {
            id: el.id || el.tagName.toLowerCase(),
            tag: el.tagName,
            top: Math.round(r.top + window.scrollY),
            height: Math.round(r.height),
            classes: el.className
          };
        });
        return {
          totalScrollHeight: document.documentElement.scrollHeight,
          sections
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Page Structure Report:');
  console.log(JSON.stringify(report.result.value, null, 2));

  // Now, for each section, scroll into view and take screenshot
  const sectionIds = ['hero', 'philosophy', 'about', 'skills', 'work', 'experience', 'education', 'achievements', 'contact'];
  for (const sId of sectionIds) {
    try {
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.getElementById("${sId}");
            if (el) {
              el.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
          })()
        `
      });

      await new Promise(r => setTimeout(r, 600));

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const secPath = path.join(scratch, `view_${sId}.png`);
      fs.writeFileSync(secPath, Buffer.from(shot.data, 'base64'));
      console.log(`Captured view_${sId}.png (${fs.statSync(secPath).size} bytes)`);
    } catch (e) {
      console.error(`Failed ${sId}:`, e.message);
    }
  }

  ws.close();
  chrome.kill();
}

main().catch(console.error);
