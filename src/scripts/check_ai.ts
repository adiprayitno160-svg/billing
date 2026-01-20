
import { AISettingsService } from '../services/payment/AISettingsService';
import { databasePool } from '../db/pool';

async function checkAI() {
    try {
        console.log('--- Checking AI Settings ---');
        const settings = await AISettingsService.getSettings();
        console.log('Settings from DB:', JSON.stringify(settings, null, 2));

        const envKey = process.env.GEMINI_API_KEY;
        console.log('GEMINI_API_KEY in process.env:', envKey ? (envKey.substr(0, 5) + '...') : 'MISSING');

        const activeKey = await AISettingsService.getAPIKey();
        console.log('Active API Key to use:', activeKey ? (activeKey.substr(0, 5) + '...') : 'NONE');

        if (activeKey) {
            console.log('Testing connectivity...');
            const result = await AISettingsService.testAPIKey(activeKey);
            console.log('Test Result:', result);
        } else {
            console.log('No API Key available to test.');
        }

    } catch (e) {
        console.error('Error during AI check:', e);
    } finally {
        process.exit();
    }
}

checkAI();
