const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Remove BOM if exists
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
    console.log('Removed BOM from the start of the file.');
}

// Check for any other strange characters inside EJS tags
content = content.replace(/<%([\s\S]*?)%>/g, (match, p1) => {
    // Replace non-breaking spaces with normal spaces inside EJS tags
    return '<%' + p1.replace(/\u00A0/g, ' ') + '%>';
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('File cleaned successfully.');
