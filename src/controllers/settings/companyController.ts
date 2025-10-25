import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'public/uploads/company';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan'));
        }
    }
});

export class CompanyController {
    // Tampilkan form pengaturan perusahaan
    static async showSettings(req: Request, res: Response) {
        try {
            const [companySettings] = await databasePool.query(
                'SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1'
            );

            res.render('settings/company', {
                title: 'Pengaturan Perusahaan',
                company: (companySettings as any[])[0] || null,
                success: req.flash('success'),
                error: req.flash('error')
            });
        } catch (error) {
            console.error('Error loading company settings:', error);
            req.flash('error', 'Gagal memuat pengaturan perusahaan');
            res.redirect('/dashboard');
        }
    }

    // Simpan pengaturan perusahaan
    static async saveSettings(req: Request, res: Response) {
        try {
            const {
                company_name,
                company_address,
                company_phone,
                company_email,
                company_website,
                template_header,
                template_footer,
                font_size,
                paper_size,
                orientation,
                logo_url
            } = req.body;

            // Cek apakah sudah ada pengaturan
            const [existingSettings] = await databasePool.query(
                'SELECT id FROM company_settings ORDER BY updated_at DESC LIMIT 1'
            );

            if ((existingSettings as any[]).length > 0) {
                // Update pengaturan yang sudah ada
                await databasePool.query(
                    `UPDATE company_settings SET 
                     company_name = ?, 
                     company_address = ?, 
                     company_phone = ?, 
                     company_email = ?, 
                     company_website = ?, 
                     template_header = ?, 
                     template_footer = ?, 
                     font_size = ?, 
                     paper_size = ?, 
                     orientation = ?,
                     logo_url = ?,
                     updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [
                        company_name,
                        company_address,
                        company_phone,
                        company_email,
                        company_website,
                        template_header,
                        template_footer,
                        font_size,
                        paper_size,
                        orientation,
                        logo_url,
                        (existingSettings as any[])[0].id
                    ]
                );
            } else {
                // Insert pengaturan baru
                await databasePool.query(
                    `INSERT INTO company_settings (
                        company_name, company_address, company_phone, 
                        company_email, company_website, template_header, 
                        template_footer, font_size, paper_size, orientation, logo_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        company_name,
                        company_address,
                        company_phone,
                        company_email,
                        company_website,
                        template_header,
                        template_footer,
                        font_size,
                        paper_size,
                        orientation,
                        logo_url
                    ]
                );
            }

            req.flash('success', 'Pengaturan perusahaan berhasil disimpan');
            res.redirect('/settings/company');
        } catch (error) {
            console.error('Error saving company settings:', error);
            req.flash('error', 'Gagal menyimpan pengaturan perusahaan');
            res.redirect('/settings/company');
        }
    }

    // Upload logo perusahaan
    static async uploadLogo(req: Request, res: Response) {
        try {
            const uploadSingle = upload.single('company_logo');
            
            uploadSingle(req, res, async (err) => {
                if (err) {
                    req.flash('error', 'Gagal upload logo: ' + err.message);
                    return res.redirect('/settings/company');
                }

                if (!req.file) {
                    req.flash('error', 'Tidak ada file yang diupload');
                    return res.redirect('/settings/company');
                }

                const logoUrl = `/uploads/company/${req.file.filename}`;

                // Update logo URL di database
                await databasePool.query(
                    'UPDATE company_settings SET logo_url = ?, updated_at = CURRENT_TIMESTAMP ORDER BY updated_at DESC LIMIT 1',
                    [logoUrl]
                );

                req.flash('success', 'Logo berhasil diupload');
                res.redirect('/settings/company');
            });
        } catch (error) {
            console.error('Error uploading logo:', error);
            req.flash('error', 'Gagal upload logo');
            res.redirect('/settings/company');
        }
    }

    // Preview template
    static async previewTemplate(req: Request, res: Response) {
        try {
            const [companySettings] = await databasePool.query(
                'SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1'
            );

            // Buat data dummy untuk preview
            const previewData = {
                company: (companySettings as any[])[0] || {
                    name: 'PT. Internet Provider',
                    address: 'Jl. Contoh No. 123',
                    phone: '(021) 123-4567',
                    email: 'info@internetprovider.com'
                },
                invoice: {
                    invoice_number: 'INV-001-2024',
                    created_at: new Date(),
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    amount: 150000,
                    total_amount: 150000,
                    billing_period_start: new Date()
                },
                customer: {
                    name: 'John Doe',
                    address: 'Jl. Pelanggan No. 456',
                    rt_rw: '001/002',
                    kelurahan: 'Contoh',
                    phone: '081234567890'
                },
                package: {
                    name: 'Paket Internet 50 Mbps'
                }
            };

            res.render('billing/invoices/print', previewData);
        } catch (error) {
            console.error('Error previewing template:', error);
            req.flash('error', 'Gagal memuat preview template');
            res.redirect('/settings/company');
        }
    }

    // Export pengaturan
    static async exportSettings(req: Request, res: Response) {
        try {
            const [companySettings] = await databasePool.query(
                'SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1'
            );

            const settingsData = {
                company_settings: (companySettings as any[])[0] || null,
                export_date: new Date().toISOString(),
                version: '1.0'
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="company-settings.json"');
            res.json(settingsData);
        } catch (error) {
            console.error('Error exporting settings:', error);
            req.flash('error', 'Gagal export pengaturan');
            res.redirect('/settings/company');
        }
    }

    // Import pengaturan
    static async importSettings(req: Request, res: Response) {
        try {
            if (!req.file) {
                req.flash('error', 'Tidak ada file yang diupload');
                return res.redirect('/settings/company');
            }

            const settingsData = JSON.parse(req.file.buffer.toString());
            
            if (!settingsData.company_settings) {
                req.flash('error', 'Format file tidak valid');
                return res.redirect('/settings/company');
            }

            const settings = settingsData.company_settings;

            // Update atau insert pengaturan
            await databasePool.query(
                `INSERT INTO company_settings (
                    company_name, company_address, company_phone, 
                    company_email, company_website, template_header, 
                    template_footer, font_size, paper_size, orientation, logo_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    company_name = VALUES(company_name),
                    company_address = VALUES(company_address),
                    company_phone = VALUES(company_phone),
                    company_email = VALUES(company_email),
                    company_website = VALUES(company_website),
                    template_header = VALUES(template_header),
                    template_footer = VALUES(template_footer),
                    font_size = VALUES(font_size),
                    paper_size = VALUES(paper_size),
                    orientation = VALUES(orientation),
                    logo_url = VALUES(logo_url),
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    settings.company_name,
                    settings.company_address,
                    settings.company_phone,
                    settings.company_email,
                    settings.company_website,
                    settings.template_header,
                    settings.template_footer,
                    settings.font_size,
                    settings.paper_size,
                    settings.orientation,
                    settings.logo_url
                ]
            );

            req.flash('success', 'Pengaturan berhasil diimport');
            res.redirect('/settings/company');
        } catch (error) {
            console.error('Error importing settings:', error);
            req.flash('error', 'Gagal import pengaturan');
            res.redirect('/settings/company');
        }
    }

    // Reset ke pengaturan default
    static async resetToDefault(req: Request, res: Response) {
        try {
            await databasePool.query(
                `UPDATE company_settings SET 
                 company_name = 'PT. Internet Provider',
                 company_address = 'Jl. Contoh No. 123\\nJakarta Selatan, 12345',
                 company_phone = '(021) 123-4567',
                 company_email = 'info@internetprovider.com',
                 company_website = 'www.internetprovider.com',
                 template_header = 'PT. INTERNET PROVIDER\\nJl. Contoh No. 123\\nTelp: (021) 123-4567',
                 template_footer = 'Terima kasih atas kepercayaan Anda\\nHubungi kami untuk informasi lebih lanjut',
                 font_size = '14',
                 paper_size = 'A4',
                 orientation = 'portrait',
                 logo_url = NULL,
                 updated_at = CURRENT_TIMESTAMP
                 ORDER BY updated_at DESC LIMIT 1`
            );

            req.flash('success', 'Pengaturan berhasil direset ke default');
            res.redirect('/settings/company');
        } catch (error) {
            console.error('Error resetting settings:', error);
            req.flash('error', 'Gagal reset pengaturan');
            res.redirect('/settings/company');
        }
    }
}
