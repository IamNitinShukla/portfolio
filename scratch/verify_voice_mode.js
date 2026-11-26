const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function verifyVoiceMode() {
  console.log("Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Friday') || text.includes('Voice') || msg.type() === 'error') {
      console.log(`[Browser ${msg.type()}]`, text);
    }
  });

  console.log("Navigating to http://localhost:3000...");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

  // 1. Click mascot assistant button
  console.log("Locating assistant trigger button...");
  const triggerSelector = 'button[aria-label="Open portfolio assistant"]';
  await page.waitForSelector(triggerSelector, { timeout: 10000 });
  await page.click(triggerSelector);
  await page.waitForTimeout(1000);

  // 2. Click Voice Mode (Mic button in composer)
  console.log("Locating voice mode button in composer...");
  const micBtnSelector = 'button[title="Voice Mode"]';
  await page.waitForSelector(micBtnSelector, { timeout: 10000 });
  await page.click(micBtnSelector);
  await page.waitForTimeout(1500);

  // 3. Verify Voice Overlay is rendered
  const overlayText = await page.evaluate(() => {
    const el = document.querySelector('span.uppercase');
    return el ? el.textContent : null;
  });
  console.log("Voice mode state indicator:", overlayText);

  // Take screenshot of Voice Mode in action
  const artifactDir = 'C:/Users/WorkSpace/.gemini/antigravity/brain/2eaccac1-e0b4-4c95-a951-8bd5494d08d8';
  const screenshotPath = path.join(artifactDir, 'friday_voice_mediarecorder_active.png');
  await page.screenshot({ path: screenshotPath });
  console.log("Saved voice overlay screenshot to:", screenshotPath);

  // 4. Test typing query in overlay text fallback to verify full pipeline
  console.log("Testing query inside voice overlay...");
  const inputSelector = 'input[placeholder*="type question"]';
  await page.waitForSelector(inputSelector, { timeout: 5000 });
  await page.type(inputSelector, 'Who is Nitin Shukla?');

  const submitBtn = 'button[aria-label="Send typed query"]';
  await page.click(submitBtn);

  // Wait for state transition to thinking then speaking/streaming
  await page.waitForTimeout(3500);

  const postQueryState = await page.evaluate(() => {
    const el = document.querySelector('span.uppercase');
    return el ? el.textContent : null;
  });
  console.log("Post-query state indicator:", postQueryState);

  const screenshotPath2 = path.join(artifactDir, 'friday_voice_response_speaking.png');
  await page.screenshot({ path: screenshotPath2 });
  console.log("Saved response state screenshot to:", screenshotPath2);

  // 5. Exit Voice Mode
  console.log("Testing exit voice mode...");
  const exitBtn = 'button[aria-label="Exit Voice Mode"]';
  await page.click(exitBtn);
  await page.waitForTimeout(1000);

  // Verify back in chat mode with messages
  const messageCount = await page.evaluate(() => {
    return document.querySelectorAll('div[class*="bubble"]').length;
  });
  console.log("Returned to text chat. Total visible message bubbles:", messageCount);

  const screenshotPath3 = path.join(artifactDir, 'friday_voice_history_preserved.png');
  await page.screenshot({ path: screenshotPath3 });
  console.log("Saved chat history screenshot to:", screenshotPath3);

  await browser.close();
  console.log("Verification complete!");
}

verifyVoiceMode().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
