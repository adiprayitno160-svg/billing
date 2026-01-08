
import { AISettingsService } from './src/services/payment/AISettingsService';
import { databasePool } from './src/db/pool';
import { GoogleGenerativeAI } from '@google/generative-ai';

const NEW_API_KEY = 'AIzaSyDc04ayVRX9bbIgGJSwhSq5LcPZUwH3DK8';

async function verifyWithFallback() {
    console.log(`\n--- Verifying Key: ${NEW_API_KEY.substring(0, 10)}... ---`);
    const genAI = new GoogleGenerativeAI(NEW_API_KEY);

    // List of models to try in order of preference
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];

    for (const modelName of modelsToTry) {
        console.log(`\nTesting model: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Hello check 123');
            await result.response;

            console.log(`✅ SUCCESS with model: ${modelName}`);

            // If successful, update the database
            console.log('Updating database settings...');
            await AISettingsService.updateSettings({
                api_key: NEW_API_KEY,
                model: modelName,
                enabled: true
            });
            console.log('✅ Database updated!');
            return; // Exit on first success

        } catch (error: any) {
            console.log(`❌ Failed with ${modelName}:`);
            // Only show short error message
            const msg = error.message || String(error);
            console.log(msg.split('\n')[0]);
        }
    }

    console.error('\n❌ All models failed with this API Key.');
}

async function main() {
    try {
        await verifyWithFallback();
    } catch (e) {
        console.error(e);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

main();
