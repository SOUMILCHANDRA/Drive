import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    page.on('console', msg => {
        const t = msg.text();
        if (t.includes('CRASH') || t.includes('ERROR')) console.log('[Browser Error]', t);
    });

    console.log('Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/');

    // 1. Verify Loading Progress Bar
    console.log('--- Verifying Loading Screen & Progress Bar ---');
    const loadingBarExists = await page.evaluate(() => {
        const bar = document.querySelector('#loading-bar');
        const container = document.querySelector('.loading-bar-container');
        return !!bar && !!container;
    });
    console.log('Loading bar exists in DOM:', loadingBarExists);

    await page.waitForSelector('#title-screen.ready', { timeout: 30000 });
    console.log('Title screen is ready (all assets loaded and pre-compiled).');

    // Check flash initial state (fade-in from black)
    const flashInitial = await page.evaluate(() => {
        const flash = document.getElementById('flash');
        return {
            opacity: flash ? window.getComputedStyle(flash).opacity : null,
            bg: flash ? window.getComputedStyle(flash).backgroundColor : null
        };
    });
    console.log('Initial Flash Screen (Black Fade-in):', flashInitial);

    // 2. Click start and verify transition
    await page.click('#title-screen.ready');
    await new Promise(r => setTimeout(r, 1500)); // wait for fade-in

    const flashAfterStart = await page.evaluate(() => {
        const flash = document.getElementById('flash');
        return flash ? window.getComputedStyle(flash).opacity : null;
    });
    console.log('Flash opacity after start (faded in to 0):', flashAfterStart);

    // 3. Inspect Polish Pass Systems in runtime
    const polishMetrics = await page.evaluate(() => {
        const app = window.__NIGHTCALL__;
        const road = app.road;
        const renderer = app.renderer;
        const scene = renderer.scene;

        // Check road roughness
        const roadMat = road.material;
        const roughness = roadMat ? roadMat.roughness : null;
        const envMapIntensity = roadMat ? roadMat.envMapIntensity : null;

        // Check terrain vertex colors and smooth normals
        const firstChunk = road.chunks[0];
        const terrainMesh = firstChunk ? firstChunk.leftTerrainMesh : null;
        const hasVertexColors = terrainMesh ? !!terrainMesh.geometry.attributes.color : false;
        const hasNormals = terrainMesh ? !!terrainMesh.geometry.attributes.normal : false;

        // Check streetlights pool
        const streetlightsCount = road.streetlights ? road.streetlights.length : 0;

        // Check fog color
        const fogColor = scene.fog ? '#' + scene.fog.color.getHexString() : null;

        // Check draw calls and FPS
        const calls = renderer.renderer.info.render.calls;

        // Check Near Miss Toast element
        const toast = document.getElementById('near-miss-toast');
        const toastCs = toast ? window.getComputedStyle(toast) : null;

        // Check Windshield Canvas
        const windshield = document.getElementById('windshield-canvas');

        return {
            roadRoughness: roughness,
            roadEnvMapIntensity: envMapIntensity,
            hasVertexColors,
            hasNormals,
            streetlightsCount,
            fogColor,
            drawCalls: calls,
            toastColor: toastCs ? toastCs.color : null,
            toastTransition: toastCs ? toastCs.transition : null,
            windshieldExists: !!windshield
        };
    });
    console.log('Polish Pass Metrics:', polishMetrics);

    // 4. Test Pause Menu Blur
    console.log('--- Verifying Pause Menu Blur ---');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    const pauseStyles = await page.evaluate(() => {
        const pauseMenu = document.getElementById('pauseMenu');
        const cs = pauseMenu ? window.getComputedStyle(pauseMenu) : null;
        return {
            display: cs ? cs.display : null,
            backdropFilter: cs ? cs.backdropFilter : null
        };
    });
    console.log('Pause Menu Styles:', pauseStyles);

    // Resume
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    // 5. Test Driving & Draw Calls Stability
    console.log('--- Driving at ~100 km/h to check stability and draw calls ---');
    await page.keyboard.down('KeyW');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.up('KeyW');

    const runtimeStats = await page.evaluate(() => {
        const car = window.__NIGHTCALL__.car;
        const renderer = window.__NIGHTCALL__.renderer;
        return {
            speedKmh: Math.round(car.speed * 3.6),
            drawCalls: renderer.renderer.info.render.calls
        };
    });
    console.log('Runtime Stats while driving:', runtimeStats);

    await browser.close();
    console.log('Step 5 Polish Pass test completed successfully!');
})();
