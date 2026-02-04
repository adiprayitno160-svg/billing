require('dotenv').config();
const { IsolationService } = require('./dist/services/billing/isolationService');

async function test() {
    console.log('--- STARTING H-1 WARNING TEST ---');
    try {
        const result = await IsolationService.sendIsolationH1Warnings();
        console.log('RESULT:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('ERROR:', error);
    }
    console.log('--- TEST FINISHED ---');
    process.exit(0);
}

test();
