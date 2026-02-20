const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'customers', 'list.ejs');
const template = fs.readFileSync(filePath, 'utf8');
const lines = template.split('\n');

function testRange(start, end) {
    const chunk = lines.slice(start, end).join('\n');
    try {
        // We need to make sure the chunk is somewhat balanced or just test it as raw text with some EJS tags
        // This is hard, but let's try to just find where ORGINAL EJS tags are broken
        ejs.compile(chunk);
        return true;
    } catch (err) {
        if (err.message.includes('Unexpected token') || err.message.includes('unexpected token')) {
            return false;
        }
        return true; // Likely a balance error, ignore
    }
}

// Better: Let's test EVERY tag individually again but with more care
const tagRegex = /<%([\s\S]*?)%>/g;
let match;
while ((match = tagRegex.exec(template)) !== null) {
    const content = match[1];
    const full = match[0];
    const lineNumber = template.substring(0, match.index).split('\n').length;

    try {
        // If it's an expression tag <%= ... %>, wrap it correctly for testing
        if (content.startsWith('=')) {
            ejs.compile(full);
        } else if (content.startsWith('-')) {
            ejs.compile(full);
        } else {
            // It's a logic tag <% ... %>
            // To test if IT has an unexpected token, we can try to wrap it in a function
            // BUT it might be a partial block like "if (cond) {"
            // So we can only check if it has weird characters
            for (let i = 0; i < content.length; i++) {
                const code = content.charCodeAt(i);
                if (code > 127 || (code < 32 && code !== 10 && code !== 13 && code !== 9)) {
                    console.log(`Strange character in tag at line ${lineNumber}: Code ${code}`);
                }
            }
        }
    } catch (err) {
        // If ejs.compile(full) fails for an expression tag, it's definitely an error
        console.log(`Error in tag at line ${lineNumber}:`);
        console.log(full);
        console.log(err.message);
    }
}
