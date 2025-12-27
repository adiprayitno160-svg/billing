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
                const { stdout: statusOutput } = await execAsync('git status -uno');
                gitStatus = statusOutput.includes('Your branch is behind') ? 'Updates Available' : 'Up to date';
                hasUpdates = statusOutput.includes('Your branch is behind');
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
            const { stdout: statusOutput } = await execAsync('git status -uno');
            const hasUpdates = statusOutput.includes('Your branch is behind');
            // Get commits ahead/behind
            let commitsBehind = 0;
            if (hasUpdates) {
                const { stdout: revList } = await execAsync('git rev-list HEAD..origin/main --count');
                commitsBehind = parseInt(revList.trim(), 10);
            }
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
    static async performUpdate(req, res) {
        try {
            console.log('🚀 Starting system update...');
            const updateSteps = [];
            let currentStep = 0;
            // Step 1: Stash local changes
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Stashing local changes...`);
            console.log(updateSteps[currentStep - 1]);
            try {
                await execAsync('git stash');
            }
            catch (error) {
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
            }
            catch (error) {
                console.log('PM2 restart command not available or failed');
            }
            // Step 6: Complete
            currentStep++;
            updateSteps.push(`[${currentStep}/6] Update complete!`);
            console.log(updateSteps[currentStep - 1]);
            // Get new version
            const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
            const newVersion = packageJson.version;
            res.json({
                success: true,
                message: 'System updated successfully',
                newVersion,
                steps: updateSteps
            });
            console.log('✅ System update completed successfully');
        }
        catch (error) {
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