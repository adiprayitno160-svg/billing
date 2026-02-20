const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Unify the specific checkbox input tags that might be split
content = content.replace(/<input type="checkbox" class="sr-only peer status-toggle"\s+(<%[\s\S]*?%>)\s+onchange=/g, '<input type="checkbox" class="sr-only peer status-toggle" $1 onchange=');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Unified checkbox tags.');
