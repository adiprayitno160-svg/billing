"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseManagement = getDatabaseManagement;
exports.fixDatabaseIssues = fixDatabaseIssues;
exports.runDatabaseMigration = runDatabaseMigration;
exports.runLatePaymentTrackingMigration = runLatePaymentTrackingMigration;
exports.getDatabaseLogs = getDatabaseLogs;
const pool_1 = require("../db/pool");
const databaseService_1 = require("../services/databaseService");
const add_late_payment_tracking_1 = require("../db/migrations/add-late-payment-tracking");
async function getDatabaseManagement(req, res, next) {
    try {
        const dbStatus = await (0, databaseService_1.getDatabaseStatus)();
        const schemaIssues = await (0, databaseService_1.checkDatabaseSchema)();
        res.render('database/management', {
            title: 'Database Management',
            dbStatus,
            schemaIssues,
            success: req.flash('success'),
            error: req.flash('error')
        });
    }
    catch (err) {
        next(err);
    }
}
async function fixDatabaseIssues(req, res, next) {
    try {
        const { issueType } = req.body;
        switch (issueType) {
            case 'missing_columns':
                await (0, databaseService_1.fixMissingColumns)();
                req.flash('success', 'Kolom yang hilang berhasil ditambahkan');
                break;
            case 'missing_tables':
                await (0, databaseService_1.runMigration)();
                req.flash('success', 'Tabel yang hilang berhasil dibuat');
                break;
            case 'indexes':
                await createMissingIndexes();
                req.flash('success', 'Index yang hilang berhasil dibuat');
                break;
            default:
                req.flash('error', 'Tipe perbaikan tidak valid');
        }
        res.redirect('/database/management');
    }
    catch (err) {
        req.flash('error', `Gagal memperbaiki database: ${err instanceof Error ? err.message : 'Unknown error'}`);
        res.redirect('/database/management');
    }
}
async function runDatabaseMigration(req, res, next) {
    try {
        const { migrationType } = req.body;
        await (0, databaseService_1.runMigration)(migrationType);
        req.flash('success', 'Migrasi database berhasil dijalankan');
        res.redirect('/database/management');
    }
    catch (err) {
        req.flash('error', `Gagal menjalankan migrasi: ${err instanceof Error ? err.message : 'Unknown error'}`);
        res.redirect('/database/management');
    }
}
async function runLatePaymentTrackingMigration(req, res, next) {
    try {
        await (0, add_late_payment_tracking_1.up)();
        req.flash('success', 'Migrasi late payment tracking berhasil dijalankan');
        res.redirect('/database/management');
    }
    catch (err) {
        req.flash('error', `Gagal menjalankan migrasi late payment tracking: ${err instanceof Error ? err.message : 'Unknown error'}`);
        res.redirect('/database/management');
    }
}
async function getDatabaseLogs(req, res, next) {
    try {
        const logs = await fetchDatabaseLogs();
        res.json(logs);
    }
    catch (err) {
        next(err);
    }
}
async function createMissingIndexes() {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Create missing indexes
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_ftth_odc_olt_card ON ftth_odc (olt_card)',
            'CREATE INDEX IF NOT EXISTS idx_ftth_odc_olt_port ON ftth_odc (olt_port)',
            'CREATE INDEX IF NOT EXISTS idx_ftth_odp_olt_card ON ftth_odp (olt_card)',
            'CREATE INDEX IF NOT EXISTS idx_ftth_odp_olt_port ON ftth_odp (olt_port)',
            'CREATE INDEX IF NOT EXISTS idx_static_ip_clients_package ON static_ip_clients (package_id)',
            'CREATE INDEX IF NOT EXISTS idx_static_ip_clients_status ON static_ip_clients (status)'
        ];
        for (const index of indexes) {
            try {
                await conn.execute(index);
            }
            catch (error) {
                console.log(`Index mungkin sudah ada: ${index}`);
            }
        }
    }
    finally {
        conn.release();
    }
}
async function fetchDatabaseLogs() {
    // Simulate database logs
    return [
        {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Database connection established',
            table: 'system'
        },
        {
            timestamp: new Date(Date.now() - 300000).toISOString(),
            level: 'WARN',
            message: 'Missing column olt_card detected',
            table: 'ftth_odc'
        },
        {
            timestamp: new Date(Date.now() - 600000).toISOString(),
            level: 'ERROR',
            message: 'Failed to create index on ftth_odp',
            table: 'ftth_odp'
        }
    ];
}
//# sourceMappingURL=databaseController.js.map