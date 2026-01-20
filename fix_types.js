
const fs = require('fs');
const path = 'c:\\laragon\\www\\billing\\src\\services\\whatsapp\\WhatsAppHandler.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix Promise spaces
content = content.replace(/Promise\s*<\s*([^>]+)\s*>/g, 'Promise<$1>');

// Fix redundant catch block if any (double check)
// Fix any other obvious spacing issues in types

fs.writeFileSync(path, content);
console.log("Fixed Promise spaces.");
