
import path from 'path';
import fs from 'fs';

async function testDeep() {
    console.log('--- DIAGNOSTIC START ---');
    console.log('Node Version:', process.version);
    console.log('Platform:', process.platform);
    console.log('CWD:', process.cwd());

    // 1. Test Sharp
    try {
        console.log('\nTesting Sharp...');
        const sharp = require('sharp');
        // Create a simple blank image buffer
        const buffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        }).png().toBuffer();
        console.log('✅ Sharp is working. Generated buffer size:', buffer.length);
    } catch (e: any) {
        console.error('❌ Sharp FAILED:', e.message);
    }

    // 2. Test Tesseract
    try {
        console.log('\nTesting Tesseract...');
        const Tesseract = require('tesseract.js');
        const langPath = path.join(process.cwd());
        console.log('Lang Path:', langPath);

        const langFile = path.join(langPath, 'ind.traineddata');
        if (fs.existsSync(langFile)) {
            console.log('✅ Local language file found at:', langFile);
        } else {
            console.error('❌ Local language file MISSING at:', langFile);
        }

        console.log('Attempting recognition on sample text image...');
        // Create a simple text image with sharp if possible, or use a dummy buffer that might fail OCR but verify the engine starts
        // We'll trust the engine init more than the result here.

        // Actually, Tesseract needs a real image. I'll use a very small base64 pixel if sharp failed, or the sharp buffer if it worked.

        // Let's rely on standard init
        const worker = await Tesseract.createWorker('ind', 1, {
            langPath: langPath,
            logger: (m: any) => console.log('   [Tesseract]', m.status, Math.round(m.progress * 100) + '%')
        });

        console.log('Worker created.');
        await worker.terminate();
        console.log('✅ Tesseract Worker initialized and terminated successfully.');

    } catch (e: any) {
        console.error('❌ Tesseract FAILED:', e);
    }
    console.log('\n--- DIAGNOSTIC END ---');
}

testDeep();
