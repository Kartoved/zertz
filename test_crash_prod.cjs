const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    fs.appendFileSync('console_error.log', `[${msg.type()}] ${msg.text()}\n`);
  });

  page.on('pageerror', exception => {
    fs.appendFileSync('console_error.log', `Uncaught exception: "${exception}"\n`);
  });

  try {
    await page.goto('http://localhost:5174/');
    // Wait a bit and click "Play Local" to trigger the crash
    await page.waitForTimeout(2000);
    // Find a button containing "Local" or "Локальная"
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.innerText();
      if (text.includes('Локальная') || text.includes('Local') || text.includes('Local')) {
        await btn.click();
        console.log('Clicked local start button');
        break;
      }
    }
    
    // Some buttons might open a modal, let's just wait to see if any errors logged
    await page.waitForTimeout(2000);
    
    // Play Local opens a modal "Choose board size", click 37
    const buttons2 = await page.$$('button');
    for (const btn of buttons2) {
      const text = await btn.innerText();
      if (text.includes('Малое (37)') || text.includes('37')) {
        await btn.click();
        console.log('Clicked 37 board size');
        break;
      }
    }
    await page.waitForTimeout(2000);

  } catch (err) {
    fs.appendFileSync('console_error.log', `Script error: "${err}"\n`);
  }

  await browser.close();
})();
