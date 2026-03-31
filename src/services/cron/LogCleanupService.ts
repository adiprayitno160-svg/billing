/**
 * Log Cleanup Service
 * ==============================
 * Scheduler that cleans up log files and database logs automatically:
 * - Runs every night at 02:00
 * - Deletes log files older than 7 days
 * - Deletes system_logs entries older than 30 days
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { databasePool } from '../../db/pool';

const LOG_DIRS = [
    path.join(process.cwd(), 'logs'),
    path.join(process.cwd(), 'logs', 'whatsapp')
];

const MAX_FILE_AGE_DAYS = 7;
const MAX_DB_AGE_DAYS = 30;

function getFileAgeDays(filePath: string): number {
    try {
        const stat = fs.statSync(filePath);
        const ageMs = Date.now() - stat.mtimeMs;
        return ageMs / (1000 * 60 * 60 * 24);
    } catch {
        return 0;
    }
}

export async function cleanupLogs(): Promise<{ filesDeleted: number; dbRowsDeleted: number }> {
    let filesDeleted = 0;
    let dbRowsDeleted = 0;

    // 1. Cleanup Files
    LOG_DIRS.forEach(dir => {
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.lstatSync(filePath).isDirectory()) return;

            const ageDays = getFileAgeDays(filePath);
            if (ageDays > MAX_FILE_AGE_DAYS && (file.endsWith('.log') || file.endsWith('.txt'))) {
                try {
                    fs.unlinkSync(filePath);
                    filesDeleted++;
                    console.log(`[LogCleanup] 🗑️ Deleted log file: ${file} (${Math.floor(ageDays)} days old)`);
                } catch (e: any) {
                    console.error(`[LogCleanup] ❌ Failed to delete ${file}:`, e.message);
                }
            }
        });
    });

    // 2. Cleanup Database
    try {
        const [result]: any = await databasePool.query(
            'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [MAX_DB_AGE_DAYS]
        );
        dbRowsDeleted = result.affectedRows || 0;
        console.log(`[LogCleanup] 🗑️ Deleted ${dbRowsDeleted} old log rows from database.`);
    } catch (e: any) {
        console.error('[LogCleanup] ❌ Database cleanup failed:', e.message);
    }

    return { filesDeleted, dbRowsDeleted };
}

let cleanupTask: cron.ScheduledTask | null = null;

export function startLogCleanupScheduler(): void {
    if (cleanupTask) return;

    // Cron: "0 2 * * *" = every day at 02:00
    cleanupTask = cron.schedule('0 2 * * *', async () => {
        console.log('[LogCleanup] 🧹 Starting automatic log cleanup...');
        const result = await cleanupLogs();
        console.log(`[LogCleanup] ✅ Finished: ${result.filesDeleted} files deleted, ${result.dbRowsDeleted} DB rows deleted.`);
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });

    console.log('[LogCleanup] ✅ Scheduler active (daily 02:00 WIB)');
}

export function stopLogCleanupScheduler(): void {
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = null;
    }
}
