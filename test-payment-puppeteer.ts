import puppeteer from 'puppeteer';

async function runTest() {
    console.log('--- STARTING PUPPETEER TEST ---');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to login...');
        await page.goto('http://192.168.239.154:3002/login');
        
        await page.type('input[name="username"]', 'admin');
        await page.type('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');
        
        await page.waitForNavigation();
        console.log('Logged in successfully.');
        
        console.log('Navigating to Invoice 839 pay page...');
        await page.goto('http://192.168.239.154:3002/billing/tagihan/839/pay');
        
        // Wait for page to load
        await page.waitForSelector('form');
        
        console.log('Filling payment details...');
        // Select 'cash' if it's a dropdown or radio. In payment-form.ejs it's likely a select.
        // Let's check the DOM or just type the amount.
        await page.type('input[name="payment_amount"]', '110000');
        
        console.log('Clicking process payment...');
        // Use a selector that matches the submit button
        await page.click('button[type="submit"]');
        
        // Wait for result
        console.log('Waiting for response...');
        await new Promise(r => setTimeout(r, 3000));
        
        await page.screenshot({ path: 'payment-result.png' });
        console.log('Screenshot saved: payment-result.png');
        
        await browser.close();
        process.exit(0);
    } catch (e: any) {
        console.error('PUPPETEER FAILED:', e.message);
        await browser.close();
        process.exit(1);
    }
}

runTest();
