const http = require('http');

http.get('http://127.0.0.1:9222/json', res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log('Targets:', JSON.parse(d)));
}).on('error', err => console.error('Error:', err.message));
