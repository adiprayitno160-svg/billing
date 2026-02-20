const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
const template = fs.readFileSync(filePath, 'utf8');
const lines = template.split('\n');

function check(content) {
    try {
        // We try to wrap it to avoid common "unexpected end of input" for partial tags
        // But for "unexpected token", it usually fails even if unbalanced if the token itself is bad.
        ejs.compile(content);
        return true;
    } catch (err) {
        if (err.message.includes('Invalid or unexpected token')) return false;
        return true; // Ignore other errors for now
    }
}

console.log('Total lines:', lines.length);

// Let's test tags one by one. This is the surest way.
const tagRegex = /<%([\s\S]*?)%>/g;
let match;
while ((match = tagRegex.exec(template)) !== null) {
    const full = match[0];
    const line = template.substring(0, match.index).split('\n').length;
    try {
        ejs.compile(full);
    } catch (e) {
        if (e.message.includes('Invalid or unexpected token')) {
            console.log(`FOUND ERROR in tag at line ${line}:`);
            console.log(full);
            console.log(e.message);
            console.log('---');
        }
    }
}
