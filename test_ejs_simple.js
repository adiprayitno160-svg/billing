const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
const template = fs.readFileSync(filePath, 'utf8');

try {
    ejs.compile(template);
    console.log('EJS Parse Success!');
} catch (err) {
    console.error('EJS Parse Error:');
    console.error(err.message);
    if (err.line) {
        console.error('Line:', err.line);
        const lines = template.split('\n');
        console.error('Content:', lines[err.line - 1]);
    }
}
