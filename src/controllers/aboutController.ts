import { Request, Response, NextFunction } from 'express';
import { getAppVersion, getAppFeatures, checkForUpdates, getUpdateSettings } from '../services/aboutService';

export async function getAboutPage(req: Request, res: Response, next: NextFunction) {
    try {
        const version = await getAppVersion();
        const features = await getAppFeatures();
        const updateSettings = await getUpdateSettings();
        
        res.render('about/index', {
            title: 'About Aplikasi',
            version,
            features,
            updateSettings,
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
    } catch (err) {
        next(err);
    }
}

export async function updateApp(req: Request, res: Response, next: NextFunction) {
    try {
        const { version, autoUpdate } = req.body;
        
        // Simulate update process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        req.flash('success', `Aplikasi berhasil diupdate ke versi ${version}`);
        res.redirect('/about');
    } catch (err) {
        next(err);
    }
}

export async function toggleAutoUpdate(req: Request, res: Response, next: NextFunction) {
    try {
        const { enabled } = req.body;
        // Update auto update settings
        req.flash('success', `Auto update ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
        res.redirect('/about');
    } catch (err) {
        next(err);
    }
}

export async function createAppBackup(req: Request, res: Response, next: NextFunction) {
    try {
        // Redirect to backup page
        res.redirect('/backup');
    } catch (err) {
        next(err);
    }
}

export async function restoreAppBackup(req: Request, res: Response, next: NextFunction) {
    try {
        // Redirect to backup page
        res.redirect('/backup');
    } catch (err) {
        next(err);
    }
}
