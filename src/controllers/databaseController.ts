import { Request, Response, NextFunction } from 'express';
import { databasePool } from '../db/pool';
import { checkDatabaseSchema, fixMissingColumns, getDatabaseStatus, runMigration } from '../services/databaseService';
// import { up as runLatePaymentMigration } from '../db/migrations/add-late-payment-tracking';

export async function getDatabaseManagement(req: Request, res: Response, next: NextFunction) {
    try {
        const dbStatus = await getDatabaseStatus();
        const schemaIssues = await checkDatabaseSchema();

        res.render('database/management', {
            title: 'Database Management',
            dbStatus,
            schemaIssues,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (err) {
        next(err);
    }
}

export async function fixDatabaseIssues(req: Request, res: Response, next: NextFunction) {
    try {
        const { issueType } = req.body;

        switch (issueType) {
            case 'missing_columns':
                await fixMissingColumns();
                req.flash('success', 'Kolom yang hilang berhasil ditambahkan');
                break;
            case 'missing_tables':
                await runMigration();
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
    } catch (err) {
        req.flash('error', `Gagal memperbaiki database: ${err instanceof Error ? err.message : 'Unknown error'}`);
        res.redirect('/database/management');
    }
}

export async function runDatabaseMigration(req: Request, res: Response, next: NextFunction) {
    try {
        const { migrationType } = req.body;
        await runMigration(migrationType);

        req.flash('success', 'Migrasi database berhasil dijalankan');
        res.redirect('/database/management');
    } catch (err) {
        req.flash('error', `Gagal menjalankan migrasi: ${err instanceof Error ? err.message : 'Unknown error'}`);
        res.redirect('/database/management');
    }
}

export async function runLatePaymentTrackingMigration(req: Request, res: Response, next: NextFunction) {
    try {
        // await runLatePaymentMigration();
        throw new Error('Migration file missing');

        req.flash('success', 'Migrasi late payment tracking berhasil dijalankan');
        res.redirect('/database/management');
    } catch (err) {
        req.flash('error', `Gagal menjalankan migrasi late payment tracking: ${err instanceof Error ? err.message : 'Unknown error'}`);
        res.redirect('/database/management');
    }
}

export async function getDatabaseLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const logs = await fetchDatabaseLogs();
        res.json(logs);
    } catch (err) {
        next(err);
    }
}

async function createMissingIndexes(): Promise<void> {
    const conn = await databasePool.getConnection();
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
            } catch (error) {
                console.log(`Index mungkin sudah ada: ${index}`);
            }
        }
    } finally {
        conn.release();
    }
}

async function fetchDatabaseLogs(): Promise<any[]> {
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
