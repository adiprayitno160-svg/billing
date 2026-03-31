
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function setup() {
    console.log('🚀 Starting Database Setup...');
    console.log(`📡 Connecting to ${DB_HOST || 'localhost'}...`);

    let connection;
    try {
        connection = await mysql.createConnection({
            host: DB_HOST || 'localhost',
            user: DB_USER || 'root',
            password: DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log(`📦 Creating database '${DB_NAME}' if not exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
        await connection.changeUser({ database: DB_NAME });

        // Read structure file
        const structurePath = path.join(__dirname, '../db/structure.sql');
        if (!fs.existsSync(structurePath)) {
            throw new Error(`Structure file not found at: ${structurePath}. Please run 'npm run db:dump-structure' locally first.`);
        }

        console.log('📄 Reading schema file...');
        const sql = fs.readFileSync(structurePath, 'utf8');

        console.log('⚙️ Executing schema (creating tables)...');
        // Execute the entire dump
        await connection.query(sql);
        console.log('✅ Tables created successfully.');

        // Seed Admin User
        console.log('👤 Seeding default admin user...');
        const passwordHash = await bcrypt.hash('admin123', 10);

        // Check if users table exists and is empty or admin missing
        const [users] = await connection.query('SELECT id FROM users WHERE email = ?', ['admin@example.com']) as any[];

        if (users.length === 0) {
            await connection.query(`
                INSERT INTO users (name, email, password, role, created_at, updated_at) 
                VALUES ('Administrator', 'admin@example.com', ?, 'admin', NOW(), NOW())
            `, [passwordHash]);
            console.log('✅ Admin user created.');
            console.log('   Email: admin@example.com');
            console.log('   Pass : admin123');
        } else {
            console.log('ℹ️ Admin user already exists, skipping.');
        }

        // Add System Settings Seed (Optional but good for fresh install)
        console.log('🔧 Seeding default system settings...');
        await connection.query(`
            INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES 
            ('company_name', 'My ISP'),
            ('app_version', '1.0.0')
        `);

        console.log('\n🎉 Setup Complete! You can now login.');

    } catch (error: any) {
        console.error('\n❌ Setup Failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

setup();
