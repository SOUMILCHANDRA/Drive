import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:5173/');

  // Wait for splash and click
  await page.waitForSelector('#splash');
  await page.click('#splash');
  console.log('Clicked splash');

  // Wait for game to render
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: 'biome_test.png' });
  console.log('Screenshot saved: biome_test.png');

  await browser.close();
})();
