const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function measure() {
  console.log('Measuring performance metrics...');
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

  await send('Performance.enable');

  const evalCode = async (code) => {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  };

  await new Promise(r => setTimeout(r, 2000));

  // Get Web Vitals and Navigation Timing
  const metrics = await evalCode(`
    (() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
      const resources = performance.getEntriesByType('resource').map(r => ({
        name: r.name.split('/').pop().split('?')[0] || r.name,
        type: r.initiatorType,
        size: r.transferSize || r.encodedBodySize || 0,
        duration: Math.round(r.duration)
      }));

      // Calculate CLS if supported
      let cls = 0;
      const layoutShifts = performance.getEntriesByType('layout-shift');
      if (layoutShifts) {
        for (const shift of layoutShifts) {
          if (!shift.hadRecentInput) cls += shift.value;
        }
      }

      const totalResourceBytes = resources.reduce((acc, r) => acc + r.size, 0);

      return {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
        fcp: Math.round(fcp),
        cls: Math.round(cls * 1000) / 1000,
        resourceCount: resources.length,
        totalResourceKB: Math.round(totalResourceBytes / 1024),
        resourcesBreakdown: {
          scripts: resources.filter(r => r.type === 'script').length,
          css: resources.filter(r => r.type === 'css' || r.type === 'link').length,
          images: resources.filter(r => r.type === 'img').length,
          fonts: resources.filter(r => r.name.includes('.woff') || r.type === 'font').length
        }
      };
    })()
  `);

  const perfMetrics = await send('Performance.getMetrics');
  const findMetric = (name) => perfMetrics.metrics.find(m => m.name === name)?.value;

  console.log('--- BASELINE PERFORMANCE AUDIT RESULTS ---');
  console.log('TTFB:', metrics.ttfb, 'ms');
  console.log('FCP:', metrics.fcp, 'ms');
  console.log('DOMContentLoaded:', metrics.domContentLoaded, 'ms');
  console.log('Load Complete:', metrics.loadComplete, 'ms');
  console.log('CLS (Cumulative Layout Shift):', metrics.cls);
  console.log('Total Resources:', metrics.resourceCount, `(${metrics.totalResourceKB} KB)`);
  console.log('Resources Breakdown:', metrics.resourcesBreakdown);
  console.log('DOM Nodes:', findMetric('Nodes'));
  console.log('JS Heap Used:', Math.round(findMetric('JSHeapUsedSize') / 1024 / 1024 * 10) / 10, 'MB');

  ws.close();
  chrome.kill();
}

measure().catch(console.error);
