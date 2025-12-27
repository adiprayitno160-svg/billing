/**
 * System Update Controller
 * Handles automatic updates from GitHub repository
 */

import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class SystemUpdateController {
    /**
     * Show update page
     */
    static async showUpdatePage(req: Request, res: Response): Promise<void> {
        try {
            // Get current version from package.json
            const packageJson = JSON.parse(
                fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
            );
            const currentVersion = packageJson.version;

            // Get git status
            let gitStatus = 'Unknown';
            let gitBranch = 'Unknown';
            let gitCommit = 'Unknown';
            let hasUpdates = false;

            try {
                const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD');
                gitBranch = branchOutput.trim();

                const { stdout: commitOutput } = await execAsync('git rev-parse --short HEAD');
                gitCommit = commitOutput.trim();

                // Check if behind using rev-list (more reliable than git status)
                await execAsync('git fetch origin');
                const { stdout: revList } = await execAsync('git rev-list HEAD..origin/main --count');
                const commitsBehind = parseInt(revList.trim(), 10);

                hasUpdates = commitsBehind > 0;
                gitStatus = hasUpdates ? `${commitsBehind} New Updates Available` : 'Up to date';
            } catch (error) {
                console.error('Git command error:', error);
            }

            res.render('settings/system-update', {
                title: 'System Update',
                currentVersion,
                gitBranch,
                gitCommit,
                gitStatus,
                hasUpdates,
                user: (req as any).session?.user
            });
        } catch (error) {
            console.error('Error showing update page:', error);
            res.status(500).json({ success: false, error: 'Failed to load update page' });
        }
    }

    /**
     * Check for updates
     */
    static async checkForUpdates(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔍 Checking for updates...');

            // Fetch latest from remote
            await execAsync('git fetch origin');

            // Check if behind
            // Get commits ahead/behind using rev-list
            const { stdout: revList } = await execAsync('git rev-list HEAD..origin/main --count');
            const commitsBehind = parseInt(revList.trim(), 10);
            const hasUpdates = commitsBehind > 0;

            // Get latest commit info from remote
            const { stdout: latestCommit } = await execAsync('git log origin/main -1 --pretty=format:"%h - %s (%cr)"');

            res.json({
                success: true,
                hasUpdates,
                commitsBehind,
                latestCommit: latestCommit.trim(),
                message: hasUpdates ? `${commitsBehind} new update(s) available` : 'System is up to date'
            });
        } catch (error: any) {
            console.error('Error checking for updates:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check for updates',
                details: error.message
            });
        }
    }

    /**
     * Perform system update
     */
    static async performUpdate(req: Request, res: Response): Promise<void> {
        try {
            console.log('🚀 Starting system update...');

            const updateSteps: string[] = [];
            let currentStep = 0;

            // Step 1: Stash local changes
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Stashing local changes...`);
            console.log(updateSteps[currentStep - 1]);

            try {
                await execAsync('git stash');
            } catch (error) {
                console.log('No local changes to stash');
            }

            // Step 2: Pull latest changes
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Pulling latest changes from GitHub...`);
            console.log(updateSteps[currentStep - 1]);

            const { stdout: pullOutput } = await execAsync('git pull origin main');
            console.log(pullOutput);

            // Step 3: Install dependencies
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Installing dependencies...`);
            console.log(updateSteps[currentStep - 1]);

            const { stdout: npmOutput } = await execAsync('npm install');
            console.log(npmOutput);

            // Step 4: Build application
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Building application...`);
            console.log(updateSteps[currentStep - 1]);

            const { stdout: buildOutput } = await execAsync('npm run build');
            console.log(buildOutput);

            // Step 5: Restart PM2  
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Restarting application...`);
            console.log(updateSteps[currentStep - 1]);

            try {
                const { stdout: pm2Output } = await execAsync('npm run pm2:restart');
                console.log(pm2Output);
            } catch (error) {
                console.log('PM2 restart command not available or failed');
            }

            // Step 6: Complete
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Update complete!`);
            console.log(updateSteps[currentStep - 1]);

            // Get new version
            const packageJson = JSON.parse(
                fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
            );
            const newVersion = packageJson.version;

            res.json({
                success: true,
                message: 'System updated successfully',
                newVersion,
                steps: updateSteps
            });

            console.log('✅ System update completed successfully');
        } catch (error: any) {
            console.error('❌ Error performing update:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update system',
                details: error.message
            });
        }
    }

    /**
     * Get update log/history
     */
    static async getUpdateHistory(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;

            // Get git log
            const { stdout: logOutput } = await execAsync(
                `git log -${limit} --pretty=format:"%h|%an|%ar|%s"`
            );

            const commits = logOutput.split('\n').map(line => {
                const [hash, author, date, message] = line.split('|');
                return { hash, author, date, message };
            });

            res.json({
                success: true,
                commits
            });
        } catch (error: any) {
            console.error('Error getting update history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get update history',
                details: error.message
            });
        }
    }

    /**
     * Rollback to previous version
     */
    static async rollbackUpdate(req: Request, res: Response): Promise<void> {
        try {
            const { commitHash } = req.body;

            if (!commitHash) {
                return res.status(400).json({
                    success: false,
                    error: 'Commit hash is required'
                });
            }

            console.log(`🔄 Rolling back to commit: ${commitHash}`);

            // Checkout to specific commit
            await execAsync(`git checkout ${commitHash}`);

            // Install dependencies
            await execAsync('npm install');

            // Build
            await execAsync('npm run build');

            // Restart PM2
            try {
                await execAsync('npm run pm2:restart');
            } catch (error) {
                console.log('PM2 restart not available');
            }

            res.json({
                success: true,
                message: `Successfully rolled back to ${commitHash}`
            });

            console.log('✅ Rollback completed');
        } catch (error: any) {
            console.error('❌ Error during rollback:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to rollback',
                details: error.message
            });
        }
    }
}
