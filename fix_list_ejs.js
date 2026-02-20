const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the suspicious replace calls with a more flexible regex
// Matching: .replace(/'/g, " \\'") or similar variations
const looseReplace = /\.replace\(\s*\/'\/g\s*,\s*"\s*\\\\'"\s*\)/g;
content = content.replace(looseReplace, '.replace(/\'/g, "\\\'")');

// Catch any remaining ones that might have slightly different spacing
content = content.replace(/\.replace\(..g, . .\\''\)/g, '.replace(/\'/g, "\\\'")');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed file saved.');
