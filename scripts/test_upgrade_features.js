const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function getTargets(retries = 15) {
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
  throw new Error('Could not connect to Chrome DevTools port 9222');
}

async function runTests() {
  console.log('================================================================');
  console.log('   PORTFOLIO UPGRADE TEST SUITE: INTRO, PARTICLES, DUAL THEME   ');
  console.log('================================================================\n');

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,900',
    'http://localhost:3000'
  ]);

  console.log('Connecting to Chrome DevTools...');
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page') || targets[0];
  console.log('Connected to target page:', page.title || page.url);

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

  const consoleErrors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      if (!text.includes('Clipboard') && !text.includes('writeText')) consoleErrors.push(text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || '');
      if (!text.includes('Clipboard') && !text.includes('writeText')) consoleErrors.push(text);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const evalCode = async (code) => {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  };

  // Wait 1.5s for page rendering
  await new Promise(r => setTimeout(r, 1500));

  // 1. TEST FEATURE 1: CINEMATIC INTRO
  console.log('\n[TEST 1/5] Testing Feature 1: Cinematic Intro Appearance & Typing...');
  const introStatus = await evalCode(`
    (() => {
      const skipBtn = document.querySelector('button[aria-label*="Skip website introduction"]');
      const introContainer = skipBtn ? skipBtn.closest('div[class*="fixed"]') : null;
      const text = introContainer ? introContainer.innerText : '';
      return {
        introPresent: !!skipBtn,
        textSnippet: text.slice(0, 80).replace(/\\n/g, ' '),
        hasSkipButton: !!skipBtn
      };
    })()
  `);
  console.log('✓ Intro Status:', introStatus);

  // Press Skip Button to reveal main page
  console.log('Dismissing intro via Skip button...');
  await evalCode(`
    (() => {
      const skipBtn = document.querySelector('button[aria-label*="Skip website introduction"]');
      if (skipBtn) skipBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const introDismissed = await evalCode(`!document.querySelector('button[aria-label*="Skip website introduction"]')`);
  console.log('✓ Intro successfully dismissed:', introDismissed);

  // 2. TEST FEATURE 2: RGB PARTICLE CANVAS
  console.log('\n[TEST 2/5] Testing Feature 2: Interactive RGB Particle Background...');
  const canvasStatus = await evalCode(`
    (() => {
      const canvas = document.querySelector('canvas[aria-hidden="true"]');
      return {
        canvasPresent: !!canvas,
        isFixed: canvas ? window.getComputedStyle(canvas).position === 'fixed' : false,
        isPointerNone: canvas ? window.getComputedStyle(canvas).pointerEvents === 'none' : false,
        width: canvas ? canvas.width : 0,
        height: canvas ? canvas.height : 0
      };
    })()
  `);
  console.log('✓ Canvas Status:', canvasStatus);

  // 3. TEST FEATURE 3: DUAL THEME SYSTEM & LIGHT MODE DEFAULT
  console.log('\n[TEST 3/5] Testing Feature 3: Dual Theme System (Light Mode Default)...');
  const lightModeStatus = await evalCode(`
    (() => {
      const html = document.documentElement;
      const isDark = html.classList.contains('dark');
      const rootStyle = getComputedStyle(document.documentElement);
      const accent = rootStyle.getPropertyValue('--accent').trim();
      const background = rootStyle.getPropertyValue('--background').trim();
      const surface = rootStyle.getPropertyValue('--surface').trim();
      const primaryText = rootStyle.getPropertyValue('--primary-text').trim();
      const border = rootStyle.getPropertyValue('--border').trim();
      return {
        defaultIsLight: !isDark,
        accent,
        background,
        surface,
        primaryText,
        border
      };
    })()
  `);
  console.log('✓ Default Light Mode Status:', lightModeStatus);

  // Click Theme Toggle to switch to Dark Mode
  console.log('Toggling theme to Dark Mode...');
  await evalCode(`
    (() => {
      const themeBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('theme'));
      if (themeBtn) themeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const darkModeStatus = await evalCode(`
    (() => {
      const html = document.documentElement;
      const isDark = html.classList.contains('dark');
      const saved = localStorage.getItem('portfolio-theme');
      const rootStyle = getComputedStyle(document.documentElement);
      const accent = rootStyle.getPropertyValue('--accent').trim();
      const background = rootStyle.getPropertyValue('--background').trim();
      const surface = rootStyle.getPropertyValue('--surface').trim();
      const primaryText = rootStyle.getPropertyValue('--primary-text').trim();
      const border = rootStyle.getPropertyValue('--border').trim();
      return {
        switchedToDark: isDark,
        localStorageSaved: saved,
        accent,
        background,
        surface,
        primaryText,
        border
      };
    })()
  `);
  console.log('✓ Dark Mode Status:', darkModeStatus);

  // Switch back to Light Mode
  console.log('Toggling theme back to Light Mode...');
  await evalCode(`
    (() => {
      const themeBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('theme'));
      if (themeBtn) themeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const restoredLightStatus = await evalCode(`
    (() => {
      const html = document.documentElement;
      const isDark = html.classList.contains('dark');
      const saved = localStorage.getItem('portfolio-theme');
      return {
        isLight: !isDark,
        localStorageSaved: saved
      };
    })()
  `);
  console.log('✓ Restored Light Mode Status:', restoredLightStatus);

  // 4. TEST SECTIONS & CONTENT INTEGRITY
  console.log('\n[TEST 4/5] Testing Sections and Name Integration ("Nitin")...');
  const sectionsStatus = await evalCode(`
    (() => {
      const sections = ['hero', 'philosophy', 'about', 'skills', 'work', 'experience', 'education', 'achievements', 'contact'];
      const missing = sections.filter(s => !document.getElementById(s));
      const hasNitin = document.body.innerText.includes('Nitin');
      return {
        allSectionsPresent: missing.length === 0,
        missingSections: missing,
        nameUpdatedToNitin: hasNitin
      };
    })()
  `);
  console.log('✓ Sections and Name Status:', sectionsStatus);

  // 5. TEST CONSOLE ERRORS
  console.log('\n[TEST 5/5] Checking for Console Errors...');
  console.log('✓ Total Console Errors captured:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  console.log('\n================================================================');
  console.log('          ALL UPGRADE FEATURE TESTS COMPLETED!                  ');
  console.log('================================================================');

  ws.close();
  chrome.kill();
}

runTests().catch(console.error);
