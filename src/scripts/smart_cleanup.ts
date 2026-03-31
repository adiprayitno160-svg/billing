/**
 * Smart Cleanup Script
 * ====================
 * 1. Hapus file migrasi .ts yang sudah tidak dipakai (one-time scripts)
 * 2. Bersihkan whatsapp_auth - hapus JSON > 2 minggu yang TIDAK dipakai
 * 3. Simpan file penting: creds.json, session-*, app-state-sync-version-*
 * 4. Hapus pre-key lama, app-state-sync-key lama, device-list lama
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

// ============ HELPER ============
function rmFile(p: string): boolean {
    try {
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
            console.log('🗑️  Deleted:', path.basename(p));
            return true;
        }
    } catch (e: any) {
        console.error('❌ Failed to delete:', p, e.message);
    }
    return false;
}

function getFileAgeDays(filePath: string): number {
    const stat = fs.statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs / (1000 * 60 * 60 * 24);
}

// ============ 1️⃣ HAPUS SCRIPT MIGRASI YANG TIDAK DIPAKAI ============
console.log('\n📁 [1/3] Membersihkan script migrasi yang tidak dipakai...\n');

const SCRIPTS_DIR = path.join(ROOT, 'src', 'scripts');
const SCRIPTS_TO_DELETE = [
    // One-time migration scripts (sudah dijalankan, tidak diperlukan lagi)
    'add_customer_name_update_lock.ts',  // Sudah dijalankan
    'add_proof_image.ts',
    'add_static_ip_monitoring_columns.ts',
    'check-map-data.ts',
    'check_ai.ts',
    'check_counts.ts',
    'check_customers.ts',
    'check_db_tables.ts',
    'diagnose_whatsapp.ts',
    'fix-collation.ts',
    'migrate_customer_name_edit.ts',
    'migrate_deferments.ts',
    'migrate_genieacs_settings.ts',
    'migrate_registration_location.ts',
    'migrate_registration_requests.ts',
    'migrate_users_phone.ts',
    'test_topology.ts',
    'update_customer_coordinates.ts',
    'update_rental_schema.ts',
    'update_sla_schema.ts',
];

// JANGAN HAPUS script penting ini:
const SCRIPTS_TO_KEEP = [
    'initNetworkMonitoring.ts',    // Masih dipakai untuk init
    'monitoringDaemon.ts',         // Daemon aktif
    'pm2-manager.js',              // PM2 manager
    'release.ts',                  // Release script
    'run-backup.ts',               // Backup script
    'run-maintenance-migration.ts', // Maintenance migration
    'setup-db.ts',                 // DB setup
    'smart_cleanup.ts',            // Script ini sendiri
];

let deletedScripts = 0;
SCRIPTS_TO_DELETE.forEach(file => {
    const filePath = path.join(SCRIPTS_DIR, file);
    if (rmFile(filePath)) deletedScripts++;
});

// Hapus juga file .sql migration lama di root
const ROOT_SQL_FILES = [
    'migration_customers_monitoring.sql',
    'migration_autocomplaint.sql',
    'migration_add_bank_settings.sql',
    'migration_ignore_monitoring_start.sql',
];
ROOT_SQL_FILES.forEach(file => {
    const filePath = path.join(ROOT, file);
    if (rmFile(filePath)) deletedScripts++;
});

// Hapus file batch lama
const BATCH_FILES = ['run-migration.bat'];
BATCH_FILES.forEach(file => {
    const filePath = path.join(ROOT, file);
    if (rmFile(filePath)) deletedScripts++;
});

// Hapus scripts/fix_db_migration.ts dan scripts/run_migration.js
const OLD_SCRIPTS = [
    path.join(ROOT, 'scripts', 'fix_db_migration.ts'),
    path.join(ROOT, 'scripts', 'run_migration.js'),
];
OLD_SCRIPTS.forEach(file => {
    if (rmFile(file)) deletedScripts++;
});

console.log(`✅ Deleted ${deletedScripts} migration/script files\n`);

// ============ 2️⃣ BERSIHKAN WHATSAPP_AUTH ============
console.log('📁 [2/3] Membersihkan whatsapp_auth (file > 2 minggu yang tidak dipakai)...\n');

const WA_AUTH = path.join(ROOT, 'whatsapp_auth');
const MAX_AGE_DAYS = 14; // 2 minggu

// File PENTING yang HARUS DISIMPAN (tidak peduli umur)
const ESSENTIAL_PATTERNS = [
    /^creds\.json$/,                    // Credential utama
    /^session-.*\.json$/,               // Session aktif
    /^app-state-sync-version-.*\.json$/, // State version (penting untuk sync)
];

// File yang BOLEH DIHAPUS jika > 2 minggu
const DELETABLE_PATTERNS = [
    /^pre-key-\d+\.json$/,              // Pre-keys lama
    /^app-state-sync-key-.*\.json$/,    // State keys lama
    /^device-list-.*\.json$/,           // Device list lama (tidak aktif)
    /^lid-mapping-.*\.json$/,           // LID mapping lama
];

if (fs.existsSync(WA_AUTH)) {
    const allFiles = fs.readdirSync(WA_AUTH).filter(f => f.endsWith('.json'));
    let deletedWA = 0;
    let keptWA = 0;

    allFiles.forEach(file => {
        const filePath = path.join(WA_AUTH, file);
        const ageDays = getFileAgeDays(filePath);

        // Cek apakah file PENTING
        const isEssential = ESSENTIAL_PATTERNS.some(pattern => pattern.test(file));
        if (isEssential) {
            console.log(`🟢 Keep (essential): ${file}`);
            keptWA++;
            return;
        }

        // Cek apakah file BISA DIHAPUS
        const isDeletable = DELETABLE_PATTERNS.some(pattern => pattern.test(file));
        if (isDeletable && ageDays > MAX_AGE_DAYS) {
            if (rmFile(filePath)) deletedWA++;
        } else if (!isDeletable) {
            // File tidak dikenal - simpan untuk keamanan
            console.log(`🟡 Keep (unknown): ${file}`);
            keptWA++;
        } else {
            // File deletable tapi masih fresh
            console.log(`🟢 Keep (recent ${Math.floor(ageDays)}d): ${file}`);
            keptWA++;
        }
    });

    console.log(`\n✅ WhatsApp Auth: Deleted ${deletedWA}, Kept ${keptWA} files\n`);
} else {
    console.log('⚠️  Folder whatsapp_auth tidak ditemukan\n');
}

// ============ 3️⃣ BERSIHKAN LOG LAMA ============
console.log('📁 [3/3] Membersihkan log lama...\n');

const LOG_DIRS = [
    path.join(ROOT, 'logs'),
    path.join(ROOT, 'logs', 'whatsapp'),
];

let deletedLogs = 0;
LOG_DIRS.forEach(logDir => {
    if (fs.existsSync(logDir)) {
        const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
        logFiles.forEach(file => {
            const filePath = path.join(logDir, file);
            const ageDays = getFileAgeDays(filePath);
            if (ageDays > 7) {
                if (rmFile(filePath)) deletedLogs++;
            }
        });
    }
});

console.log(`✅ Deleted ${deletedLogs} old log files\n`);

// ============ SUMMARY ============
console.log('═══════════════════════════════════════════');
console.log('🎉 CLEANUP SELESAI!');
console.log('═══════════════════════════════════════════');
console.log(`📜 Scripts/Migrations deleted: ${deletedScripts}`);
console.log(`📱 WhatsApp files cleaned`);
console.log(`📋 Old logs deleted: ${deletedLogs}`);
console.log('═══════════════════════════════════════════\n');

process.exit(0);
