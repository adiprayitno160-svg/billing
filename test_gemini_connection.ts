
import { GeminiService } from './src/services/payment/GeminiService';
import { AISettingsService } from './src/services/payment/AISettingsService';

async function testGemini() {
    try {
        const apiKey = await AISettingsService.getAPIKey();
        console.log('API Key from DB:', apiKey ? apiKey.substring(0, 10) + '...' : 'NONE');

        const isEnabled = await AISettingsService.isEnabled();
        console.log('AI Enabled:', isEnabled);

        // Try a simple test (not an image, but just checking if it can initialize)
        const result = await AISettingsService.testAPIKey(apiKey || '');
        console.log('Test Result:', JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
testGemini();
