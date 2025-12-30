/**
 * Migration: Add ODP/ODC Tables for Fiber Network Management
 * Version: 2.4.2
 * 
 * This migration creates tables for managing fiber optic network infrastructure:
 * - ODC (Optical Distribution Cabinet)
 * - ODP (Optical Distribution Point)
 * - Customer-ODP mapping
 * - Fiber signal history
 */

import { databasePool } from '../pool';

export async function addOdpOdcTables(): Promise<void> {
    const connection = await databasePool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create ODC (Optical Distribution Cabinet) table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS odc (
                id INT PRIMARY KEY AUTO_INCREMENT,
                code VARCHAR(50) UNIQUE NOT NULL COMMENT 'ODC code/identifier',
                name VARCHAR(255) NOT NULL,
                location TEXT,
                latitude DECIMAL(10, 8) COMMENT 'GPS Latitude',
                longitude DECIMAL(11, 8) COMMENT 'GPS Longitude',
                capacity INT DEFAULT 0 COMMENT 'Total capacity in cores',
                used_capacity INT DEFAULT 0 COMMENT 'Used capacity',
                status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_code (code),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Optical Distribution Cabinet master data'
        `);

        // 2. Create ODP (Optical Distribution Point) table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS odp (
                id INT PRIMARY KEY AUTO_INCREMENT,
                odc_id INT NOT NULL COMMENT 'Parent ODC',
                code VARCHAR(50) UNIQUE NOT NULL COMMENT 'ODP code/identifier',
                name VARCHAR(255) NOT NULL,
                location TEXT,
                latitude DECIMAL(10, 8) COMMENT 'GPS Latitude',
                longitude DECIMAL(11, 8) COMMENT 'GPS Longitude',
                capacity_ports INT DEFAULT 8 COMMENT 'Total available ports (typically 8)',
                used_ports INT DEFAULT 0 COMMENT 'Number of ports in use',
                status ENUM('active', 'inactive', 'maintenance', 'full') DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (odc_id) REFERENCES odc(id) ON DELETE CASCADE,
                INDEX idx_odc_id (odc_id),
                INDEX idx_code (code),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Optical Distribution Point master data'
        `);

        // 3. Add fiber network fields to customers table
        const [tables] = await connection.query(`SHOW TABLES LIKE 'customers'`);
        if ((tables as any[]).length > 0) {
            // Check if columns already exist
            const [columns] = await connection.query(`
                SHOW COLUMNS FROM customers WHERE Field IN (
                    'odp_id', 'odp_port_number', 'jarak_dari_odp', 
                    'redaman_rx', 'redaman_tx', 'last_signal_check'
                )
            `);

            if ((columns as any[]).length === 0) {
                await connection.query(`
                    ALTER TABLE customers
                    ADD COLUMN odp_id INT NULL COMMENT 'Connected ODP',
                    ADD COLUMN odp_port_number INT NULL COMMENT 'Port number at ODP (1-8)',
                    ADD COLUMN jarak_dari_odp DECIMAL(10, 2) NULL COMMENT 'Distance from ODP in meters',
                    ADD COLUMN redaman_rx DECIMAL(5, 2) NULL COMMENT 'RX optical power (dBm) - from GenieACS',
                    ADD COLUMN redaman_tx DECIMAL(5, 2) NULL COMMENT 'TX optical power (dBm) - from GenieACS',
                    ADD COLUMN last_signal_check TIMESTAMP NULL COMMENT 'Last time signal was checked from GenieACS',
                    ADD FOREIGN KEY (odp_id) REFERENCES odp(id) ON DELETE SET NULL,
                    ADD INDEX idx_odp_id (odp_id)
                `);
            }
        }

        // 4. Create fiber signal history table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS fiber_signal_history (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                customer_id INT NOT NULL,
                redaman_rx DECIMAL(5, 2) COMMENT 'RX optical power (dBm)',
                redaman_tx DECIMAL(5, 2) COMMENT 'TX optical power (dBm)',
                ont_temperature DECIMAL(5, 2) COMMENT 'ONT temperature (°C)',
                ont_voltage DECIMAL(5, 2) COMMENT 'ONT voltage (V)',
                ont_status VARCHAR(50) COMMENT 'ONT status from GenieACS',
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                INDEX idx_customer_id (customer_id),
                INDEX idx_recorded_at (recorded_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Historical fiber optical signal data'
        `);

        await connection.commit();
        console.log('✅ ODP/ODC tables created successfully');

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error creating ODP/ODC tables:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Auto-run migration if called directly
if (require.main === module) {
    addOdpOdcTables()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}
