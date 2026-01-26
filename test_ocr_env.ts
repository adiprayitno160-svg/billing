
import { OCRService } from './src/services/payment/OCRService';
import path from 'path';
import fs from 'fs';

async function testOCR() {
    console.log('Testing OCR Service...');

    // Create a dummy image buffer (or try to read if one exists, otherwise generate a simple text image if possible, 
    // but for now let's just check if we can initialize the service or if it fails on require)

    try {
        console.log('1. Checking dependencies...');
        const tesseract = require('tesseract.js');
        const sharp = require('sharp');
        console.log('Dependencies loaded.');

        console.log('2. Checking Lang Path...');
        const langPath = path.join(process.cwd());
        console.log('Lang path:', langPath);

        if (fs.existsSync(path.join(langPath, 'ind.traineddata'))) {
            console.log('✅ ind.traineddata found');
        } else {
            console.error('❌ ind.traineddata NOT found');
        }

        console.log('3. Please run "ts-node scripts/test-ocr-real.ts" with a real image path if you want to test actual recognition.');

    } catch (e: any) {
        console.error('OCR Test Execution Failed:', e);
    }
}

testOCR();
