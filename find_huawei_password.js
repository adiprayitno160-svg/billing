
print("Searching for password parameters for device 48575443E6F52C0C...");

// Find the device
var device = db.devices.findOne({ "deviceId.SerialNumber": "48575443E6F52C0C" });

if (!device) {
    print("Device not found!");
} else {
    print("Device found: " + device._id);

    // Recursive function to scan object
    function scan(obj, path) {
        for (var key in obj) {
            if (key.startsWith("_")) continue; // Skip metadata like _value, _timestamp if inside a leaf

            var currentPath = path ? path + "." + key : key;
            var val = obj[key];

            // Check if it's a leaf node (has _value or is direct value)
            if (val && typeof val === 'object' && val._value !== undefined) {
                // It's a leaf with metadata
                checkParam(currentPath, val._value);
            } else if (val && typeof val !== 'object') {
                // Direct value (unlikely in GenieACS but possible)
                checkParam(currentPath, val);
            } else {
                // Determine if it's a leaf or branch
                // In GenieACS, branches are just objects.
                // We recurse.
                scan(val, currentPath);
            }
        }
    }

    function checkParam(path, value) {
        var lowerPath = path.toLowerCase();
        // filters
        if (lowerPath.indexOf("wlan") !== -1 ||
            lowerPath.indexOf("key") !== -1 ||
            lowerPath.indexOf("pass") !== -1 ||
            lowerPath.indexOf("secret") !== -1 ||
            lowerPath.indexOf("ssid") !== -1) {

            print(path + " = " + value);
        }
    }

    // Start scan from root
    // GenieACS devices structure: deviceID, _id, props...
    // The TR-069 tree is usually at root or under 'InternetGatewayDevice' / 'Device'

    if (device.InternetGatewayDevice) {
        scan(device.InternetGatewayDevice, "InternetGatewayDevice");
    }
    if (device.Device) {
        scan(device.Device, "Device");
    }
}
