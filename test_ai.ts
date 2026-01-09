
import { GeminiService } from './src/services/payment/GeminiService';

async function testAI() {
    try {
        console.log('Testing Gemini API...');
        // We don't have an image buffer, so we'll just test initialization
        // but let's try a very small dummy buffer if needed.
        const dummyBuffer = Buffer.from('test');

        // This will trigger initialization
        const isEnabled = await GeminiService.isEnabled();
        console.log('Gemini enabled:', isEnabled);

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testAI();
