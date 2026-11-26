const fs = require('fs');
const path = require('path');

const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0A0A0A" />
  <rect x="1" y="1" width="30" height="30" rx="7" fill="none" stroke="#E8FF70" stroke-width="1.5" stroke-opacity="0.6" />
  <circle cx="16" cy="16" r="5" fill="#E8FF70" />
</svg>`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), svgFavicon);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), svgFavicon);
console.log('Favicon generated');
