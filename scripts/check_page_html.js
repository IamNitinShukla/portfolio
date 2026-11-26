const http = require('http');

http.get('http://localhost:3000', (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    console.log('Status:', res.status);
    console.log('Includes <form:', d.includes('<form'));
    console.log('Includes id="contact":', d.includes('id="contact"'));
    console.log('Includes Message Dispatched:', d.includes('Message Dispatched'));
    console.log('Includes Send a Direct Message:', d.includes('Send a Direct Message'));
  });
});
