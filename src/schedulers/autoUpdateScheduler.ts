/**
 * Auto Update Scheduler
 * AI-Assisted system to automatically check and apply updates
 */

import cron from 'node-cron';
import { checkForUpdates, getUpdateSettings, performFullUpdate } from '../services/aboutService';


export class AutoUpdateScheduler {
    private job: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;
    private isUpdating: boolean = false;

    /**
     * Start the auto-update scheduler
     */
    async start(): Promise<void> {
        try {
            if (this.isRunning) {
                console.log('[AutoUpdateScheduler] Already running');
                return;
            }

            console.log('[AutoUpdateScheduler] Initializing AI-assisted update monitor...');
            
            // Run check every 4 hours
            this.job = cron.schedule('0 */4 * * *', async () => {
                await this.runUpdateCheck();
            });

            this.isRunning = true;
            console.log('[AutoUpdateScheduler] Successfully started. Checking for updates every 4 hours.');
            
            // Run an initial check 5 minutes after startup to catch missed updates
            setTimeout(() => {
                this.runUpdateCheck().catch(err => console.error('[AutoUpdateScheduler] Initial check error:', err));
            }, 5 * 60 * 1000);

        } catch (error) {
            console.error('[AutoUpdateScheduler] Failed to start:', error);
            throw new Error('Failed to start auto-update scheduler');
        }
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (this.job) {
            this.job.stop();
            this.isRunning = false;
            console.log('[AutoUpdateScheduler] Stopped');
        }
    }

    /**
     * The actual check and update logic
     */
    private async runUpdateCheck(): Promise<void> {
        if (this.isUpdating) {
            console.log('[AutoUpdateScheduler] Update already in progress, skipping check.');
            return;
        }

        try {
            // 1. Check if auto-update is enabled in settings
            const settings = await getUpdateSettings();
            if (!settings.autoUpdate) {
                console.log('[AutoUpdateScheduler] Auto-update is disabled in settings. Skipping check.');
                return;
            }

            console.log('[AutoUpdateScheduler] Checking for new updates...');
            
            // 2. Check for updates using aboutService (which checks GitHub commits behind)
            const updateInfo = await checkForUpdates();
            
            if (updateInfo.available && updateInfo.version) {
                console.log(`[AutoUpdateScheduler] New update found: ${updateInfo.version}. Starting auto-update...`);
                
                this.isUpdating = true;
                
                // 3. Perform the update
                const result = await performFullUpdate(updateInfo.version);
                
                if (result.success) {
                    console.log('[AutoUpdateScheduler] Update successful! System will restart shortly.');
                    // pm2 will handle the restart triggered by performFullUpdate internally if needed,
                    // or performFullUpdate script itself runs restart.
                } else {
                    console.error('[AutoUpdateScheduler] Auto-update failed:', result.message);
                }
                
                this.isUpdating = false;
            } else {
                console.log('[AutoUpdateScheduler] System is up to date.');
            }

        } catch (error) {
            this.isUpdating = false;
            console.error('[AutoUpdateScheduler] Error during update check loop:', error);
        }
    }
}

// Export a singleton instance
export const autoUpdateScheduler = new AutoUpdateScheduler();
