
const { databasePool } = require('./src/db/pool');

async function checkTemplates() {
    try {
        const [rows] = await databasePool.query('SELECT notification_type, message_template FROM notification_templates WHERE notification_type IN ("payment_received", "invoice_overdue")');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkTemplates();
