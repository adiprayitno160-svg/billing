const fs = require('fs');

function getDeviceParameter(device, path) {
    if (!device) return null;

    // 1. Try direct access first (some GenieACS responses are flat)
    if (device[path] !== undefined) {
        const node = device[path];
        return (node && typeof node === 'object' && '_value' in node) ? node._value : node;
    }

    // 2. Try nested access
    const parts = path.split('.');
    let current = device;
    for (const part of parts) {
        if (current && current[part] !== undefined) {
            current = current[part];
        } else {
            return null;
        }
    }

    // Handle GenieACS _value format or direct value
    if (current && typeof current === 'object') {
        return ('_value' in current) ? current._value : null;
    }
    return current;
}

function findVal(device, paths) {
    for (const path of paths) {
        const val = getDeviceParameter(device, path);
        if (val !== null && val !== undefined && val !== '') return val;
    }
    return null;
}

const device = JSON.parse(fs.readFileSync('device_dump.json', 'utf8'));

const rxPaths = [
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_GponInterafceConfig.RXPower',
    'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower', // Typo path
    'InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.RxOpticalPower',
    'InternetGatewayDevice.WANDevice.1.X_HUAWEI_PONInterfaceConfig.RxOpticalInfo.RxOpticalPower',
    'InternetGatewayDevice.WANDevice.1.X_HW_OpticalInfo.RxOpticalPower',
    'Device.Optical.Interface.1.Stats.RxOpticalPower',
    'Device.Optical.Interface.1.RXPower'
];

const rx = findVal(device, rxPaths);
console.log('Detected RX Power:', rx);

const tempPaths = [
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_GponInterafceConfig.TransceiverTemperature',
    'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TransceiverTemperature',
    'InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.Temperature',
    'InternetGatewayDevice.WANDevice.1.X_HUAWEI_PONInterfaceConfig.RxOpticalInfo.Temperature',
    'Device.Optical.Interface.1.Stats.Temperature',
    'InternetGatewayDevice.WANDevice.1.X_HW_OpticalInfo.Temperature'
];

const temp = findVal(device, tempPaths);
console.log('Detected Temperature:', temp);
