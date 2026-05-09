import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://[::1]:5173/Alchemy/');
await page.waitForTimeout(1000);
await page.click('text=Homestead');
await page.waitForTimeout(1000);
await page.click('text=Farm');
await page.waitForTimeout(2000);

const dims = await page.evaluate(() => {
  const frames = document.querySelectorAll('[class*="aspect-[4/3]"]');
  return Array.from(frames).map((f, i) => {
    const rect = f.getBoundingClientRect();
    return { index: i, width: rect.width, height: rect.height };
  });
});
console.log('Art frame dimensions:', JSON.stringify(dims, null, 2));

await page.screenshot({ path: 'screenshot-farm-fixed.png', fullPage: false });
await browser.close();
