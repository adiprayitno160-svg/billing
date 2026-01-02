const fs = require('fs');
const lines = fs.readFileSync('device_dump.json', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('VirtualParameters')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
