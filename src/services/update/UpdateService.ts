import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import pool from '../../db/pool';
import { GitHubService } from './GitHubService';
import { ResultSetHeader } from 'mysql2';

const execAsync = promisify(exec);

export class UpdateService {
  private static projectRoot = path.resolve(__dirname, '../../..');

  /**
   * Check if Git is available
   */
  private static async isGitAvailable(): Promise<boolean> {
    try {
      await execAsync('git --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute git command
   */
  private static async execGit(command: string): Promise<string> {
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
  private static async createBackup(version: string): Promise<string> {
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
    } catch (error) {
      console.log('No changes to stash');
    }

    return backupPath;
  }

  /**
   * Log update to history
   */
  private static async logUpdate(
    versionFrom: string,
    versionTo: string,
    status: string,
    errorMessage: string = '',
    changelog: string = ''
  ): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO update_history 
       (version_from, version_to, status, error_message, changelog, completed_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [versionFrom, versionTo, status, errorMessage, changelog]
    );
    return result.insertId;
  }

  /**
   * Update app version in database
   */
  private static async updateVersion(version: string): Promise<void> {
    await pool.query(
      'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
      [version.replace(/^v/, ''), 'app_version']
    );
  }

  /**
   * Apply update using git pull
   */
  static async applyUpdate(targetVersion: string): Promise<{
    success: boolean;
    message: string;
    needsRestart: boolean;
  }> {
    const currentVersion = await GitHubService.getCurrentVersion();

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

    } catch (error: any) {
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
      } catch (rollbackError: any) {
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
  static async rollbackUpdate(targetVersion: string): Promise<void> {
    console.log(`Rolling back to ${targetVersion}...`);
    
    // Checkout target version
    await this.execGit(`checkout v${targetVersion}`);
    
    // Update database
    await this.updateVersion(targetVersion);

    // Log rollback
    const currentVersion = await GitHubService.getCurrentVersion();
    await this.logUpdate(currentVersion, targetVersion, 'rolled_back', '', 'Rollback successful');
  }

  /**
   * Get update history
   */
  static async getUpdateHistory(limit: number = 10): Promise<any[]> {
    const [rows] = await pool.query(
      'SELECT * FROM update_history ORDER BY started_at DESC LIMIT ?',
      [limit]
    );
    return rows as any[];
  }

  /**
   * Install/update npm dependencies if package.json changed
   */
  static async updateDependencies(): Promise<void> {
    console.log('Updating dependencies...');
    await execAsync('npm install', {
      cwd: this.projectRoot,
      timeout: 300000 // 5 minutes
    });
  }

  /**
   * Rebuild TypeScript
   */
  static async rebuildProject(): Promise<void> {
    console.log('Rebuilding project...');
    await execAsync('npm run build', {
      cwd: this.projectRoot,
      timeout: 180000 // 3 minutes
    });
  }

  /**
   * Restart application (using PM2)
   */
  static async restartApplication(): Promise<void> {
    console.log('Restarting application...');
    try {
      await execAsync('pm2 restart billing-app', {
        timeout: 30000
      });
    } catch (error) {
      console.log('PM2 restart failed, application may need manual restart');
    }
  }

  /**
   * Full update process with all steps
   */
  static async performFullUpdate(targetVersion: string): Promise<{
    success: boolean;
    message: string;
    steps: { step: string; status: string; message: string }[];
  }> {
    const steps: { step: string; status: string; message: string }[] = [];

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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
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

    } catch (error: any) {
      return {
        success: false,
        message: `Update failed: ${error.message}`,
        steps
      };
    }
  }
}

