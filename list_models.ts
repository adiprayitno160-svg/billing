
import { GoogleGenerativeAI } from '@google/generative-ai';
const fileName = 'list_models.ts';
const apiKey = 'AIzaSyDc04ayVRX9bbIgGJSwhSq5LcPZUwH3DK8';

async function listModels() {
    console.log(`Checking models for key: ${apiKey.substring(0, 10)}...`);
    try {
        // We have to use the REST API manually because listModels might not be exposed easily in the helper
        // Actually it is in the newer SDK, but let's use fetch to be raw and sure.

        // Using fetch to call list models endpoint
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('API Error:', JSON.stringify(data.error, null, 2));
            return;
        }

        if (data.models) {
            console.log('✅ Available Models (Filtered):');
            data.models.forEach((m: any) => {
                if (m.name.includes('flash') || m.name.includes('pro')) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log('No models found in response:', data);
        }

    } catch (error: any) {
        console.error('Script failed:', error.message);
    }
}

listModels();
