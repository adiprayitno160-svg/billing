
const fs = require('fs');
const content = fs.readFileSync('c:\\laragon\\www\\billing\\src\\services\\whatsapp\\WhatsAppHandler.ts', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') {
            stack.push({ line: i + 1, content: line.trim() });
        } else if (line[j] === '}') {
            const start = stack.pop();
            console.log(`L${start.line} -> L${i + 1} | ${start.content.substring(0, 40)} ... ${line.trim().substring(0, 20)}`);
        }
    }
}
if (stack.length > 0) {
    stack.forEach(s => console.log(`UNCLOSED: L${s.line} | ${s.content}`));
}
