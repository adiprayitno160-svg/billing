import { IsolationService } from './src/services/billing/isolationService';
import { databasePool } from './src/db/pool';

async function restoreAll() {
    console.log('--- STARTING MASS RESTORE TO MANUAL MODE ---');
    try {
        // 1. Ambil semua yang is_isolated = TRUE
        const result = await IsolationService.bulkRestoreAllSilent('admin_manual_override');
        console.log(`✅ Berhasil memulihkan ${result.restored} pelanggan.`);
        console.log(`❌ Gagal memulihkan ${result.failed} pelanggan (cek log MikroTik).`);
        
        // 2. Pastikan Status Aktif untuk semua
        await databasePool.execute("UPDATE customers SET status = 'active' WHERE status = 'inactive'");
        console.log('✅ Semua pelanggan nonaktif telah diubah menjadi AKTIF.');
        
    } catch (error) {
        console.error('Fatal error during restoration:', error);
    } finally {
        process.exit(0);
    }
}

restoreAll();
