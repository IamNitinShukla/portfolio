const { spawn } = require('child_process');
const http = require('http');

async function debug() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9234',
    '--user-data-dir=C:\\Users\\WorkSpace\\AppData\\Local\\Temp\\chrome-c1-test',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((res) => {
    http.get('http://127.0.0.1:9234/json/list', r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    });
  });
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise(r => {
      const id = Math.random();
      const fn = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) { ws.removeEventListener('message', fn); r(msg.result); }
      };
      ws.addEventListener('message', fn);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.evaluate', { expression: 'sessionStorage.setItem("portfolio_intro_seen", "true"); location.reload();' });
  await new Promise(r => setTimeout(r, 2500));
  await send('Runtime.evaluate', { expression: 'document.querySelector("[data-testid=\\"mascot-assistant-trigger\\"]").click();' });
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.evaluate', { expression: 'Array.from(document.querySelectorAll("dialog[open] button")).find(b => b.textContent.includes("Tech stack")).click();' });
  await new Promise(r => setTimeout(r, 3500));

  const diag = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvases = Array.from(document.querySelectorAll('dialog[open] canvas'));
      const video = document.querySelector('video');
      const c1 = canvases[1];
      if (!c1) return 'c1 not found';

      // Test 1: Can we draw on c1?
      const ctx = c1.getContext('2d');
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, 0, 50, 50);
      const dataAfterFill = ctx.getImageData(0, 0, 50, 50).data[2];

      // Test 2: What happens if we drawImage(video)?
      let drawError = null;
      try {
        ctx.clearRect(0, 0, 136, 136);
        ctx.drawImage(video, 0, 0, 136, 136);
      } catch(e) {
        drawError = e.message;
      }
      const dataAfterDraw = ctx.getImageData(50, 50, 1, 1).data;

      // Test 3: What is the existing useReplyAvatars doing right now?
      return {
        c0NonTransparent: (() => {
          const d = canvases[0].getContext('2d').getImageData(0,0,136,136).data;
          let count = 0; for(let i=3;i<d.length;i+=4) if(d[i]>10) count++;
          return count;
        })(),
        c1Width: c1.width,
        c1Height: c1.height,
        c1ClientWidth: c1.clientWidth,
        c1ClientHeight: c1.clientHeight,
        blueFilled: dataAfterFill,
        drawError,
        dataAfterDraw: Array.from(dataAfterDraw),
        videoReady: video ? video.readyState : null,
        videoWidth: video ? video.videoWidth : null,
        videoHeight: video ? video.videoHeight : null,
        videoCurrentTime: video ? video.currentTime : null,
        videoPaused: video ? video.paused : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Diagnostic result:', JSON.stringify(diag.result.value, null, 2));
  chromeProc.kill();
  process.exit(0);
}
debug();
