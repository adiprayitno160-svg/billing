
const fs = require('fs');
const content = fs.readFileSync('c:\\laragon\\www\\billing\\src\\services\\whatsapp\\WhatsAppHandler.ts', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') {
            stack.push(i + 1);
        } else if (line[j] === '}') {
            const startLine = stack.pop();
            if (i + 1 >= 1100 || startLine >= 1100) {
                console.log(`Open at L${startLine} - Close at L${i + 1}`);
            }
        }
    }
}
if (stack.length > 0) {
    console.log("Unclosed braces at lines: " + stack.join(", "));
} else {
    console.log("All braces closed.");
}
