const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://[::1]:5173/Alchemy/');
  await page.waitForTimeout(1000);
  await page.click('text=Homestead');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-homestead.png', fullPage: false });
  await browser.close();
})();
