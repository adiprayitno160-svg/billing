import { Request, Response } from 'express';
import { SystemUpdateService } from '../../services/system/SystemUpdateService';

export const getSystemUpdatePage = async (req: Request, res: Response) => {
    try {
        // Initial check (non-blocking)
        // We let the frontend do the actual check to avoid slow page load
        res.render('settings/system_update', {
            title: 'Update Sistem',
            currentPath: '/settings/system-update',
            user: req.user
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Gagal memuat halaman update' });
    }
};
