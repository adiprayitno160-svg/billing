/**
 * WhatsApp Auth Cleanup Service
 * ==============================
 * Scheduler yang membersihkan file WhatsApp auth secara otomatis:
 * - Jalankan setiap hari jam 03:00
 * - Hapus file > 2 minggu yang tidak dipakai
 * - Simpan file penting (creds.json, session-*, app-state-sync-version-*)
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

const WA_AUTH_DIR = path.join(process.cwd(), 'whatsapp_auth');
const MAX_AGE_DAYS = 14; // 2 minggu

// File PENTING yang HARUS DISIMPAN (tidak peduli umur)
const ESSENTIAL_PATTERNS = [
    /^creds\.json$/,                    // Credential utama
    /^session-.*\.json$/,               // Session aktif
    /^app-state-sync-version-.*\.json$/, // State version
];

// File yang BOLEH DIHAPUS jika > 2 minggu
const DELETABLE_PATTERNS = [
    /^pre-key-\d+\.json$/,              // Pre-keys lama
    /^app-state-sync-key-.*\.json$/,    // State keys lama
    /^device-list-.*\.json$/,           // Device list lama
    /^lid-mapping-.*\.json$/,           // LID mapping lama
];

function getFileAgeDays(filePath: string): number {
    try {
        const stat = fs.statSync(filePath);
        const ageMs = Date.now() - stat.mtimeMs;
        return ageMs / (1000 * 60 * 60 * 24);
    } catch {
        return 0;
    }
}

function cleanupWhatsAppAuth(): { deleted: number; kept: number } {
    let deleted = 0;
    let kept = 0;

    if (!fs.existsSync(WA_AUTH_DIR)) {
        console.log('[WACleanup] Folder whatsapp_auth tidak ditemukan');
        return { deleted, kept };
    }

    const allFiles = fs.readdirSync(WA_AUTH_DIR).filter(f => f.endsWith('.json'));

    allFiles.forEach(file => {
        const filePath = path.join(WA_AUTH_DIR, file);
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
                fs.unlinkSync(filePath);
                deleted++;
                console.log(`[WACleanup] 🗑️ Deleted: ${file} (${Math.floor(ageDays)} days old)`);
            } catch (e: any) {
                console.error(`[WACleanup] ❌ Failed to delete ${file}:`, e.message);
            }
        } else {
            kept++;
        }
    });

    return { deleted, kept };
}

// Scheduler: Jalankan setiap hari jam 03:00
let cleanupTask: cron.ScheduledTask | null = null;

export function startWhatsAppCleanupScheduler(): void {
    if (cleanupTask) {
        console.log('[WACleanup] Scheduler sudah berjalan');
        return;
    }

    // Cron: "0 3 * * *" = setiap hari jam 03:00
    cleanupTask = cron.schedule('0 3 * * *', () => {
        console.log('[WACleanup] 🧹 Memulai pembersihan otomatis...');
        const result = cleanupWhatsAppAuth();
        console.log(`[WACleanup] ✅ Selesai: ${result.deleted} file dihapus, ${result.kept} file disimpan`);
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });

    console.log('[WACleanup] ✅ Scheduler aktif (setiap hari jam 03:00 WIB)');
}

export function stopWhatsAppCleanupScheduler(): void {
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = null;
        console.log('[WACleanup] Scheduler dihentikan');
    }
}

// Export fungsi cleanup untuk dijalankan manual
export { cleanupWhatsAppAuth };
