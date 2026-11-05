import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log('Connecting to http://localhost:5173/ ...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[FLOATING ORIGIN]') || text.includes('ROAD CHUNK DIAGNOSTICS')) {
                console.log('PAGE LOG:', text);
            }
        });

        await page.goto('http://localhost:5173/');
        await page.waitForSelector('#title-screen.ready', { timeout: 30000 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 1500));
        
        console.log('Testing continuous road drive up to 10,000m (10 km)...');
        const result = await page.evaluate(async () => {
            const nightcall = window.__NIGHTCALL__;
            if (!nightcall) return { error: 'No __NIGHTCALL__' };
            const car = nightcall.car;
            const road = nightcall.road;

            const snapshots = [];
            let roadDisappeared = false;

            // Drive 10 km in increments of 500m
            for (let km = 0.5; km <= 10.0; km += 0.5) {
                const targetDistance = km * 1000;
                while ((car.position.z + road.worldZOffset) < targetDistance) {
                    car.speed = 50; // 180 km/h = 50 m/s
                    const dt = 0.05;
                    car.position.z += car.speed * dt;
                    
                    if (Math.abs(car.position.z) > 2000) {
                        const offsetZ = car.position.z;
                        car.shiftOrigin(offsetZ);
                        nightcall.cameraManager.shiftOrigin(offsetZ);
                        road.shiftOrigin(offsetZ);
                        nightcall.traffic.shiftOrigin(offsetZ);
                    }
                    
                    road.update(car.position.z, car.position, car.speed, dt, { chunkLimit: 3 });
                }

                const telem = road.getChunkTelemetry(car.position.z);
                // Continuous condition: nearest chunk covers behind (<= -50m) and farthest covers ahead (>= 600m)
                if (telem.nearestDist > -50 || telem.farthestDist < 600 || telem.activeChunks === 0) {
                    roadDisappeared = true;
                }

                snapshots.push({
                    km: km.toFixed(1) + 'km',
                    totalDistance: Math.round(car.position.z + road.worldZOffset) + 'm',
                    localCarZ: Math.round(car.position.z) + 'm',
                    worldZOffset: Math.round(road.worldZOffset) + 'm',
                    activeChunks: telem.activeChunks,
                    nearestDist: Math.round(telem.nearestDist) + 'm',
                    farthestDist: '+' + Math.round(telem.farthestDist) + 'm',
                    isContinuous: telem.isContinuous
                });
            }

            return {
                success: !roadDisappeared,
                snapshots
            };
        });

        console.log('10 km Acceptance Result:');
        console.log('Success (road never disappears):', result.success);
        console.table(result.snapshots);

        await browser.close();
        process.exit(result.success ? 0 : 1);
    } catch (e) {
        console.error('Error during 10km test:', e);
        process.exit(1);
    }
})();
