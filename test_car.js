import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    let sceneGraphPrinted = false;
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('CAR SCENE GRAPH TREE') || text.includes('├─')) {
            console.log(text);
            sceneGraphPrinted = true;
        }
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#title-screen.ready', { timeout: 30000 });
    await page.click('#title-screen.ready');
    await new Promise(r => setTimeout(r, 2000));
    
    const carMetrics = await page.evaluate(() => {
        const nightcall = window.__NIGHTCALL__;
        const car = nightcall.car;
        const renderer = nightcall.renderer;
        
        // Bounding box of car.model
        let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        car.model.traverse(c => {
            if (c.geometry && c.geometry.boundingBox) {
                const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
                if (b.min.x < minX) minX = b.min.x;
                if (b.max.x > maxX) maxX = b.max.x;
                if (b.min.y < minY) minY = b.min.y;
                if (b.max.y > maxY) maxY = b.max.y;
                if (b.min.z < minZ) minZ = b.min.z;
                if (b.max.z > maxZ) maxZ = b.max.z;
            }
        });
        
        return {
            carLength: maxZ - minZ,
            carWidth: maxX - minX,
            carHeight: maxY - minY,
            wheelsCount: car.wheels.length,
            drawCalls: renderer.renderer.info.render.calls
        };
    });

    console.log('Car Metrics:', carMetrics);
    await page.screenshot({ path: 'car_test.png' });
    console.log('Saved screenshot car_test.png');

    await browser.close();
    process.exit(0);
})();
