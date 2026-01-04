import { databasePool } from '../pool';

async function run() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Adding wifi_ssid and wifi_password columns to customers table...');

        // Add wifi_ssid column
        try {
            await connection.query('ALTER TABLE customers ADD COLUMN wifi_ssid VARCHAR(100) NULL COMMENT "WiFi SSID saved from GenieACS"');
            console.log('Added wifi_ssid column');
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('Column wifi_ssid already exists.');
            } else {
                throw error;
            }
        }

        // Add wifi_password column
        try {
            await connection.query('ALTER TABLE customers ADD COLUMN wifi_password VARCHAR(100) NULL COMMENT "WiFi password saved from GenieACS"');
            console.log('Added wifi_password column');
        } catch (error: any) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('Column wifi_password already exists.');
            } else {
                throw error;
            }
        }

        console.log('Migration successful!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

run();
