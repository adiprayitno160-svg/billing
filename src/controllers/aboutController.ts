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
            title: 'About Aplikasi',
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
