const puppeteer = require('puppeteer');

(async () => {
    console.log("Starting puppeteer...");
    try {
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Listen to console logs from the page
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
        page.on('pageerror', error => console.log('BROWSER PAGE ERROR:', error.message));
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log('BROWSER NETWORK ERROR:', response.status(), response.url());
            }
        });

        const targetUrl = 'http://192.168.239.154/monitoring/public/enhanced-network-map';
        console.log("Navigating to", targetUrl, "...");
        
        const response = await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        console.log("Page HTTP Status:", response ? response.status() : 'Unknown');
        
        const html = await page.content();
        console.log("HTML Length:", html.length);
        if (response && response.status() >= 400) {
            console.log("BODY CONTENT:\n" + html.substring(0, 1000));
        }

        await browser.close();
        console.log("Done.");
    } catch (e) {
        console.error("Puppeteer Script Error:", e.message);
    }
})();
