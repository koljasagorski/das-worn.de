import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8787/folge/100', { waitUntil: 'networkidle' });
const initialUrl = page.url();

// Click emoji 5 times
for (let i = 0; i < 5; i++) {
  await page.click('#brand-emoji', { timeout: 3000 });
  await page.waitForTimeout(100);
}
await page.waitForTimeout(500);
const rainCount = await page.evaluate(() => document.querySelectorAll('.pommes-rain span').length);
const bannerExists = await page.evaluate(() => !!document.querySelector('.pommes-banner'));
console.log('Initial URL:', initialUrl);
console.log('Final URL  :', page.url(), '(should be unchanged)');
console.log('Pommes-rain spans:', rainCount, '(should be >0)');
console.log('Pommes-banner:', bannerExists, '(should be true)');

// Check mailto link
const mailto = await page.getAttribute('a[href^="mailto:"]', 'href');
console.log('Mailto link:', mailto);

await browser.close();
