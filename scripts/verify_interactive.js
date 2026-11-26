const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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

  // Wait 1s
  await new Promise(r => setTimeout(r, 1000));

  const testReport = await evalCode(`
    (async () => {
      const results = {};

      // 1. All buttons on page
      const allButtons = Array.from(document.querySelectorAll('button')).map((b, i) => ({
        index: i,
        text: b.innerText.trim().replace(/\\n/g, ' '),
        ariaLabel: b.getAttribute('aria-label'),
        title: b.getAttribute('title')
      }));
      results.totalButtons = allButtons.length;
      results.buttonList = allButtons;

      // 2. Test Skills Buttons
      const skillButtons = Array.from(document.querySelectorAll('#skills button'));
      results.skillButtonsCount = skillButtons.length;
      results.skillButtonTexts = skillButtons.map(b => b.innerText.replace(/\\n/g, ' '));

      if (skillButtons.length > 1) {
        // Click 2nd button (Programming Languages)
        skillButtons[1].click();
        await new Promise(r => setTimeout(r, 300));

        const activeBtn = Array.from(document.querySelectorAll('#skills button')).find(b => b.className.includes('bg-accent'));
        const visibleCards = document.querySelectorAll('#skills .grid > div').length;
        results.skillsAfterClick = {
          activeButtonText: activeBtn?.innerText.replace(/\\n/g, ' '),
          cardsDisplayed: visibleCards
        };

        // Click again to toggle back to all
        skillButtons[1].click();
        await new Promise(r => setTimeout(r, 300));
        const activeAfterToggle = Array.from(document.querySelectorAll('#skills button')).find(b => b.className.includes('bg-accent'));
        const cardsAfterToggle = document.querySelectorAll('#skills .grid > div').length;
        results.skillsAfterToggle = {
          activeButtonText: activeAfterToggle?.innerText.replace(/\\n/g, ' '),
          cardsDisplayed: cardsAfterToggle
        };
      }

      // 3. Test Carousel Next / Tab click
      const nextBtn = document.querySelector('button[aria-label="Next Project"]');
      const titleBefore = document.querySelector('#work h3')?.innerText;
      if (nextBtn) {
        nextBtn.click();
        await new Promise(r => setTimeout(r, 350));
      }
      const titleAfter = document.querySelector('#work h3')?.innerText;
      results.carousel = {
        titleBefore,
        titleAfter,
        advanced: titleBefore !== titleAfter
      };

      // 4. Test Cal.com Modal
      const calBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('OPEN CALENDAR SCHEDULER'));
      if (calBtn) {
        calBtn.click();
        await new Promise(r => setTimeout(r, 300));
        const modal = document.querySelector('.fixed.z-50');
        results.calModalOpened = !!modal;

        // Select slot
        const slotBtn = modal?.querySelectorAll('.grid button')?.[2];
        if (slotBtn) {
          slotBtn.click();
          await new Promise(r => setTimeout(r, 150));
          results.slotSelected = slotBtn.className.includes('bg-accent');
        }

        // Close via backdrop
        if (modal) {
          modal.click();
          await new Promise(r => setTimeout(r, 300));
          results.calModalClosed = !document.querySelector('.fixed.z-50');
        }
      }

      return results;
    })()
  `);

  console.log('Test Report:', JSON.stringify(testReport, null, 2));

  ws.close();
  chrome.kill();
}

run().catch(console.error);
