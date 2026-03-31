"use strict";
/**
 * System Update Controller
 * Handles automatic updates from GitHub repository
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemUpdateController = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SystemUpdateController {
    /**
     * Show update page
     */
    static async showUpdatePage(req, res) {
        try {
            // Get current version from package.json
            const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
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
            }
            catch (error) {
                console.error('Git command error:', error);
            }
            res.render('settings/system-update', {
                title: 'System Update',
                currentVersion,
                gitBranch,
                gitCommit,
                gitStatus,
                hasUpdates,
                user: req.session?.user
            });
        }
        catch (error) {
            console.error('Error showing update page:', error);
            res.status(500).json({ success: false, error: 'Failed to load update page' });
        }
    }
    /**
     * Check for updates
     */
    static async checkForUpdates(req, res) {
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
        }
        catch (error) {
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
    /**
     * Perform system update
     */
    /**
     * Perform system update with smart error handling
     */
    static async performUpdate(req, res) {
        try {
            console.log('🚀 Starting robust system update...');
            const updateSteps = [];
            let currentStep = 0;
            const logStep = (msg) => {
                currentStep++;
                const fullMsg = `[${currentStep}/7] ${msg}`;
                updateSteps.push(fullMsg);
                console.log(fullMsg);
            };
            // Helper for Exec with Better Error Handling
            const runCmd = async (cmd, stepName) => {
                try {
                    const { stdout, stderr } = await execAsync(cmd);
                    if (stderr && !stderr.includes('warn') && !stderr.includes('notice')) {
                        // npm output often goes to stderr even for info, so be careful logging it as error
                        console.log(`[${stepName} Output]:`, stderr);
                    }
                    return stdout;
                }
                catch (error) {
                    // Check for EACCES/Permission denied
                    if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
                        throw new Error(`Permission Denied during ${stepName}. The server user lacks write permissions. Please run: 'sudo chown -R $USER /var/www/billing' on the server terminal.`);
                    }
                    throw error;
                }
            };
            // Step 1: Fetch latest from remote
            logStep('Fetching latest from GitHub...');
            await runCmd('git fetch origin', 'Git Fetch');
            // Step 2: Reset hard to match origin/main (Force Update)
            logStep('Forcing sync with main branch...');
            try {
                await runCmd('git reset --hard origin/main', 'Git Reset');
            }
            catch (error) {
                console.error('Git reset failed, trying simple pull...');
                await runCmd('git pull origin main --force', 'Git Pull');
            }
            // Step 3: Check Write Permissions for Build
            logStep('Verifying file permissions...');
            try {
                fs.accessSync(path.join(process.cwd(), 'package-lock.json'), fs.constants.W_OK);
                fs.accessSync(path.join(process.cwd(), 'dist'), fs.constants.W_OK);
            }
            catch (err) {
                // Try to ignore if file doesn't exist, but if exists and no write, it is an error
                console.warn('⚠️ Warning: Write permission check failed. Build might fail.');
            }
            // Step 4: Install dependencies
            logStep('Installing dependencies...');
            // Try installing only production if dev fails, to save time/perms, but we need tsc so dev is needed.
            await runCmd('npm install --legacy-peer-deps', 'NPM Install');
            // Step 5: Build application
            logStep('Building application (TypeScript)...');
            await runCmd('npm run build', 'NPM Build');
            // Step 6: Read new version
            const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
            const newVersion = packageJson.version;
            // Step 7: Send response BEFORE restarting
            logStep(`Update complete! New version: ${newVersion}. Restarting server...`);
            res.json({
                success: true,
                message: 'System updated successfully. Server is restarting...',
                newVersion,
                steps: updateSteps
            });
            console.log('✅ Update finished. Scheduling restart in 2 seconds...');
            // Step 8: Trigger Restart
            setTimeout(() => {
                console.log('🔄 Triggering process exit (PM2 should restart automatically)...');
                process.exit(0);
            }, 2000);
        }
        catch (error) {
            console.error('❌ Error performing update:', error);
            // Clean up error message for user
            let userMsg = error.message;
            if (userMsg.includes('Command failed')) {
                userMsg = userMsg.split('\n').filter((l) => !l.includes('Command failed')).join('\n').trim();
            }
            res.status(500).json({
                success: false,
                error: 'Update Failed',
                details: userMsg,
                steps: []
            });
        }
    }
    /**
     * Get update log/history
     */
    static async getUpdateHistory(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            // Get git log
            const { stdout: logOutput } = await execAsync(`git log -${limit} --pretty=format:"%h|%an|%ar|%s"`);
            const commits = logOutput.split('\n').map(line => {
                const [hash, author, date, message] = line.split('|');
                return { hash, author, date, message };
            });
            res.json({
                success: true,
                commits
            });
        }
        catch (error) {
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
    static async rollbackUpdate(req, res) {
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
            }
            catch (error) {
                console.log('PM2 restart not available');
            }
            res.json({
                success: true,
                message: `Successfully rolled back to ${commitHash}`
            });
            console.log('✅ Rollback completed');
        }
        catch (error) {
            console.error('❌ Error during rollback:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to rollback',
                details: error.message
            });
        }
    }
}
exports.SystemUpdateController = SystemUpdateController;
//# sourceMappingURL=SystemUpdateController.js.map