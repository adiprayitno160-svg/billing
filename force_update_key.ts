
import { AISettingsService } from './src/services/payment/AISettingsService';
import { databasePool } from './src/db/pool';

const NEW_API_KEY = 'AIzaSyDc04ayVRX9bbIgGJSwhSq5LcPZUwH3DK8';
const TARGET_MODEL = 'gemini-1.5-flash'; // Lebih cepat dan stabil untuk verification

async function forceUpdate() {
    try {
        console.log(`\n--- Forcing Update with Validated Key ---`);
        console.log(`Key: ${NEW_API_KEY.substring(0, 10)}...`);
        console.log(`Model: ${TARGET_MODEL}`);

        // Update database directly
        await AISettingsService.updateSettings({
            api_key: NEW_API_KEY,
            model: TARGET_MODEL,
            enabled: true
        });

        console.log('✅ Database updated successfully.');

        // Verify what's in DB now
        const current = await AISettingsService.getSettings();
        console.log('Current DB State:', {
            api_key: current?.api_key ? current.api_key.substring(0, 10) + '...' : 'null',
            model: current?.model,
            enabled: current?.enabled
        });

    } catch (error) {
        console.error('Update Error:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

forceUpdate();
