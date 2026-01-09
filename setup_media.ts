
import { databasePool } from './src/db/pool';
import fs from 'fs';
import path from 'path';

async function setup() {
    try {
        console.log('🚀 Setting up WhatsApp media storage...');

        // 1. Create directory
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'whatsapp');
        if (!fs.existsSync(uploadDir)) {
            console.log(`📁 Creating directory: ${uploadDir}`);
            fs.mkdirSync(uploadDir, { recursive: true });
        } else {
            console.log(`✅ Directory exists: ${uploadDir}`);
        }

        // 2. Update Database Schema
        console.log('📊 Updating database schema...');

        // whatsapp_bot_messages
        try {
            await databasePool.query(`
                ALTER TABLE whatsapp_bot_messages 
                ADD COLUMN IF NOT EXISTS media_url VARCHAR(255) NULL AFTER message_content
            `);
            console.log('✅ Added media_url to whatsapp_bot_messages');
        } catch (e: any) {
            console.warn('⚠️ Error updating whatsapp_bot_messages:', e.message);
        }

        // manual_payment_verifications
        try {
            // Check if column exists first or just try add column if not exists syntax (some mysql versions dont support IF NOT EXISTS in ADD COLUMN)
            // Safer to just try add 
            const [cols] = await databasePool.query("SHOW COLUMNS FROM manual_payment_verifications LIKE 'payment_proof_path'");
            if ((cols as any[]).length === 0) {
                await databasePool.query(`
                    ALTER TABLE manual_payment_verifications 
                    ADD COLUMN payment_proof_path VARCHAR(255) NULL
                `);
                console.log('✅ Added payment_proof_path to manual_payment_verifications');
            } else {
                console.log('ℹ️ Column payment_proof_path already exists');
            }
        } catch (e: any) {
            console.warn('⚠️ Error updating manual_payment_verifications:', e.message);
        }

        console.log('✨ Setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setup();
