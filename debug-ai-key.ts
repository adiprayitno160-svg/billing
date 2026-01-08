
import { AISettingsService } from './src/services/payment/AISettingsService';
import { databasePool } from './src/db/pool';

async function checkKey() {
    try {
        console.log('--- Checking Current AI Settings ---');
        const currentSettings = await AISettingsService.getSettings();
        console.log('Current Settings:', JSON.stringify(currentSettings, null, 2));

        const keyToTest = 'gen-lang-client-0958805957';
        console.log(`\n--- Testing Provided Key: ${keyToTest} ---`);

        try {
            const result = await AISettingsService.testAPIKey(keyToTest);
            console.log('Test Result:', result);
        } catch (err: any) {
            console.error('Test Failed Exception:', err.message);
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

checkKey();
