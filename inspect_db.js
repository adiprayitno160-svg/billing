printjson(db.getCollectionNames());
print("--- config collection content ---");
db.config.find().forEach(printjson);
print("--- presets collection content (sample) ---");
db.presets.find().limit(3).forEach(printjson);
