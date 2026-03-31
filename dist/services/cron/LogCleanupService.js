"use strict";
/**
 * Log Cleanup Service
 * ==============================
 * Scheduler that cleans up log files and database logs automatically:
 * - Runs every night at 02:00
 * - Deletes log files older than 7 days
 * - Deletes system_logs entries older than 30 days
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupLogs = cleanupLogs;
exports.startLogCleanupScheduler = startLogCleanupScheduler;
exports.stopLogCleanupScheduler = stopLogCleanupScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_1 = require("../../db/pool");
const LOG_DIRS = [
    path_1.default.join(process.cwd(), 'logs'),
    path_1.default.join(process.cwd(), 'logs', 'whatsapp')
];
const MAX_FILE_AGE_DAYS = 7;
const MAX_DB_AGE_DAYS = 30;
function getFileAgeDays(filePath) {
    try {
        const stat = fs_1.default.statSync(filePath);
        const ageMs = Date.now() - stat.mtimeMs;
        return ageMs / (1000 * 60 * 60 * 24);
    }
    catch {
        return 0;
    }
}
async function cleanupLogs() {
    let filesDeleted = 0;
    let dbRowsDeleted = 0;
    // 1. Cleanup Files
    LOG_DIRS.forEach(dir => {
        if (!fs_1.default.existsSync(dir))
            return;
        const files = fs_1.default.readdirSync(dir);
        files.forEach(file => {
            const filePath = path_1.default.join(dir, file);
            if (fs_1.default.lstatSync(filePath).isDirectory())
                return;
            const ageDays = getFileAgeDays(filePath);
            if (ageDays > MAX_FILE_AGE_DAYS && (file.endsWith('.log') || file.endsWith('.txt'))) {
                try {
                    fs_1.default.unlinkSync(filePath);
                    filesDeleted++;
                    console.log(`[LogCleanup] 🗑️ Deleted log file: ${file} (${Math.floor(ageDays)} days old)`);
                }
                catch (e) {
                    console.error(`[LogCleanup] ❌ Failed to delete ${file}:`, e.message);
                }
            }
        });
    });
    // 2. Cleanup Database
    try {
        const [result] = await pool_1.databasePool.query('DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [MAX_DB_AGE_DAYS]);
        dbRowsDeleted = result.affectedRows || 0;
        console.log(`[LogCleanup] 🗑️ Deleted ${dbRowsDeleted} old log rows from database.`);
    }
    catch (e) {
        console.error('[LogCleanup] ❌ Database cleanup failed:', e.message);
    }
    return { filesDeleted, dbRowsDeleted };
}
let cleanupTask = null;
function startLogCleanupScheduler() {
    if (cleanupTask)
        return;
    // Cron: "0 2 * * *" = every day at 02:00
    cleanupTask = node_cron_1.default.schedule('0 2 * * *', async () => {
        console.log('[LogCleanup] 🧹 Starting automatic log cleanup...');
        const result = await cleanupLogs();
        console.log(`[LogCleanup] ✅ Finished: ${result.filesDeleted} files deleted, ${result.dbRowsDeleted} DB rows deleted.`);
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });
    console.log('[LogCleanup] ✅ Scheduler active (daily 02:00 WIB)');
}
function stopLogCleanupScheduler() {
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = null;
    }
}
//# sourceMappingURL=LogCleanupService.js.map