
const fs = require('fs');
const path = 'c:\\laragon\\www\\billing\\views\\customers\\edit.ejs';

try {
    let content = fs.readFileSync(path, 'utf8');
    const target = '<% -';
    const replacement = '<%-';

    if (content.includes(target)) {
        content = content.replace(target, replacement);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully fixed EJS tag!');
    } else {
        console.log('Target string not found, check manually.');
    }
} catch (err) {
    console.error('Error:', err);
}
