print("--- USERS ---");
db.users.find().forEach(function (doc) { print(JSON.stringify(doc)); });
print("--- CONFIG ---");
db.config.find().forEach(function (doc) { print(JSON.stringify(doc)); });
