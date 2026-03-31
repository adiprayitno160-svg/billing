"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// Load .env from project root
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
async function setup() {
    console.log('🚀 Starting Database Setup...');
    console.log(`📡 Connecting to ${DB_HOST || 'localhost'}...`);
    let connection;
    try {
        connection = await promise_1.default.createConnection({
            host: DB_HOST || 'localhost',
            user: DB_USER || 'root',
            password: DB_PASSWORD || '',
            multipleStatements: true
        });
        console.log(`📦 Creating database '${DB_NAME}' if not exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
        await connection.changeUser({ database: DB_NAME });
        // Read structure file
        const structurePath = path_1.default.join(__dirname, '../db/structure.sql');
        if (!fs_1.default.existsSync(structurePath)) {
            throw new Error(`Structure file not found at: ${structurePath}. Please run 'npm run db:dump-structure' locally first.`);
        }
        console.log('📄 Reading schema file...');
        const sql = fs_1.default.readFileSync(structurePath, 'utf8');
        console.log('⚙️ Executing schema (creating tables)...');
        // Execute the entire dump
        await connection.query(sql);
        console.log('✅ Tables created successfully.');
        // Seed Admin User
        console.log('👤 Seeding default admin user...');
        const passwordHash = await bcrypt_1.default.hash('admin123', 10);
        // Check if users table exists and is empty or admin missing
        const [users] = await connection.query('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
        if (users.length === 0) {
            await connection.query(`
                INSERT INTO users (name, email, password, role, created_at, updated_at) 
                VALUES ('Administrator', 'admin@example.com', ?, 'admin', NOW(), NOW())
            `, [passwordHash]);
            console.log('✅ Admin user created.');
            console.log('   Email: admin@example.com');
            console.log('   Pass : admin123');
        }
        else {
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
    }
    catch (error) {
        console.error('\n❌ Setup Failed:', error.message);
        process.exit(1);
    }
    finally {
        if (connection)
            await connection.end();
    }
}
setup();
//# sourceMappingURL=setup-db.js.map