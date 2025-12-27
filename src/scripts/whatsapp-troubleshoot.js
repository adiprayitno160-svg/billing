/**
 * WhatsApp Service Troubleshooter
 * Diagnose and fix WhatsApp QR code generation issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 WhatsApp Service Troubleshooter\n');
console.log('='.repeat(60));

// Check 1: Node modules
console.log('\n1️⃣ Checking node_modules...');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    console.log('✅ node_modules folder exists');

    // Check whatsapp-web.js
    const whatsappWebPath = path.join(nodeModulesPath, 'whatsapp-web.js');
    if (fs.existsSync(whatsappWebPath)) {
        console.log('✅ whatsapp-web.js is installed');
    } else {
        console.log('❌ whatsapp-web.js is NOT installed');
        console.log('   Run: npm install whatsapp-web.js');
    }

    // Check puppeteer
    const puppeteerPath = path.join(nodeModulesPath, 'puppeteer');
    if (fs.existsSync(puppeteerPath)) {
        console.log('✅ puppeteer is installed');

        // Check if Chromium is downloaded
        const chromiumPath = path.join(puppeteerPath, '.local-chromium');
        if (fs.existsSync(chromiumPath)) {
            console.log('✅ Chromium is downloaded');
        } else {
            console.log('⚠️ Chromium might not be downloaded yet');
            console.log('   This will be downloaded automatically on first run');
        }
    } else {
        console.log('❌ puppeteer is NOT installed');
        console.log('   Run: npm install puppeteer');
    }

    // Check qrcode
    const qrcodePath = path.join(nodeModulesPath, 'qrcode');
    if (fs.existsSync(qrcodePath)) {
        console.log('✅ qrcode is installed');
    } else {
        console.log('❌ qrcode is NOT installed');
        console.log('   Run: npm install qrcode');
    }

    // Check qrcode-terminal
    const qrcodeTerminalPath = path.join(nodeModulesPath, 'qrcode-terminal');
    if (fs.existsSync(qrcodeTerminalPath)) {
        console.log('✅ qrcode-terminal is installed');
    } else {
        console.log('❌ qrcode-terminal is NOT installed');
        console.log('   Run: npm install qrcode-terminal');
    }
} else {
    console.log('❌ node_modules folder does NOT exist');
    console.log('   Run: npm install');
}

// Check 2: WhatsApp session folder
console.log('\n2️⃣ Checking WhatsApp session folder...');
const sessionPath = path.join(__dirname, '..', 'whatsapp-session');
if (fs.existsSync(sessionPath)) {
    console.log('⚠️ whatsapp-session folder exists');
    console.log('   This means there might be an existing session');
    console.log('   If you want to generate a new QR code, delete this folder:');
    console.log(`   rm -rf "${sessionPath}"`);
    console.log('   Or on Windows:');
    console.log(`   rmdir /s /q "${sessionPath}"`);
} else {
    console.log('✅ No existing session - QR code should be generated on first run');
}

// Check 3: Check if server is running
console.log('\n3️⃣ Checking if server is running...');
console.log('   Run "pm2 list" to see if billing-app is running');
console.log('   If not running, start with: npm run pm2:start');

// Check 4: Port availability
console.log('\n4️⃣ Suggested actions:');
console.log('   a) Make sure all dependencies are installed:');
console.log('      npm install');
console.log('');
console.log('   b) Delete old session (if any):');
console.log('      Remove-Item -Recurse -Force whatsapp-session');
console.log('');
console.log('   c) Start/Restart server:');
console.log('      npm run pm2:start');
console.log('      or');
console.log('      npm run pm2:restart');
console.log('');
console.log('   d) Check server logs for WhatsApp initialization:');
console.log('      npm run pm2:logs');
console.log('      or');
console.log('      pm2 logs billing-app --lines 100');
console.log('');
console.log('   e) Open WhatsApp settings page:');
console.log('      http://localhost:3000/settings/whatsapp');
console.log('');

console.log('\n' + '='.repeat(60));
console.log('🔍 Troubleshooting complete!\n');
