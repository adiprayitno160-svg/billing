
const fs = require('fs');
const path = 'c:\\laragon\\www\\billing\\src\\services\\whatsapp\\WhatsAppHandler.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace "Promise < any >" with "Promise<any>"
// Also "Promise < any | null >" just in case
content = content.replace(/Promise\s*<\s*any\s*>/g, 'Promise<any>');
content = content.replace(/Promise\s*<\s*any\s*\|\s*null\s*>/g, 'Promise<any | null>');
content = content.replace(/Promise\s*<\s*RowDataPacket\[\]\s*>/g, 'Promise<RowDataPacket[]>');
content = content.replace(/query\s*<\s*RowDataPacket\[\]\s*>/g, 'query<RowDataPacket[]>');

// Remove redundant spaces in general around generic brackets if any
content = content.replace(/ < /g, '<');
content = content.replace(/ > /g, '>');

fs.writeFileSync(path, content);
console.log("Fixed spaces in " + path);
