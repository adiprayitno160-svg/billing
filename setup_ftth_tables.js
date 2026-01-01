const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupFtthTables() {
    console.log('🛠️ Setting up FTTH Tables...');

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        // 1. FTTH Areas
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS ftth_areas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Table ftth_areas OK');

        // 2. OLTs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS olts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                ip_address VARCHAR(45),
                total_ports INT DEFAULT 0,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Table olts OK');

        // 3. ODCs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS odcs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                area_id INT NULL,
                olt_id INT NULL,
                name VARCHAR(100) NOT NULL,
                location VARCHAR(255),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                total_ports INT DEFAULT 0,
                used_ports INT DEFAULT 0,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (area_id) REFERENCES ftth_areas(id) ON DELETE SET NULL,
                FOREIGN KEY (olt_id) REFERENCES olts(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Table odcs OK');

        // 4. ODPs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS odps (
                id INT AUTO_INCREMENT PRIMARY KEY,
                odc_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                location VARCHAR(255),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                total_ports INT DEFAULT 0,
                used_ports INT DEFAULT 0,
                olt_port_number VARCHAR(50),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (odc_id) REFERENCES odcs(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Table odps OK');

        // Insert Default Area
        const [areas] = await conn.execute("SELECT count(*) as count FROM ftth_areas");
        if (areas[0].count === 0) {
            await conn.execute(`INSERT INTO ftth_areas (code, name, description) VALUES ('WNG-01', 'Area Pusat', 'Area Utama')`);
            console.log('✅ Default Area Inserted');
        }

        await conn.end();
        console.log('✨ FTTH Database Setup Complete!');

    } catch (error) {
        console.error('❌ Setup Failed:', error);
    }
}

setupFtthTables();
