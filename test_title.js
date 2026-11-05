import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#title-screen.ready', { timeout: 30000 });

    // Inspect Title Screen computed styles
    const titleStyles = await page.evaluate(() => {
        const titleEl = document.querySelector('.neon-title');
        const radialGlow = document.querySelector('.title-radial-glow');
        const scanlines = document.querySelector('.title-scanlines');
        const csTitle = window.getComputedStyle(titleEl);
        const csGlow = window.getComputedStyle(radialGlow);
        const csScan = window.getComputedStyle(scanlines);
        return {
            titleFont: csTitle.fontFamily,
            titleColor: csTitle.color,
            titleTextShadow: csTitle.textShadow,
            titleAnimation: csTitle.animationName,
            glowDisplay: csGlow.display,
            glowBackground: csGlow.backgroundImage || csGlow.background,
            scanlinesAnimation: csScan.animationName
        };
    });
    console.log('Title Screen Computed Styles:', titleStyles);

    await page.screenshot({ path: 'title_screen.png' });
    console.log('Saved title_screen.png');

    // Click into game and inspect HUD styles
    await page.click('#title-screen.ready');
    await new Promise(r => setTimeout(r, 1200));

    const hudStyles = await page.evaluate(() => {
        const speedVal = document.querySelector('#speed-val');
        const distVal = document.querySelector('#dist-val');
        const callsVal = document.querySelector('#calls-val');
        const csSpeed = window.getComputedStyle(speedVal);
        const csDist = window.getComputedStyle(distVal);
        const calls = window.__NIGHTCALL__.renderer.renderer.info.render.calls;
        return {
            speedColor: csSpeed.color,
            speedShadow: csSpeed.textShadow,
            distColor: csDist.color,
            callsValColor: window.getComputedStyle(callsVal).color,
            drawCalls: calls
        };
    });
    console.log('HUD Computed Styles & Calls:', hudStyles);

    await browser.close();
    console.log('Step 4 test completed successfully.');
})();
