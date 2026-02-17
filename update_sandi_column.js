
print("Searching and Updating SANDI column...");
db.config.find().forEach(function (doc) {
    // Check if value contains SANDI string (could be JSON encoded like "\"SANDI\"")
    if (doc.value && typeof doc.value === 'string' && doc.value.indexOf("SANDI") !== -1) {
        print("Found matching doc: " + JSON.stringify(doc));

        var parts = doc._id.split(".");
        // Expecting ui.index.N.label
        if (parts[0] === "ui" && parts[1] === "index" && parts[parts.length - 1] === "label") {
            // Construct parameter ID
            // Copy parts array
            var paramParts = parts.slice();
            paramParts[paramParts.length - 1] = "parameter";
            var paramId = paramParts.join(".");

            print("Target Parameter ID: " + paramId);

            // Update
            var result = db.config.update(
                { _id: paramId },
                { $set: { value: "VirtualParameters.wifi_password" } }
            );
            print("Update Result: " + JSON.stringify(result));
        }
    }
});
