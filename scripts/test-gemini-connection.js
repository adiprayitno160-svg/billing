
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testConnection() {
    console.log('Testing Gemini Connection...');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ No GEMINI_API_KEY found in .env');
        return;
    }
    console.log('API Key found (length):', apiKey.length);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Try a known valid model
        const modelName = 'gemini-1.5-flash';
        console.log(`Using model: ${modelName}`);

        const model = genAI.getGenerativeModel({ model: modelName });

        console.log('Sending request...');
        const result = await model.generateContent("Hello, are you online?");
        const response = await result.response;
        const text = response.text();

        console.log('✅ Success!');
        console.log('Response:', text);
    } catch (error) {
        console.error('❌ Connection Failed!');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.cause) console.error('Cause:', error.cause);
        if (error.stack) console.error('Stack:', error.stack);
    }
}

testConnection();
