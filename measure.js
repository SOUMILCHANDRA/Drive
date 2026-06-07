import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const server = spawn('npm', ['run', 'dev'], { shell: true });

let browserOpened = false;

server.stdout.on('data', async (data) => {
    const output = data.toString();
    const match = output.match(/http:\/\/localhost:\d+/);
    if (match && !browserOpened) {
        browserOpened = true;
        const url = match[0];
        console.log(`Server running at ${url}. Launching browser...`);
        try {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            
            let info = null;
            let logCount = 0;

            page.on('console', async msg => {
                if(msg.type() === 'log') {
                   const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => {})));
                   const arg0 = args[0];
                   if (arg0 && typeof arg0 === 'object' && arg0.calls !== undefined) {
                       info = arg0;
                       logCount++;
                   }
                }
            });

            await page.goto(url);
            await new Promise(r => setTimeout(r, 3000));
            
            // Start drive
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 3000));
            
            // Calculate FPS manually just in case
            const computedFps = await page.evaluate(async () => {
                return new Promise(resolve => {
                    let frames = 0;
                    let lastTime = performance.now();
                    const loop = (now) => {
                        frames++;
                        if (now - lastTime >= 1000) {
                            resolve(frames);
                            return;
                        }
                        requestAnimationFrame(loop);
                    }
                    requestAnimationFrame(loop);
                });
            });
            
            console.log('----- METRICS -----');
            console.log('Estimated FPS:', computedFps);
            console.log('Renderer Info:', info);
            
            await browser.close();
            server.kill();
            process.exit(0);
        } catch (e) {
            console.error(e);
            server.kill();
            process.exit(1);
        }
    }
});

server.stderr.on('data', data => console.error(data.toString()));
