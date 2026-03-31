"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./db/pool");
async function checkTemplate() {
    try {
        const [rows] = await pool_1.databasePool.query('SELECT * FROM notification_templates WHERE template_code = "customer_created"');
        console.log('Template customer_created:');
        console.log(JSON.stringify(rows[0], null, 2));
    }
    catch (err) {
        console.error(err);
    }
    finally {
        process.exit(0);
    }
}
checkTemplate();
//# sourceMappingURL=check_template.js.map