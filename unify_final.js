const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Unify ALL EJS tags found in the file, ensuring they are on one line
content = content.replace(/<%(=|-)?([\s\S]*?)%>/g, (match, prefix, inner) => {
    prefix = prefix || '';
    // Unify inner content by replacing literal newlines with spaces
    const unifiedInner = inner.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    return `<%${prefix}${unifiedInner}%>`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully unified all EJS tags.');
