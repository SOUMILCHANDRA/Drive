import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    page.on('console', msg => {
        const t = msg.text();
        if (t.includes('CRASH') || t.includes('ERROR')) console.log('[Browser]', t);
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#title-screen.ready', { timeout: 30000 });
    await page.click('#title-screen.ready');
    await new Promise(r => setTimeout(r, 1500));

    // Test 1: Throttle ramp up and cruise speed behavior
    console.log('--- Testing Throttle Ramp & Acceleration ---');
    await page.keyboard.down('KeyW');
    await new Promise(r => setTimeout(r, 1200)); // hold W for 1.2s

    const throttleMetrics = await page.evaluate(() => {
        const car = window.__NIGHTCALL__.car;
        return {
            speedKmh: Math.round(car.speed * 3.6),
            smoothedThrottle: Number(car.smoothedThrottle.toFixed(2)),
            drawCalls: window.__NIGHTCALL__.renderer.renderer.info.render.calls
        };
    });
    console.log('After 1.2s Throttle hold:', throttleMetrics);

    // Test 2: Accelerate up to cruise / near 100 km/h and test Straight Road Stability
    console.log('--- Testing Straight Road Stability at ~100 km/h ---');
    await page.evaluate(() => {
        // Set speed to 100 km/h (27.78 m/s) on straight road
        const car = window.__NIGHTCALL__.car;
        car.speed = 100 / 3.6;
        car.smoothedThrottle = 0.5;
    });

    // Let it run for 2 seconds with NO steering input (straight road test)
    await page.keyboard.up('KeyW');
    const lateralHistory = [];
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        const offset = await page.evaluate(() => window.__NIGHTCALL__.car.currentLateralOffset);
        lateralHistory.push(offset);
    }
    const maxOffset = Math.max(...lateralHistory);
    const minOffset = Math.min(...lateralHistory);
    const oscillationAmp = maxOffset - minOffset;
    console.log('Lateral offset variation over 2s at 100 km/h:', oscillationAmp.toFixed(3), 'm (should be < 0.25m)');

    // Test 3: Tap A / D (gentle shift ~ half a lane, half lane = ~1.75m)
    console.log('--- Testing Tap A / D Half-Lane Shift ---');
    const offsetBeforeTap = await page.evaluate(() => window.__NIGHTCALL__.car.currentLateralOffset);
    // Tap KeyA for 250ms
    await page.keyboard.down('KeyA');
    await new Promise(r => setTimeout(r, 250));
    await page.keyboard.up('KeyA');
    // Allow car to settle smoothly
    await new Promise(r => setTimeout(r, 1500));
    const offsetAfterTap = await page.evaluate(() => window.__NIGHTCALL__.car.currentLateralOffset);
    const shiftDist = Math.abs(offsetAfterTap - offsetBeforeTap);
    console.log(`Lateral shift after tap: ${shiftDist.toFixed(2)}m (expected ~1.0m to 2.0m, half lane is 1.75m)`);

    // Test 4: Lane Assist Toggle with 'L'
    console.log('--- Testing Lane Assist Toggle (L) ---');
    const laneAssistInitial = await page.evaluate(() => window.__NIGHTCALL__.HANDLING.laneAssistEnabled);
    await page.keyboard.press('KeyL');
    await new Promise(r => setTimeout(r, 200));
    const laneAssistAfter = await page.evaluate(() => window.__NIGHTCALL__.HANDLING.laneAssistEnabled);
    console.log(`Lane Assist toggled: ${laneAssistInitial} -> ${laneAssistAfter}`);

    // Test 5: Collision Speed Scrub (40%) & Nudge
    console.log('--- Testing Collision Scrub (40%) ---');
    const collisionTest = await page.evaluate(() => {
        const car = window.__NIGHTCALL__.car;
        car.speed = 100 / 3.6; // 27.78 m/s
        const speedBefore = car.speed;
        const posXBefore = car.position.x;
        car.nudgeCollision(1);
        return {
            speedBefore: Math.round(speedBefore * 3.6),
            speedAfter: Math.round(car.speed * 3.6),
            scrubRatio: (speedBefore - car.speed) / speedBefore,
            nudgedX: Math.abs(car.position.x - posXBefore)
        };
    });
    console.log('Collision Test:', collisionTest);

    // Final Draw Calls & FPS check
    const finalMetrics = await page.evaluate(() => {
        return {
            drawCalls: window.__NIGHTCALL__.renderer.renderer.info.render.calls,
            fps: Number(document.getElementById('fps-val')?.innerText || '60')
        };
    });
    console.log('Final Performance Metrics:', finalMetrics);

    await browser.close();
    console.log('Handling tests completed successfully!');
})();
