import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  console.log('Navigating to game page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for title screen to be ready (assets loaded)
  console.log('Waiting for title-screen to be ready...');
  await page.waitForSelector('#title-screen.ready', { timeout: 60000 });
  await page.click('#title-screen.ready');
  console.log('Clicked title-screen.ready');

  // Wait for game to render
  console.log('Waiting 5s for game to render...');
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: 'biome_test.png' });
  console.log('Screenshot saved: biome_test.png');

  await browser.close();
})();
