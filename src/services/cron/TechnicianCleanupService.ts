import { databasePool } from '../../db/pool';
import cron from 'node-cron';

export class TechnicianCleanupService {

    /**
     * Start the scheduler to clean up old technician logs.
     * Schedule: Runs at 02:00 AM on the 1st day of every month.
     * Retention: 2 months (60 days).
     */
    static startScheduler() {
        console.log('[Scheduler] Technician Cleanup Scheduler initialized (Monthly on 1st).');

        // Cron expression: 0 2 1 * * (At 02:00 on day-of-month 1)
        cron.schedule('0 2 1 * *', async () => {
            console.log('[Cleanup] Starting monthly technician log cleanup...');
            await this.cleanupOldJobs();
        });
    }

    /**
     * Delete technician jobs older than 2 months (completed/cancelled only).
     */
    static async cleanupOldJobs() {
        try {
            const retentionDays = 60; // 2 Months

            // Calculate cutoff date exactly 60 days ago
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const formattedDate = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

            console.log(`[Cleanup] Deleting technician jobs completed before ${formattedDate}`);

            // Delete Jobs (Cascade should handle related tables like fee_distributions if set, 
            // but we'll do manual cleanup if needed or rely on ON DELETE CASCADE in schema)
            // Assuming ON DELETE CASCADE is safest, or we perform soft delete?
            // User request is "hapus log", implies Hard Delete.

            // 1. Delete completed/cancelled logs
            const [result]: any = await databasePool.query(
                `DELETE FROM technician_jobs 
                 WHERE status IN ('completed', 'cancelled') 
                 AND created_at < ?`,
                [formattedDate]
            );

            console.log(`[Cleanup] Success. Deleted ${result.affectedRows} old technician jobs.`);

            // Optional: Delete orphan fee distributions if not cascaded
            // await databasePool.query("DELETE FROM technician_fee_distributions WHERE technician_job_id NOT IN (SELECT id FROM technician_jobs)");

        } catch (error) {
            console.error('[Cleanup] Error deleting old technician logs:', error);
        }
    }
}
