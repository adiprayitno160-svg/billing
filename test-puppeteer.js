const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Puppeteer launched successfully with bundled Chromium!');
    await browser.close();
  } catch (e) {
    console.error('Puppeteer failed with bundled Chromium:', e.message);
  }
})();
