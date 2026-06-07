import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log("Launching visible Chrome...");
        const browser = await puppeteer.launch({ 
            headless: false,
            defaultViewport: null
        });
        const page = await browser.newPage();

        let lastInfo = null;

        page.on('console', async msg => {
            if(msg.type() === 'log') {
               try {
                   const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => {})));
                   const arg0 = args[0];
                   if (arg0 && typeof arg0 === 'object' && arg0.calls !== undefined) {
                       lastInfo = arg0;
                   }
               } catch (e) {}
            }
        });

        console.log("Navigating to http://localhost:5173...");
        // avoid networkidle because of Vite's websocket
        const response = await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
        console.log("Response status:", response.status());
        
        console.log("Waiting 5 seconds for WebGL to init...");
        await new Promise(r => setTimeout(r, 5000));
        
        console.log('\n----- LIVE METRICS -----');
        if (lastInfo) {
            console.log('Draw Calls:', lastInfo.calls);
            console.log('Triangles:', lastInfo.triangles);
            console.log('Renderer Info:', JSON.stringify(lastInfo, null, 2));
        } else {
            console.log('No renderer info was logged.');
        }
        
        await browser.close();
        process.exit(0);
    } catch (e) {
        console.error("Puppeteer Error:", e);
        process.exit(1);
    }
})();
