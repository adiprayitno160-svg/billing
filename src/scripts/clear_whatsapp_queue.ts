import { databasePool } from '../db/pool';

async function clearQueue() {
    console.log('🧹 Clearing WhatsApp Notification Queue...');
    try {
        // Check count first
        const [rows]: any = await databasePool.query(
            `SELECT COUNT(*) as count FROM unified_notifications_queue 
             WHERE channel = 'whatsapp' AND status IN ('pending', 'processing')`
        );
        const count = rows[0].count;
        console.log(`📋 Found ${count} pending/processing WhatsApp notifications.`);

        if (count > 0) {
            const [result] = await databasePool.query(
                `DELETE FROM unified_notifications_queue
                 WHERE channel = 'whatsapp' AND status IN ('pending', 'processing')`
            );
            console.log(`✅ Deleted ${(result as any).affectedRows} WhatsApp notifications from queue.`);
        } else {
            console.log('✅ Queue is already empty.');
        }

    } catch (error) {
        console.error('❌ Error clearing queue:', error);
    } finally {
        process.exit();
    }
}

clearQueue();
