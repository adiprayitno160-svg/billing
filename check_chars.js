const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
const template = fs.readFileSync(filePath, 'utf8');

for (let i = 0; i < template.length; i++) {
    const char = template[i];
    const code = template.charCodeAt(i);
    if (code > 127 || (code < 32 && code !== 10 && code !== 13 && code !== 9)) {
        console.log(`Strange character at index ${i}, line ${template.substring(0, i).split('\n').length}: Code ${code} (${char})`);
    }
}
