"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pool_1 = __importDefault(require("../../db/pool"));
const GitHubService_1 = require("./GitHubService");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class UpdateService {
    /**
     * Check if Git is available
     */
    static async isGitAvailable() {
        try {
            await execAsync('git --version');
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Execute git command
     */
    static async execGit(command) {
        const { stdout, stderr } = await execAsync(`git ${command}`, {
            cwd: this.projectRoot,
            timeout: 60000 // 1 minute
        });
        if (stderr && !stderr.includes('warning') && !stderr.includes('Already')) {
            console.error('Git stderr:', stderr);
        }
        return stdout;
    }
    /**
     * Create backup before update
     */
    static async createBackup(version) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(this.projectRoot, 'backups', 'pre-update');
        const backupPath = path.join(backupDir, `backup-v${version}-${timestamp}`);
        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        // Backup current state using git stash
        try {
            await this.execGit('stash push -u -m "Pre-update backup"');
        }
        catch (error) {
            console.log('No changes to stash');
        }
        return backupPath;
    }
    /**
     * Log update to history
     */
    static async logUpdate(versionFrom, versionTo, status, errorMessage = '', changelog = '') {
        const [result] = await pool_1.default.query(`INSERT INTO update_history 
       (version_from, version_to, status, error_message, changelog, completed_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`, [versionFrom, versionTo, status, errorMessage, changelog]);
        return result.insertId;
    }
    /**
     * Update app version in database
     */
    static async updateVersion(version) {
        await pool_1.default.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [version.replace(/^v/, ''), 'app_version']);
    }
    /**
     * Apply update using git pull
     */
    static async applyUpdate(targetVersion) {
        const currentVersion = await GitHubService_1.GitHubService.getCurrentVersion();
        try {
            // Check if Git is available
            if (!await this.isGitAvailable()) {
                throw new Error('Git is not installed or not accessible');
            }
            // Create backup
            console.log('Creating backup...');
            const backupPath = await this.createBackup(currentVersion);
            // Log update start
            await this.logUpdate(currentVersion, targetVersion, 'applying', '', 'Applying update...');
            // Fetch from remote
            console.log('Fetching from GitHub...');
            await this.execGit('fetch origin --tags');
            // Ensure we're on main branch
            console.log('Switching to main branch...');
            await this.execGit('checkout main');
            // Pull latest changes
            console.log('Pulling latest changes...');
            await this.execGit('pull origin main');
            // Update database version
            await this.updateVersion(targetVersion);
            // Log success
            await this.logUpdate(currentVersion, targetVersion, 'success', '', `Updated from ${currentVersion} to ${targetVersion}`);
            return {
                success: true,
                message: `Successfully updated from ${currentVersion} to ${targetVersion}. Please restart the application.`,
                needsRestart: true
            };
        }
        catch (error) {
            console.error('Update failed:', error);
            // Log failure
            await this.logUpdate(currentVersion, targetVersion, 'failed', error.message);
            // Attempt rollback
            try {
                await this.rollbackUpdate(currentVersion);
                return {
                    success: false,
                    message: `Update failed: ${error.message}. Rolled back to ${currentVersion}.`,
                    needsRestart: false
                };
            }
            catch (rollbackError) {
                return {
                    success: false,
                    message: `Update failed and rollback failed: ${rollbackError.message}. Manual intervention required.`,
                    needsRestart: false
                };
            }
        }
    }
    /**
     * Rollback to previous version
     */
    static async rollbackUpdate(targetVersion) {
        console.log(`Rolling back to ${targetVersion}...`);
        // Checkout target version
        await this.execGit(`checkout v${targetVersion}`);
        // Update database
        await this.updateVersion(targetVersion);
        // Log rollback
        const currentVersion = await GitHubService_1.GitHubService.getCurrentVersion();
        await this.logUpdate(currentVersion, targetVersion, 'rolled_back', '', 'Rollback successful');
    }
    /**
     * Get update history
     */
    static async getUpdateHistory(limit = 10) {
        const [rows] = await pool_1.default.query('SELECT * FROM update_history ORDER BY started_at DESC LIMIT ?', [limit]);
        return rows;
    }
    /**
     * Install/update npm dependencies if package.json changed
     */
    static async updateDependencies() {
        console.log('Updating dependencies...');
        await execAsync('npm install', {
            cwd: this.projectRoot,
            timeout: 300000 // 5 minutes
        });
    }
    /**
     * Rebuild TypeScript
     */
    static async rebuildProject() {
        console.log('Rebuilding project...');
        await execAsync('npm run build', {
            cwd: this.projectRoot,
            timeout: 180000 // 3 minutes
        });
    }
    /**
     * Restart application (using PM2)
     */
    static async restartApplication() {
        console.log('Restarting application...');
        try {
            await execAsync('pm2 restart billing-app', {
                timeout: 30000
            });
        }
        catch (error) {
            console.log('PM2 restart failed, application may need manual restart');
        }
    }
    /**
     * Full update process with all steps
     */
    static async performFullUpdate(targetVersion) {
        const steps = [];
        try {
            // Step 1: Apply update
            steps.push({ step: 'Applying update', status: 'in_progress', message: '' });
            const updateResult = await this.applyUpdate(targetVersion);
            const lastStep = steps[steps.length - 1];
            if (lastStep) {
                lastStep.status = updateResult.success ? 'success' : 'failed';
                lastStep.message = updateResult.message;
            }
            if (!updateResult.success) {
                return { success: false, message: updateResult.message, steps };
            }
            // Step 2: Update dependencies
            steps.push({ step: 'Updating dependencies', status: 'in_progress', message: '' });
            try {
                await this.updateDependencies();
                const lastStep = steps[steps.length - 1];
                if (lastStep) {
                    lastStep.status = 'success';
                    lastStep.message = 'Dependencies updated';
                }
            }
            catch (error) {
                const lastStep = steps[steps.length - 1];
                if (lastStep) {
                    lastStep.status = 'warning';
                    lastStep.message = `Dependencies update failed: ${error.message}`;
                }
            }
            // Step 3: Rebuild project
            steps.push({ step: 'Rebuilding project', status: 'in_progress', message: '' });
            try {
                await this.rebuildProject();
                const lastStep = steps[steps.length - 1];
                if (lastStep) {
                    lastStep.status = 'success';
                    lastStep.message = 'Project rebuilt successfully';
                }
            }
            catch (error) {
                const lastStep = steps[steps.length - 1];
                if (lastStep) {
                    lastStep.status = 'warning';
                    lastStep.message = `Rebuild failed: ${error.message}`;
                }
            }
            // Step 4: Restart application
            steps.push({ step: 'Restarting application', status: 'in_progress', message: '' });
            try {
                await this.restartApplication();
                const lastStep = steps[steps.length - 1];
                if (lastStep) {
                    lastStep.status = 'success';
                    lastStep.message = 'Application restarted';
                }
            }
            catch (error) {
                const lastStep = steps[steps.length - 1];
                if (lastStep) {
                    lastStep.status = 'warning';
                    lastStep.message = 'Please restart manually';
                }
            }
            return {
                success: true,
                message: `Successfully updated to ${targetVersion}`,
                steps
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Update failed: ${error.message}`,
                steps
            };
        }
    }
}
exports.UpdateService = UpdateService;
UpdateService.projectRoot = path.resolve(__dirname, '../../..');
//# sourceMappingURL=UpdateService.js.map