
const mysql = require('mysql2/promise');
const config = { host: 'localhost', user: 'root', password: '', database: 'billing' };

async function run() {
    const conn = await mysql.createConnection(config);
    try {
        console.log('Creating payment_proofs table...');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS payment_proofs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                payment_id INT,
                customer_id INT,
                proof_file_path VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('payment_proofs table created');
        
        console.log('Checking debt_tracking table...');
        const [debtTables] = await conn.query('SHOW TABLES LIKE "debt_tracking"');
        if (debtTables.length === 0) {
            console.log('Creating debt_tracking table...');
            await conn.execute(`
                CREATE TABLE debt_tracking (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    customer_id INT,
                    invoice_id INT,
                    debt_amount DECIMAL(15,2),
                    debt_reason VARCHAR(255),
                    status ENUM('active', 'paid', 'applied') DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            console.log('debt_tracking table created');
        } else {
            console.log('debt_tracking table already exists');
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    }
    await conn.end();
}
run();
