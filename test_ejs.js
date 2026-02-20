const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
const template = fs.readFileSync(filePath, 'utf8');
const lines = template.split('\n');

// Find all tags with line numbers
const tagsWithInfo = [];
let currentIndex = 0;
const tagRegex = /<%([\s\S]*?)%>/g;
let match;

while ((match = tagRegex.exec(template)) !== null) {
    const content = match[1];
    const offset = match.index;
    const lineNumber = template.substring(0, offset).split('\n').length;
    tagsWithInfo.push({ content, lineNumber, full: match[0] });
}

tagsWithInfo.forEach((tag, idx) => {
    try {
        // Just checking if the content is a valid JS statement/expression
        new Function(tag.content);
    } catch (err) {
        // Ignore errors that are expected due to split logic (like if/else/for)
        if (tag.content.trim().match(/^(if|else|for|while|}|catch|finally)/)) return;

        console.log(`Potential Syntax Error in tag ${idx} at line ${tag.lineNumber}:`);
        console.log(tag.full);
        console.log(err.message);
        console.log('---');
    }
});
