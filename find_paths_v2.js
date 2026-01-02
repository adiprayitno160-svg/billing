const fs = require('fs');
const device = JSON.parse(fs.readFileSync('device_dump.json', 'utf8'));

function findKey(obj, targetKey, currentPath = '') {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key in obj) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        if (key === targetKey) console.log(`Found ${targetKey} at: ${path}`);
        findKey(obj[key], targetKey, path);
    }
}

findKey(device, 'WANConnectionDevice');
findKey(device, 'X_GponInterafceConfig');
