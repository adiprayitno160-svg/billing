const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the space before \\' in ALL replace calls within EJS tags
content = content.replace(/replace\(\/'\/g,\s*" \\\\'"\)/g, "replace(/'/g, \"\\\\'\")");
// Also handle single backslash if double was reduced
content = content.replace(/replace\(\/'\/g,\s*" \\'"\)/g, "replace(/'/g, \"\\\\'\")");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed space in replace calls.');
