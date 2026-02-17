
var ids = ["00259E-HG8245H-48575443E6F52C0C", "00259E-HG8245-485754434A6E4512", "00259E-HG8245H-48575443BFC56B0C"];

print("Checking status for targeted devices...");

ids.forEach(function (id) {
    var d = db.devices.findOne({ _id: id }, {
        _id: 1,
        "deviceId.SerialNumber": 1,
        "_lastInform": 1,
        "InternetGatewayDevice.ManagementServer.ConnectionRequestURL": 1
    });

    if (d) {
        print("--------------------------------------------------");
        print("Device: " + d._id);
        print("Last Inform: " + (d._lastInform ? d._lastInform.toISOString() : "NEVER"));

        // Dump WLAN Config keys
        var wlan = db.devices.findOne({ _id: id }, { "InternetGatewayDevice.LANDevice.1.WLANConfiguration": 1 });
        if (wlan && wlan.InternetGatewayDevice && wlan.InternetGatewayDevice.LANDevice) {
            var configs = wlan.InternetGatewayDevice.LANDevice[1].WLANConfiguration;
            for (var key in configs) {
                if (key.startsWith("_")) continue;
                print("WLAN Config found: index " + key);
                // keys inside
                var k = configs[key];
                for (var prop in k) {
                    if (prop.startsWith("_")) continue;
                    var val = k[prop];
                    var v = (val && typeof val === 'object' && val._value) ? val._value : val;
                    if (prop.toLowerCase().indexOf("key") > -1 || prop.toLowerCase().indexOf("pass") > -1 || prop.toLowerCase().indexOf("ssid") > -1) {
                        print("  " + prop + ": " + v);
                    }
                }
            }
        } else {
            print("No WLAN Configuration found in DB.");
        }
    } else {
        print("Device " + id + " not found.");
    }
});
