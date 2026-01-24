
const fs = require('fs');
const content = fs.readFileSync('src/routes/index.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('INSERT INTO customers') || line.includes("router.post('/customers")) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
