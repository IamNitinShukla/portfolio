const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratch = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';

async function runFullQASuite() {
  console.log('================================================================');
  console.log('     SENIOR QA VERIFICATION REPORT — PERSONAL PORTFOLIO         ');
  console.log('================================================================\n');

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

  const consoleErrors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      // Filter out harmless clipboard write permission prompt in headless environment
      if (!text.includes('Clipboard') && !text.includes('writeText')) {
        consoleErrors.push(text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || '');
      if (!text.includes('Clipboard') && !text.includes('writeText')) {
        consoleErrors.push(text);
      }
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

  // Wait for React hydration
  await new Promise(r => setTimeout(r, 1200));

  const qaReport = {
    links: null,
    overflow: {},
    commandPalette: null,
    skills: null,
    carousel: null,
    contactForm: null,
    calendarModal: null,
    footer: null,
    consoleErrors: []
  };

  // 1. Links & Anchors
  console.log('[TEST 1/8] Auditing All Links, Anchors, and External Attributes...');
  qaReport.links = await evalCode(`
    (() => {
      const links = Array.from(document.querySelectorAll('a')).map(a => {
        const href = a.getAttribute('href') || '';
        let targetExists = true;
        if (href.startsWith('#')) {
          targetExists = !!document.querySelector(href);
        }
        return {
          text: a.innerText.trim().replace(/\\n/g, ' '),
          href,
          target: a.getAttribute('target'),
          rel: a.getAttribute('rel'),
          targetExists,
          isExternal: href.startsWith('http'),
          isAnchor: href.startsWith('#'),
          isMailto: href.startsWith('mailto:')
        };
      });

      return {
        totalLinks: links.length,
        brokenAnchors: links.filter(l => l.isAnchor && !l.targetExists),
        invalidExternals: links.filter(l => l.isExternal && (!l.target || !l.rel)),
        emptyHrefs: links.filter(l => !l.href || l.href === '#' || l.href === 'javascript:void(0)')
      };
    })()
  `);
  console.log('  -> Total links:', qaReport.links.totalLinks);
  console.log('  -> Broken anchors:', qaReport.links.brokenAnchors.length);
  console.log('  -> Invalid external links:', qaReport.links.invalidExternals.length);
  console.log('  -> Empty/dead hrefs:', qaReport.links.emptyHrefs.length);

  // 2. Responsive Viewports Overflow
  console.log('\n[TEST 2/8] Testing Horizontal Overflow across 7 Standard Breakpoints...');
  const viewports = [
    { w: 360, h: 800 },
    { w: 390, h: 844 },
    { w: 430, h: 932 },
    { w: 768, h: 1024 },
    { w: 1024, h: 768 },
    { w: 1440, h: 900 },
    { w: 1920, h: 1080 }
  ];

  for (const vp of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.w,
      height: vp.h,
      deviceScaleFactor: 1,
      mobile: vp.w < 768
    });
    await new Promise(r => setTimeout(r, 200));

    const check = await evalCode(`
      (() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        return { docW, winW, hasOverflow: docW > winW };
      })()
    `);
    qaReport.overflow[vp.w] = check;
    console.log(`  -> ${vp.w}px breakpoint: hasOverflow = ${check.hasOverflow} (doc: ${check.docW}px, window: ${check.winW}px)`);
  }

  // Restore 1440px
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise(r => setTimeout(r, 200));

  // 3. Command Palette
  console.log('\n[TEST 3/8] Testing Command Palette (⌘K) Modal & Interactive Commands...');
  qaReport.commandPalette = await evalCode(`
    (async () => {
      const trigger = document.querySelector('button[title*="Command Palette"]');
      if (!trigger) return { error: 'Trigger button not found' };

      // 1. Click header button
      trigger.click();
      await new Promise(r => setTimeout(r, 250));

      const modal = document.getElementById('command-palette-modal');
      const input = modal?.querySelector('input');
      const opened = !!modal && !!input;

      if (!opened) return { error: 'Modal failed to open' };

      // 2. Type "help" command
      input.value = 'help';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 150));

      // 3. Type "neofetch" command
      input.value = 'neofetch';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 150));

      const logText = modal.querySelector('.overflow-y-auto')?.innerText || '';
      const hasHelp = logText.includes('neofetch') && logText.includes('directives');
      const hasNeofetch = logText.includes('alex@portfolio-core');

      // 4. Close via Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 250));
      const closed = !document.getElementById('command-palette-modal');

      return {
        openedOnTrigger: opened,
        helpCommandWorking: hasHelp,
        neofetchCommandWorking: hasNeofetch,
        closedOnEscape: closed
      };
    })()
  `);
  console.log('  -> Command Palette:', qaReport.commandPalette);

  // 4. Skills Filter
  console.log('\n[TEST 4/8] Testing Skills Categorization, Filtering & Active State Contrast...');
  qaReport.skills = await evalCode(`
    (async () => {
      const section = document.getElementById('skills');
      if (!section) return { error: 'Skills section not found' };

      const getFilterButtons = () => Array.from(section.querySelectorAll('.flex-wrap button'));
      const steps = [];

      // Button 1: 01 Programming Languages
      getFilterButtons()[1].click();
      await new Promise(r => setTimeout(r, 200));
      const active1 = getFilterButtons().find(b => b.className.includes('bg-accent'));
      const count1 = section.querySelectorAll('.grid > div').length;
      steps.push({
        clicked: '01 Programming Languages',
        activeBtnText: active1?.innerText.replace(/\\n/g, ' '),
        cardsCount: count1
      });

      // Button 2: 02 AI & Machine Learning
      getFilterButtons()[2].click();
      await new Promise(r => setTimeout(r, 200));
      const active2 = getFilterButtons().find(b => b.className.includes('bg-accent'));
      const count2 = section.querySelectorAll('.grid > div').length;
      steps.push({
        clicked: '02 AI & Machine Learning',
        activeBtnText: active2?.innerText.replace(/\\n/g, ' '),
        cardsCount: count2
      });

      // Toggle back to all
      getFilterButtons()[2].click();
      await new Promise(r => setTimeout(r, 200));
      const activeAll = getFilterButtons().find(b => b.className.includes('bg-accent'));
      const countAll = section.querySelectorAll('.grid > div').length;
      steps.push({
        action: 'Toggle back to all',
        activeBtnText: activeAll?.innerText.replace(/\\n/g, ' '),
        cardsCount: countAll
      });

      return { steps };
    })()
  `);
  console.log('  -> Skills Filter:', qaReport.skills);

  // 5. Featured Projects Carousel
  console.log('\n[TEST 5/8] Testing Featured Projects Carousel, Modal & Controls...');
  qaReport.carousel = await evalCode(`
    (async () => {
      const section = document.getElementById('work');
      if (!section) return { error: 'Work section not found' };

      const getTabs = () => Array.from(section.querySelectorAll('.grid.grid-cols-2 button'));
      const tabTitles = [];

      // Click each tab
      for (let i = 0; i < 4; i++) {
        getTabs()[i].click();
        await new Promise(r => setTimeout(r, 250));
        tabTitles.push(section.querySelector('h3')?.innerText || '');
      }

      // Next & Prev buttons
      const nextBtn = section.querySelector('button[aria-label="Next Project"]');
      const prevBtn = section.querySelector('button[aria-label="Previous Project"]');
      const titleBefore = section.querySelector('h3')?.innerText;

      nextBtn.click();
      await new Promise(r => setTimeout(r, 250));
      const titleAfterNext = section.querySelector('h3')?.innerText;

      prevBtn.click();
      await new Promise(r => setTimeout(r, 250));
      const titleAfterPrev = section.querySelector('h3')?.innerText;

      // Inspect Architecture Modal
      const inspectBtn = Array.from(section.querySelectorAll('button')).find(b => b.innerText.includes('Inspect Architecture'));
      let modalOpened = false;
      let modalClosedOnBackdrop = false;

      if (inspectBtn) {
        inspectBtn.click();
        await new Promise(r => setTimeout(r, 300));
        const modal = document.getElementById('architecture-modal');
        modalOpened = !!modal;

        if (modal) {
          modal.click();
          await new Promise(r => setTimeout(r, 300));
          modalClosedOnBackdrop = !document.getElementById('architecture-modal');
        }
      }

      return {
        tabTitles,
        nextWorking: titleBefore !== titleAfterNext,
        prevWorking: titleAfterNext !== titleAfterPrev,
        modalOpened,
        modalClosedOnBackdrop
      };
    })()
  `);
  console.log('  -> Carousel:', qaReport.carousel);

  // 6. Contact Form
  console.log('\n[TEST 6/8] Testing Contact Form Validation, Email Format & Submission...');
  qaReport.contactForm = await evalCode(`
    (async () => {
      const section = document.getElementById('contact');
      if (!section) return { error: 'Contact section not found' };

      const form = section.querySelector('form');
      if (!form) return { error: 'Contact form not found' };

      const nameInput = form.querySelector('input[placeholder*="Sarah"]');
      const emailInput = form.querySelector('input[placeholder*="@"]');
      const msgInput = form.querySelector('textarea');
      const submitBtn = form.querySelector('button[type="submit"]');

      // 1. Submit empty -> check errors
      submitBtn.click();
      await new Promise(r => setTimeout(r, 150));
      const emptyErrors = Array.from(form.querySelectorAll('.text-red-400 span')).map(s => s.innerText);

      // 2. Submit invalid email
      nameInput.value = 'Senior QA Inspector';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.value = 'not-an-email-format';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      msgInput.value = 'Valid verification message body.';
      msgInput.dispatchEvent(new Event('input', { bubbles: true }));

      submitBtn.click();
      await new Promise(r => setTimeout(r, 150));
      const invalidEmailErrors = Array.from(form.querySelectorAll('.text-red-400 span')).map(s => s.innerText);

      // 3. Valid submission
      emailInput.value = 'qa.inspector@example.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));

      submitBtn.click();
      await new Promise(r => setTimeout(r, 1200));

      const successTitle = section.querySelector('h4')?.innerText || '';
      const sendAnotherBtn = Array.from(section.querySelectorAll('button')).find(b => b.innerText.includes('SEND ANOTHER'));

      let formResetWorking = false;
      if (sendAnotherBtn) {
        sendAnotherBtn.click();
        await new Promise(r => setTimeout(r, 200));
        formResetWorking = !!section.querySelector('form');
      }

      return {
        emptyValidationErrors: emptyErrors,
        invalidEmailErrors,
        successTitle,
        formResetWorking
      };
    })()
  `);
  console.log('  -> Contact Form:', qaReport.contactForm);

  // 7. Cal.com Modal
  console.log('\n[TEST 7/8] Testing Cal.com Meeting Scheduler Modal & Slot Selection...');
  qaReport.calendarModal = await evalCode(`
    (async () => {
      const section = document.getElementById('contact');
      const openBtn = Array.from(section.querySelectorAll('button')).find(b => b.innerText.includes('OPEN CALENDAR SCHEDULER'));
      if (!openBtn) return { error: 'Calendar trigger button not found' };

      openBtn.click();
      await new Promise(r => setTimeout(r, 300));

      const modal = document.getElementById('calendar-scheduler-modal');
      const modalOpened = !!modal;

      let slotSelected = false;
      let slotConfirmation = '';
      let closedOnBackdrop = false;

      if (modal) {
        const slotButtons = Array.from(modal.querySelectorAll('.grid button'));
        if (slotButtons.length > 2) {
          slotButtons[2].click(); // Select 05:00 PM
          await new Promise(r => setTimeout(r, 150));
          slotSelected = slotButtons[2].className.includes('bg-accent');
          slotConfirmation = modal.querySelector('.text-accent.text-center')?.innerText || '';
        }

        // Close on backdrop
        modal.click();
        await new Promise(r => setTimeout(r, 300));
        closedOnBackdrop = !document.getElementById('calendar-scheduler-modal');
      }

      return {
        modalOpened,
        slotSelected,
        slotConfirmation,
        closedOnBackdrop
      };
    })()
  `);
  console.log('  -> Calendar Modal:', qaReport.calendarModal);

  // 8. Footer & Utility
  console.log('\n[TEST 8/8] Testing Footer Navigation, Copy Email & Back to Top...');
  qaReport.footer = await evalCode(`
    (async () => {
      // 1. Copy email button
      const copyBtn = document.querySelector('#contact button');
      let copyWorking = false;
      if (copyBtn) {
        copyBtn.click();
        await new Promise(r => setTimeout(r, 200));
        copyWorking = copyBtn.innerText.includes('COPIED');
      }

      // 2. Back to top button
      window.scrollTo(0, 3000);
      await new Promise(r => setTimeout(r, 150));
      const posBefore = window.scrollY;

      const backToTopBtn = document.querySelector('footer button[aria-label*="top"]');
      if (backToTopBtn) {
        backToTopBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }
      const posAfter = window.scrollY;

      const dynamicYear = document.querySelector('footer')?.innerText.includes('2026');

      return {
        copyEmailWorking: copyWorking,
        backToTopWorking: posAfter < posBefore,
        dynamicYearPresent: dynamicYear
      };
    })()
  `);
  console.log('  -> Footer:', qaReport.footer);

  qaReport.consoleErrors = consoleErrors;
  console.log('\nConsole Errors captured:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  const reportPath = path.join(scratch, 'final_qa_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(qaReport, null, 2));
  console.log('\n================================================================');
  console.log('   QA AUDIT COMPLETE — SAVED REPORT TO ' + reportPath);
  console.log('================================================================');

  ws.close();
  chrome.kill();
}

runFullQASuite().catch(console.error);
