const mysql = require('mysql2/promise');
require('dotenv').config();

function normalize(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
    return cleaned;
}

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('Finding duplicate phone numbers (normalized) in customers table...\n');

        const [rows] = await connection.execute('SELECT id, name, phone FROM customers WHERE phone IS NOT NULL AND phone != "" AND phone != "-"');

        const phoneMap = new Map();
        const duplicates = [];

        rows.forEach(customer => {
            const norm = normalize(customer.phone);
            if (!phoneMap.has(norm)) {
                phoneMap.set(norm, []);
            }
            phoneMap.get(norm).push(customer);
        });

        for (const [phone, customers] of phoneMap.entries()) {
            if (customers.length > 1) {
                duplicates.push({ phone, customers });
            }
        }

        if (duplicates.length === 0) {
            console.log('No duplicate phone numbers found! ✅');
        } else {
            console.log(`Found ${duplicates.length} duplicate phone numbers:\n`);
            duplicates.sort((a, b) => b.customers.length - a.customers.length).forEach((dup, index) => {
                console.log(`${index + 1}. Normalized Phone: ${dup.phone} (${dup.customers.length} customers)`);
                dup.customers.forEach(c => {
                    console.log(`   - ID: ${c.id}, Name: ${c.name}, Original Phone: ${c.phone}`);
                });
                console.log('-----------------------------------');
            });
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

check();
