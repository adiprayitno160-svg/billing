
var ids = ["00259E-HG8245H-48575443E6F52C0C", "00259E-HG8245-485754434A6E4512", "00259E-HG8245H-48575443BFC56B0C"];
print("START_DUMP");

ids.forEach(function (id) {
    var d = db.devices.findOne({ _id: id }, { "_lastInform": 1 });
    if (d) {
        print("Device: " + id);
        print("Last Inform: " + (d._lastInform));

        var wlan = db.devices.findOne({ _id: id }, { "InternetGatewayDevice.LANDevice.1.WLANConfiguration": 1 });
        if (wlan && wlan.InternetGatewayDevice && wlan.InternetGatewayDevice.LANDevice) {
            var configs = wlan.InternetGatewayDevice.LANDevice[1].WLANConfiguration;
            for (var idx in configs) {
                if (idx.startsWith("_")) continue;
                print("  WLAN Index: " + idx);
                var k = configs[idx];

                // Check for KeyPassphrase directly
                if (k.KeyPassphrase) print("    KeyPassphrase: " + (k.KeyPassphrase._value || k.KeyPassphrase));
                if (k.PreSharedKey) {
                    // PreSharedKey might be an array or object
                    print("    PreSharedKey (node found)");
                    for (var sub in k.PreSharedKey) {
                        if (sub.startsWith("_")) continue;
                        var skill = k.PreSharedKey[sub];
                        if (skill.KeyPassphrase) print("      PreSharedKey." + sub + ".KeyPassphrase: " + (skill.KeyPassphrase._value || skill.KeyPassphrase));
                        if (skill.PreSharedKey) print("      PreSharedKey." + sub + ".PreSharedKey: " + (skill.PreSharedKey._value || skill.PreSharedKey));
                    }
                }
                if (k.X_HW_WLANKey) print("    X_HW_WLANKey: " + (k.X_HW_WLANKey._value || k.X_HW_WLANKey));
            }
        }
    }
});
print("END_DUMP");
