/**
 * WhatsApp Auth Cleanup Service
 * ==============================
 * Scheduler yang membersihkan file WhatsApp auth secara otomatis:
 * - Jalankan setiap hari jam 03:00
 * - Hapus file > 2 minggu yang tidak dipakai
 * - Simpan file penting (creds.json, session-*, app-state-sync-version-*)
 */
declare function cleanupWhatsAppAuth(): {
    deleted: number;
    kept: number;
};
export declare function startWhatsAppCleanupScheduler(): void;
export declare function stopWhatsAppCleanupScheduler(): void;
export { cleanupWhatsAppAuth };
//# sourceMappingURL=WhatsAppCleanupService.d.ts.map