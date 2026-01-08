
import { AISettingsService } from './src/services/payment/AISettingsService';
import { databasePool } from './src/db/pool';

const NEW_API_KEY = 'AIzaSyB5C3FP1IJXoXo_ZDl_VCvS5trOs8S4WvQ';

async function updateKey() {
    try {
        console.log(`\n--- Testing New API Key: ${NEW_API_KEY.substring(0, 10)}... ---`);

        const result = await AISettingsService.testAPIKey(NEW_API_KEY);
        console.log('Test Result:', result);

        if (result.success) {
            console.log('\n>>> KEY VALID! Updating database...');
            await AISettingsService.updateSettings({
                api_key: NEW_API_KEY,
                model: 'gemini-1.5-flash',
                enabled: true
            });
            console.log('✅ Database updated successfully.');
        } else {
            console.error('\n>>> KEY INVALID. Database NOT updated.');
            console.error('Reason:', result.message);
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

updateKey();
