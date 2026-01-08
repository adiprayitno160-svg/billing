
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyDc04ayVRX9bbIgGJSwhSq5LcPZUwH3DK8';
const modelsToTest = [
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-2.5-flash'
];

async function testModels() {
    console.log('Testing models for quota/availability...');
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of modelsToTest) {
        console.log(`\n--- Testing ${modelName} ---`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Hello, just checking connection.');
            await result.response;
            console.log(`✅ SUCCESS: ${modelName} is working!`);

            // If success, we want to know so we can stop
            process.exit(0);
        } catch (error: any) {
            console.log(`❌ FAILED: ${modelName}`);
            // Extract error message
            const msg = error.message || String(error);
            if (msg.includes('429')) {
                console.log('Error: 429 Quota Exceeded / Limit 0');
            } else if (msg.includes('404')) {
                console.log('Error: 404 Not Found');
            } else {
                console.log('Error:', msg.split('\n')[0]);
            }
        }
    }
}

testModels();
