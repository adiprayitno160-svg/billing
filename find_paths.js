const fs = require('fs');
const device = JSON.parse(fs.readFileSync('device_dump.json', 'utf8'));

function findPath(obj, targetKey, currentPath = '') {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        if (key === targetKey) {
            console.log(`Found ${targetKey} at: ${path}`);
        }
        findPath(obj[key], targetKey, path);
    }
}

findPath(device, 'RXPower');
findPath(device, 'TXPower');
findPath(device, 'TransceiverTemperature');
findPath(device, 'Username');
findPath(device, 'Password');
