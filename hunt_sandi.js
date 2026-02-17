
var collections = db.getCollectionNames();
print("Collections: " + JSON.stringify(collections));

collections.forEach(function (c) {
    if (c === "system.indexes") return;
    print("--- Searching in " + c + " ---");
    // Find documents containing "SANDI" string anywhere (expensive regex scan)
    // Convert doc to string to search? Not easy in mongo shell without JS loop.
    db[c].find().forEach(function (doc) {
        var s = JSON.stringify(doc);
        if (s.indexOf("SANDI") !== -1) {
            print("FOUND in " + c + ": " + s);
        }
    });
});
