
print("Searching for devices matching serial '48575443'...");

var cursor = db.devices.find({ "deviceId.SerialNumber": { $regex: "48575443" } }).limit(5);

if (!cursor.hasNext()) {
    print("No devices found with serial matching '48575443'. Checking first 3 devices...");
    db.devices.find().limit(3).forEach(function (d) {
        print("Device ID: " + d._id);
        print("Serial: " + (d.deviceId ? d.deviceId.SerialNumber : "N/A"));
    });
} else {
    cursor.forEach(function (device) {
        print("Found Device: " + device._id);
        print("Serial: " + device.deviceId.SerialNumber);

        // Recursive function to scan object
        function scan(obj, path) {
            for (var key in obj) {
                if (key.startsWith("_")) continue;

                var currentPath = path ? path + "." + key : key;
                var val = obj[key];

                if (val && typeof val === 'object' && val._value !== undefined) {
                    checkParam(currentPath, val._value);
                } else if (val && typeof val !== 'object') {
                    checkParam(currentPath, val);
                } else {
                    scan(val, currentPath);
                }
            }
        }

        function checkParam(path, value) {
            var lowerPath = path.toLowerCase();
            if (lowerPath.indexOf("wlan") !== -1 ||
                lowerPath.indexOf("key") !== -1 ||
                lowerPath.indexOf("pass") !== -1 ||
                lowerPath.indexOf("secret") !== -1 ||
                lowerPath.indexOf("ssid") !== -1) {

                print("PARAM MATCH: " + path + " = " + value);
            }
        }

        if (device.InternetGatewayDevice) {
            scan(device.InternetGatewayDevice, "InternetGatewayDevice");
        }
        if (device.Device) {
            scan(device.Device, "Device");
        }
    });
}
