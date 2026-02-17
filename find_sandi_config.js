
print("Searching for SANDI in config...");
db.config.find().forEach(function (doc) {
    // Check if value contains SANDI
    // Note: stored values might be JSON encoded strings, e.g. "\"SANDI\""
    if (doc.value && typeof doc.value === 'string') {
        if (doc.value.indexOf("SANDI") !== -1) {
            print("FOUND Label Doc: " + JSON.stringify(doc));

            // Extract index from _id: ui.index.N.label
            var parts = doc._id.split(".");
            if (parts.length >= 3 && parts[0] === "ui" && parts[1] === "index") {
                var idx = parts[2];
                var paramId = "ui.index." + idx + ".parameter";
                var paramDoc = db.config.findOne({ _id: paramId });
                print("FOUND Param Doc: " + JSON.stringify(paramDoc));

                // Construct update command
                print("UPDATE COMMAND RECOMMENDATION:");
                print('db.config.update({_id: "' + paramId + '"}, {$set: {value: "VirtualParameters.wifi_password"}});');
            }
        }
    }
});
