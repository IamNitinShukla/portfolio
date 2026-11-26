const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratch = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';

fs.mkdirSync(scratch, { recursive: true });

const targets = [
  { name: 'screen_desktop.png', w: 1440, h: 2800 },
  { name: 'screen_mobile.png', w: 390, h: 3200 }
];

for (const t of targets) {
  const outPath = path.join(scratch, t.name);
  console.log(`Taking screenshot: ${t.name}...`);
  try {
    execSync(`"${chrome}" --headless=new --disable-gpu --hide-scrollbars --window-size=${t.w},${t.h} --screenshot="${outPath}" http://localhost:3000`, {
      timeout: 30000
    });
    console.log(`Saved: ${outPath} (${fs.statSync(outPath).size} bytes)`);
  } catch (err) {
    console.error(`Failed ${t.name}:`, err.message);
  }
}
