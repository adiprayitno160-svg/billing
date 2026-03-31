"use strict";
/**
 * WhatsApp Auth Cleanup Service
 * ==============================
 * Scheduler yang membersihkan file WhatsApp auth secara otomatis:
 * - Jalankan setiap hari jam 03:00
 * - Hapus file > 2 minggu yang tidak dipakai
 * - Simpan file penting (creds.json, session-*, app-state-sync-version-*)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWhatsAppCleanupScheduler = startWhatsAppCleanupScheduler;
exports.stopWhatsAppCleanupScheduler = stopWhatsAppCleanupScheduler;
exports.cleanupWhatsAppAuth = cleanupWhatsAppAuth;
const node_cron_1 = __importDefault(require("node-cron"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const WA_AUTH_DIRS = [
    path_1.default.join(process.cwd(), 'whatsapp_auth'),
    path_1.default.join(process.cwd(), 'whatsapp_auth_v3')
];
const MAX_AGE_DAYS = 14; // 2 minggu
// File PENTING yang HARUS DISIMPAN (tidak peduli umur)
const ESSENTIAL_PATTERNS = [
    /^creds\.json$/, // Credential utama
    /^session-.*\.json$/, // Session aktif
    /^app-state-sync-version-.*\.json$/, // State version
];
// File yang BOLEH DIHAPUS jika > 2 minggu
const DELETABLE_PATTERNS = [
    /^pre-key-\d+\.json$/, // Pre-keys lama
    /^app-state-sync-key-.*\.json$/, // State keys lama
    /^device-list-.*\.json$/, // Device list lama
    /^lid-mapping-.*\.json$/, // LID mapping lama
];
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
function cleanupWhatsAppAuth() {
    let deleted = 0;
    let kept = 0;
    WA_AUTH_DIRS.forEach(waDir => {
        if (!fs_1.default.existsSync(waDir)) {
            console.log(`[WACleanup] Folder ${path_1.default.basename(waDir)} tidak ditemukan`);
            return;
        }
        const allFiles = fs_1.default.readdirSync(waDir).filter(f => f.endsWith('.json'));
        allFiles.forEach(file => {
            const filePath = path_1.default.join(waDir, file);
            const ageDays = getFileAgeDays(filePath);
            // Cek apakah file PENTING
            const isEssential = ESSENTIAL_PATTERNS.some(pattern => pattern.test(file));
            if (isEssential) {
                kept++;
                return;
            }
            // Cek apakah file BISA DIHAPUS
            const isDeletable = DELETABLE_PATTERNS.some(pattern => pattern.test(file));
            if (isDeletable && ageDays > MAX_AGE_DAYS) {
                try {
                    fs_1.default.unlinkSync(filePath);
                    deleted++;
                    console.log(`[WACleanup] 🗑️ Deleted: ${file} (${Math.floor(ageDays)} days old from ${path_1.default.basename(waDir)})`);
                }
                catch (e) {
                    console.error(`[WACleanup] ❌ Failed to delete ${file}:`, e.message);
                }
            }
            else {
                kept++;
            }
        });
    });
    return { deleted, kept };
}
// Scheduler: Jalankan setiap hari jam 03:00
let cleanupTask = null;
function startWhatsAppCleanupScheduler() {
    if (cleanupTask) {
        console.log('[WACleanup] Scheduler sudah berjalan');
        return;
    }
    // Cron: "0 3 * * *" = setiap hari jam 03:00
    cleanupTask = node_cron_1.default.schedule('0 3 * * *', () => {
        console.log('[WACleanup] 🧹 Memulai pembersihan otomatis...');
        const result = cleanupWhatsAppAuth();
        console.log(`[WACleanup] ✅ Selesai: ${result.deleted} file dihapus, ${result.kept} file disimpan`);
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });
    console.log('[WACleanup] ✅ Scheduler aktif (setiap hari jam 03:00 WIB)');
}
function stopWhatsAppCleanupScheduler() {
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = null;
        console.log('[WACleanup] Scheduler dihentikan');
    }
}
//# sourceMappingURL=WhatsAppCleanupService.js.map