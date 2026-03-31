// src/controllers/customers/PPPoEController.ts
import { Request, Response } from 'express';
import { PPPoEService } from '../../services/pppoe/PPPoEService';

export class PPPoEController {
    /**
     * Render form untuk pendaftaran PPPoE baru.
     * Username akan di‑generate otomatis, password default = 12345.
     */
    static async renderForm(req: Request, res: Response) {
        try {
            const generated = await PPPoEService.generateCredentials();
            res.render('customers/pppoe_new', {
                title: 'Pendaftaran PPPoE',
                layout: 'layouts/main',
                username: generated.username,
                password: generated.password,
            });
        } catch (err) {
            console.error('Error rendering PPPoE form', err);
            res.status(500).render('error', { message: 'Gagal menampilkan form PPPoE' });
        }
    }

    /**
     * Proses penyimpanan pelanggan PPPoE.
     */
    static async create(req: Request, res: Response) {
        const { username, password, name, address, phone } = req.body;
        try {
            await PPPoEService.createCustomer({ username, password, name, address, phone });
            res.redirect('/customers/pppoe/success');
        } catch (err) {
            console.error('Error creating PPPoE customer', err);
            res.status(500).render('error', { message: 'Gagal membuat pelanggan PPPoE' });
        }
    }

    /**
     * Simple success page.
     */
    static async success(req: Request, res: Response) {
        res.render('customers/pppoe_success', {
            title: 'PPPoE Berhasil',
            layout: 'layouts/main',
        });
    }
}
