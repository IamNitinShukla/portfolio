const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const p = targets.find(t => t.type === 'page');
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const btns = Array.from(document.querySelectorAll('button')).map(b => ({
              text: b.innerText,
              aria: b.getAttribute('aria-label'),
              cls: b.className
            }));
            const videos = Array.from(document.querySelectorAll('video')).map(v => v.src);
            return { btns, videos, title: document.title, url: window.location.href };
          })()`,
          returnByValue: true
        }
      }));
    };
    ws.onmessage = (e) => {
      console.log(JSON.stringify(JSON.parse(e.data).result, null, 2));
      process.exit(0);
    };
  });
});
