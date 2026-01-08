
const apiKey = 'AIzaSyDc04ayVRX9bbIgGJSwhSq5LcPZUwH3DK8';
const model = 'gemini-1.5-flash';

async function testRawGeneration() {
    console.log(`Testing raw REST generation for ${model}...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{
                text: "Hello, are you working?"
            }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error Details:', errorText);
        } else {
            const data = await response.json();
            console.log('✅ Success!');
            console.log('Response:', JSON.stringify(data, null, 2));
        }

    } catch (error: any) {
        console.error('Fetch Error:', error.message);
    }
}

testRawGeneration();
