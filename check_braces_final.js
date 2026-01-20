
const fs = require('fs');
const content = fs.readFileSync('c:\\laragon\\www\\billing\\src\\services\\whatsapp\\WhatsAppHandler.ts', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    balance += opens - closes;
    // console.log(`L${i+1}: ${balance}`);
}
console.log(`Final balance: ${balance}`);
