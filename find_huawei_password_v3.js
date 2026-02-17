
print("Searching for device by specific ID...");

var device = db.devices.findOne({ _id: "00259E-HG8245H-48575443E6F52C0C" });

if (!device) {
    print("Device not found even by ID!");
} else {
    print("Found Device: " + device._id);

    // Recursive function to scan object
    function scan(obj, path) {
        for (var key in obj) {
            if (key.startsWith("_")) continue;

            var currentPath = path ? path + "." + key : key;
            var val = obj[key];

            if (val && typeof val === 'object') {
                if (val._value !== undefined) {
                    checkParam(currentPath, val._value);
                } else {
                    scan(val, currentPath);
                }
            } else if (val) {
                checkParam(currentPath, val);
            }
        }
    }

    function checkParam(path, value) {
        var strVal = String(value);
        var lowerPath = path.toLowerCase();

        // Check for password-like names
        if (lowerPath.indexOf("wlan") !== -1 ||
            lowerPath.indexOf("key") !== -1 ||
            lowerPath.indexOf("pass") !== -1 ||
            lowerPath.indexOf("secret") !== -1 ||
            lowerPath.indexOf("ssid") !== -1) {

            print("MATCH: " + path + " = " + strVal);
        }
    }

    if (device.InternetGatewayDevice) {
        print("Scanning InternetGatewayDevice...");
        scan(device.InternetGatewayDevice, "InternetGatewayDevice");
    } else if (device.Device) {
        print("Scanning Device...");
        scan(device.Device, "Device");
    } else {
        print("No root object found (InternetGatewayDevice or Device). Listing root keys:");
        for (var k in device) print(k);
    }
}
