import { Request, Response, NextFunction } from 'express';
import {
    getAppVersion,
    getAppFeatures,
    checkForUpdates,
    getUpdateSettings,
    saveUpdateSettings,
    applyUpdate,
    performFullUpdate,
    getUpdateHistory
} from '../services/aboutService';

export async function getAboutPage(req: Request, res: Response, next: NextFunction) {
    try {
        const version = await getAppVersion();
        const features = await getAppFeatures();
        const updateSettings = await getUpdateSettings();
        const updateHistory = await getUpdateHistory(5);
        
        res.render('about/index', {
            title: 'Tentang Aplikasi',
            version,
            features,
            updateSettings,
            updateHistory,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (err) {
        next(err);
    }
}

export async function checkUpdates(req: Request, res: Response, next: NextFunction) {
    try {
        const updateInfo = await checkForUpdates();
        res.json(updateInfo);
    } catch (err: any) {
        res.status(500).json({
            available: false,
            error: err.message
        });
    }
}

export async function updateAppVersion(req: Request, res: Response, next: NextFunction) {
    try {
        const { version } = req.body;
        
        if (!version) {
            req.flash('error', 'Version tidak valid');
            return res.redirect('/about');
        }

        // Perform full update with all steps
        const result = await performFullUpdate(version);
        
        if (result.success) {
            req.flash('success', result.message);
        } else {
            req.flash('error', result.message);
        }
        
        res.redirect('/about');
    } catch (err: any) {
        req.flash('error', `Update gagal: ${err.message}`);
        res.redirect('/about');
    }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const { autoUpdate, updateChannel } = req.body;
        
        await saveUpdateSettings({
            autoUpdate: autoUpdate === 'on' || autoUpdate === 'true',
            updateChannel: updateChannel || 'stable'
        });
        
        req.flash('success', 'Pengaturan update berhasil disimpan');
        res.redirect('/about');
    } catch (err: any) {
        req.flash('error', `Gagal menyimpan pengaturan: ${err.message}`);
        res.redirect('/about');
    }
}

export async function getUpdateHistoryPage(req: Request, res: Response, next: NextFunction) {
    try {
        const history = await getUpdateHistory(20);
        res.json(history);
    } catch (err: any) {
        res.status(500).json({
            error: err.message
        });
    }
}

export async function checkHotfix(req: Request, res: Response, next: NextFunction) {
    try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');
        
        // Read current hotfix version
        const versionHotfixPath = path.join(__dirname, '../../VERSION_HOTFIX');
        let currentVersion = '2.1.1';
        
        try {
            if (fs.existsSync(versionHotfixPath)) {
                currentVersion = fs.readFileSync(versionHotfixPath, 'utf-8').trim();
            }
        } catch (err) {
            console.error('Error reading VERSION_HOTFIX:', err);
        }
        
        // Fetch latest from GitHub
        try {
            execSync('git fetch origin main 2>&1', { stdio: 'ignore', timeout: 10000 });
        } catch (err) {
            console.error('Git fetch failed, continuing with cached data:', err);
        }
        
        // Check remote VERSION_HOTFIX
        let remoteVersion = currentVersion;
        try {
            const output = execSync('git show origin/main:VERSION_HOTFIX 2>&1', { 
                encoding: 'utf-8',
                timeout: 5000 
            });
            remoteVersion = output.trim();
        } catch (err) {
            console.error('Failed to read remote VERSION_HOTFIX, using current:', err);
            // Return current version as latest if can't reach remote
            return res.json({
                available: false,
                version: currentVersion,
                currentVersion,
                message: 'Tidak dapat terhubung ke GitHub. Menggunakan versi lokal.'
            });
        }
        
        // Check if hotfix available
        if (remoteVersion !== currentVersion) {
            // Read hotfix changelog if exists
            let fixes: string[] = [];
            let severity = 'medium';
            
            const hotfixMdPath = path.join(__dirname, `../../hotfix/${remoteVersion}.md`);
            try {
                const hotfixContent = execSync(`git show origin/main:hotfix/${remoteVersion}.md`, { encoding: 'utf-8' });
                
                // Parse severity from markdown
                if (hotfixContent.includes('Critical')) severity = 'critical';
                else if (hotfixContent.includes('High')) severity = 'high';
                
                // Extract fixes from markdown (simple parsing)
                const lines = hotfixContent.split('\n');
                fixes = lines
                    .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
                    .map(line => line.trim().substring(1).trim())
                    .slice(0, 5); // Max 5 items
                
                if (fixes.length === 0) {
                    fixes = ['Bug fixes and improvements'];
                }
            } catch (err) {
                fixes = ['Bug fixes and improvements'];
            }
            
            res.json({
                available: true,
                version: remoteVersion,
                currentVersion,
                severity,
                fixes
            });
        } else {
            res.json({
                available: false,
                version: currentVersion,
                currentVersion
            });
        }
    } catch (err: any) {
        console.error('Error checking hotfix:', err);
        res.status(500).json({
            available: false,
            error: err.message
        });
    }
}

export async function applyHotfixUpdate(req: Request, res: Response, next: NextFunction) {
    try {
        const { version } = req.body;
        const { execSync } = require('child_process');
        const fs = require('fs');
        const path = require('path');
        
        if (!version) {
            req.flash('error', 'Versi hotfix tidak valid');
            return res.redirect('/about');
        }
        
        console.log('🔧 Applying hotfix:', version);
        
        // Pull latest changes
        try {
            execSync('git pull origin main', { stdio: 'inherit' });
        } catch (err: any) {
            throw new Error(`Git pull failed: ${err.message}`);
        }
        
        // Check if hotfix script exists
        const hotfixScript = path.join(__dirname, `../../hotfix/${version}-fix.js`);
        if (fs.existsSync(hotfixScript)) {
            console.log('🔧 Running hotfix script:', hotfixScript);
            try {
                execSync(`node "${hotfixScript}"`, { stdio: 'inherit' });
            } catch (err: any) {
                console.error('Hotfix script failed:', err);
                // Continue anyway, script might not be critical
            }
        }
        
        // Restart PM2
        try {
            execSync('pm2 restart billing-app', { stdio: 'inherit' });
        } catch (err: any) {
            throw new Error(`PM2 restart failed: ${err.message}`);
        }
        
        req.flash('success', `Hotfix ${version} berhasil diterapkan! Aplikasi telah direstart.`);
        res.redirect('/about');
    } catch (err: any) {
        console.error('Error applying hotfix:', err);
        req.flash('error', `Gagal menerapkan hotfix: ${err.message}`);
        res.redirect('/about');
    }
}