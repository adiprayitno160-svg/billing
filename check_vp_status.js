
var id = "00259E-HG8245H-48575443E6F52C0C";
var d = db.devices.findOne({ _id: id }, { "VirtualParameters.wifi_password": 1 });
if (d && d.VirtualParameters) {
    print("VP wifi_password: " + JSON.stringify(d.VirtualParameters.wifi_password));
} else {
    print("VP wifi_password NOT FOUND");
    // Check if VirtualParameters exists at all
    var full = db.devices.findOne({ _id: id });
    if (full.VirtualParameters) {
        print("VirtualParameters keys: " + Object.keys(full.VirtualParameters).join(", "));
    } else {
        print("No VirtualParameters object on device.");
    }
}
