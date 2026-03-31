import * as mysql from 'mysql2/promise';

async function checkManual() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: 'billing'
    });
    
    try {
        const [rows] = await conn.query('SELECT id, name FROM customers WHERE id = 839');
        console.log('Manual check 839:', JSON.stringify(rows));
        
        const [max] = await conn.query('SELECT MAX(id) as max FROM customers');
        console.log('Max ID:', max);
        
        await conn.end();
        process.exit(0);
    } catch (e: any) {
        console.error('Manual check failed:', e.message);
        process.exit(1);
    }
}

checkManual();
