const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratch = 'C:\\Users\\WorkSpace\\.gemini\\antigravity\\brain\\2eaccac1-e0b4-4c95-a951-8bd5494d08d8\\scratch';

// We will use a small node script that launches chrome with specific scroll or takes slices
// In headless chrome, window-size controls viewport. If we capture with a full page script:
const sections = [
  { name: 'section_hero.png', url: 'http://localhost:3000/#hero', w: 1440, h: 900 },
  { name: 'section_philosophy.png', url: 'http://localhost:3000/#philosophy', w: 1440, h: 1000 },
  { name: 'section_about.png', url: 'http://localhost:3000/#about', w: 1440, h: 1000 },
  { name: 'section_skills.png', url: 'http://localhost:3000/#skills', w: 1440, h: 1100 },
  { name: 'section_work.png', url: 'http://localhost:3000/#work', w: 1440, h: 1200 },
  { name: 'section_experience.png', url: 'http://localhost:3000/#experience', w: 1440, h: 1000 },
  { name: 'section_contact.png', url: 'http://localhost:3000/#contact', w: 1440, h: 1000 }
];

for (const s of sections) {
  const outPath = path.join(scratch, s.name);
  try {
    execSync(`"${chrome}" --headless=new --disable-gpu --hide-scrollbars --window-size=${s.w},${s.h} --screenshot="${outPath}" "${s.url}"`, {
      timeout: 20000
    });
    console.log(`Captured ${s.name}: ${fs.statSync(outPath).size} bytes`);
  } catch (e) {
    console.error(`Failed ${s.name}:`, e.message);
  }
}
