
import { databasePool } from './db/pool';

async function checkTemplate() {
    try {
        const [rows]: any = await databasePool.query('SELECT * FROM notification_templates WHERE template_code = "customer_created"');
        console.log('Template customer_created:');
        console.log(JSON.stringify(rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkTemplate();
