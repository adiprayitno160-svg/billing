const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchema() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    try {
        console.log(`--- UPDATING SCHEMA FOR DB: ${process.env.DB_NAME} ---`);

        // 1. pppoe_profiles columns
        const pppoeCols = [
            "ADD COLUMN remote_address_pool VARCHAR(255) NULL",
            "ADD COLUMN local_address VARCHAR(255) NULL",
            "ADD COLUMN dns_server VARCHAR(255) NULL",
            "ADD COLUMN rate_limit VARCHAR(255) NULL",
            "ADD COLUMN rate_limit_rx VARCHAR(255) NULL",
            "ADD COLUMN rate_limit_tx VARCHAR(255) NULL",
            "ADD COLUMN burst_limit_rx VARCHAR(255) NULL",
            "ADD COLUMN burst_limit_tx VARCHAR(255) NULL",
            "ADD COLUMN burst_threshold_rx VARCHAR(255) NULL",
            "ADD COLUMN burst_threshold_tx VARCHAR(255) NULL",
            "ADD COLUMN burst_time_rx VARCHAR(255) NULL",
            "ADD COLUMN burst_time_tx VARCHAR(255) NULL",
            "ADD COLUMN comment TEXT NULL",
            "ADD COLUMN session_timeout VARCHAR(50) NULL",
            "ADD COLUMN idle_timeout VARCHAR(50) NULL",
            "ADD COLUMN only_one ENUM('yes', 'no', 'default') DEFAULT 'default'",
            "ADD COLUMN use_compression ENUM('yes', 'no', 'default') DEFAULT 'default'",
            "ADD COLUMN use_encryption ENUM('yes', 'no', 'default') DEFAULT 'default'",
            "ADD COLUMN change_tcp_mss ENUM('yes', 'no', 'default') DEFAULT 'default'",
            "ADD COLUMN use_mpls ENUM('yes', 'no', 'default') DEFAULT 'default'",
            "ADD COLUMN use_upnp ENUM('yes', 'no', 'default') DEFAULT 'default'"
        ];

        console.log('Updating pppoe_profiles...');
        for (const col of pppoeCols) {
            try {
                await conn.query(`ALTER TABLE pppoe_profiles ${col}`);
                console.log(`   ✅ Executed: ${col}`);
            } catch (e) {
                if (!e.message.includes('Duplicate')) console.log(`   Detailed Err: ${e.message}`);
            }
        }

        // 2. pppoe_packages columns
        console.log('Updating pppoe_packages...');
        const pkgCols = [
            "ADD COLUMN price_7_days DECIMAL(12,2) DEFAULT 0",
            "ADD COLUMN price_30_days DECIMAL(12,2) DEFAULT 0",
            "ADD COLUMN rate_limit_rx VARCHAR(255) NULL",
            "ADD COLUMN rate_limit_tx VARCHAR(255) NULL",
            "ADD COLUMN burst_limit_rx VARCHAR(255) NULL",
            "ADD COLUMN burst_limit_tx VARCHAR(255) NULL",
            "ADD COLUMN burst_threshold_rx VARCHAR(255) NULL",
            "ADD COLUMN burst_threshold_tx VARCHAR(255) NULL",
            "ADD COLUMN burst_time_rx VARCHAR(255) NULL",
            "ADD COLUMN burst_time_tx VARCHAR(255) NULL"
        ];
        for (const col of pkgCols) {
            try {
                await conn.query(`ALTER TABLE pppoe_packages ${col}`);
                console.log(`   ✅ Executed: ${col}`);
            } catch (e) {
                if (!e.message.includes('Duplicate')) console.log(`   Detailed Err: ${e.message}`);
            }
        }

        // 3. customers
        console.log('Updating customers...');
        const custCols = [
            "ADD COLUMN billing_mode ENUM('postpaid', 'prepaid') DEFAULT 'postpaid'",
            "ADD COLUMN expiry_date DATETIME NULL"
        ];
        for (const col of custCols) {
            try {
                await conn.query(`ALTER TABLE customers ${col}`);
                console.log(`   ✅ Executed: ${col}`);
            } catch (e) {
                if (!e.message.includes('Duplicate')) console.log(`   Detailed Err: ${e.message}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

updateSchema();
