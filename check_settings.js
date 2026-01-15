
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function check() {
    try {
        console.log('Connecting to database...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing_db'
        });

        console.log('✅ Connected!');

        console.log('\n--- Checking System Settings ---');
        const [rows] = await connection.execute("SELECT * FROM system_settings WHERE setting_key = 'whatsapp_tester_numbers'");

        if (rows.length > 0) {
            console.log('✅ Setting Found:', rows[0]);

            // Check if LID is missing
            const val = rows[0].setting_value;
            if (!val.includes('63729093849223')) {
                console.log('⚠️ LID Missing! Updating setting...');
                const newVal = `63729093849223,${val}`;
                await connection.execute("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'whatsapp_tester_numbers'", [newVal]);
                console.log(`✅ Updated to: ${newVal}`);
            } else {
                console.log('✅ Setting is CORRECT (Contains LID).');
            }

        } else {
            console.log('❌ Setting "whatsapp_tester_numbers" NOT FOUND!');
            console.log('Attempting to insert default value...');

            await connection.execute(`
                INSERT INTO system_settings (setting_key, setting_value, setting_description, category)
                VALUES ('whatsapp_tester_numbers', '63729093849223,089678630707', 'Nomor HP/ID untuk testing bypass (Owner)', 'general')
            `);
            console.log('✅ Default value inserted successfully!');
        }

        console.log('\n--- Checking Users Table (Admin) ---');
        const [users] = await connection.execute("SELECT id, username, phone FROM users");
        console.table(users);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

check();
