
const fs = require('fs');
const content = fs.readFileSync('c:\\laragon\\www\\billing\\src\\services\\whatsapp\\WhatsAppHandler.ts', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple count (ignoring strings/comments for speed, assuming code is mostly clean)
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    // Check state BEFORE line processing (for 'private' keyword check)
    if (line.trim().startsWith('private static') || line.trim().startsWith('public static') || line.trim().startsWith('static')) {
        if (balance === 0) {
            console.log(`[ERROR] Line ${i + 1}: Member declared outside class! Balance=${balance}`);
            console.log(`Line content: ${line.trim()}`);
        }
    }

    balance += opens - closes;

    if (balance < 0) {
        console.log(`[ERROR] Line ${i + 1}: Negative balance! Balance=${balance}`);
    }
}
console.log(`Final balance: ${balance}`);
