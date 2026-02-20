const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the specifically broken tags found
// Tag 1: Prepaid migration button data-name
content = content.replace(/data-name="<%= customer\.name\.replace\(\/'\/g, " \\\\'"\)\s+%>">/g, 'data-name="<%= customer.name.replace(/\'/g, "\\\\\'") %>">');

// Tag 2: Postpaid migration button data-name
content = content.replace(/data-name="<%= customer\.name\.replace\(\/'\/g, "\s+\\\\'"\) %>">/g, 'data-name="<%= customer.name.replace(/\'/g, "\\\\\'") %>">');

// Generic fix for split <%= ... %> tags
content = content.replace(/<%=([\s\S]*?)%>/g, (match, p1) => {
    // If it contains a newline, unify it
    if (p1.includes('\n')) {
        return '<%=' + p1.replace(/\r?\n\s*/g, ' ') + '%>';
    }
    return match;
});

// Generic fix for split <% ... %> tags that are NOT the large blocks
content = content.replace(/<%([^=][\s\S]*?)%>/g, (match, p1) => {
    // Only unify if it's short (likely a split statement)
    if (p1.trim().length < 200 && p1.includes('\n') && !p1.includes('let totalVal')) {
        return '<%' + p1.replace(/\r?\n\s*/g, ' ') + '%>';
    }
    return match;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed split tags.');
