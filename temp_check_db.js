const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD
        });

        console.log("--- RECENT JOBS ---");
        const [jobs] = await conn.execute("SELECT id, ticket_number, title, coordinates, created_at FROM technician_jobs ORDER BY id DESC LIMIT 5");
        console.log(JSON.stringify(jobs, null, 2));

        console.log("\n--- BANK SETTINGS ---");
        const [settings] = await conn.execute("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'bank%'");
        console.log(JSON.stringify(settings, null, 2));

        console.log("\n--- INVOICE REMINDER TEMPLATE ---");
        const [templates] = await conn.execute("SELECT template_code, message_template FROM notification_templates WHERE notification_type = 'invoice_reminder'");
        if (templates.length > 0) {
            console.log("Template found. Length:", templates[0].message_template.length);
            console.log("Contains {{bank_name}}?", templates[0].message_template.includes('{{bank_name}}'));
        } else {
            console.log("Template NOT found.");
        }

        await conn.end();
    } catch (e) { console.error(e); }
}
check();
