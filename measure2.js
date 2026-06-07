import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log("Launching browser...");
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        let info = null;

        page.on('console', async msg => {
            if(msg.type() === 'log') {
                try {
                    const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
                    const arg0 = args[0];
                    if (arg0 && typeof arg0 === 'object' && arg0.calls !== undefined) {
                        info = arg0;
                    }
                } catch(e) {}
            }
        });

        console.log("Navigating...");
        await page.goto('http://localhost:5175/');
        await new Promise(r => setTimeout(r, 2000));
        
        console.log("Pressing Enter...");
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 3000));
        
        console.log('----- METRICS -----');
        console.log('Renderer Info:', JSON.stringify(info, null, 2));
        
        await browser.close();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
