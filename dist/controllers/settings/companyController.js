"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const pool_1 = require("../../db/pool");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Konfigurasi multer untuk upload file
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'public/uploads/company';
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Hanya file gambar yang diperbolehkan'));
        }
    }
});
class CompanyController {
    // Tampilkan form pengaturan perusahaan
    static async showSettings(req, res) {
        try {
            // Selalu ambil pengaturan utama (ID=1) atau yang terbaru jika ID=1 tidak ada
            const [companySettings] = await pool_1.databasePool.query('SELECT * FROM company_settings ORDER BY CASE WHEN id = 1 THEN 0 ELSE 1 END, updated_at DESC LIMIT 1');
            res.render('settings/company', {
                title: 'Pengaturan Perusahaan',
                company: companySettings[0] || null,
                success: req.flash('success'),
                error: req.flash('error')
            });
        }
        catch (error) {
            console.error('Error loading company settings:', error);
            req.flash('error', 'Gagal memuat pengaturan perusahaan');
            res.redirect('/dashboard');
        }
    }
    // Simpan pengaturan perusahaan
    static async saveSettings(req, res) {
        try {
            console.log('[DEBUG] saveSettings body keys:', Object.keys(req.body));
            const { company_name, company_address, company_phone, company_email, company_website, template_header, template_footer, font_size, paper_size, orientation, logo_url: manual_logo_url, qris_image_url: manual_qris_url, vpn_username, vpn_password, vpn_server_ip, bank_name, bank_account_number, bank_account_name } = req.body;
            let final_logo_url = manual_logo_url;
            let final_qris_url = manual_qris_url;
            // Handle File Uploads
            const files = req.files;
            if (files) {
                if (files['company_logo'] && files['company_logo'][0]) {
                    final_logo_url = `/uploads/company/${files['company_logo'][0].filename}`;
                }
                if (files['qris_image'] && files['qris_image'][0]) {
                    final_qris_url = `/uploads/company/${files['qris_image'][0].filename}`;
                }
            }
            // Cek apakah data sudah ada (target ID 1 atau sembarang baris pertama)
            const [existing] = await pool_1.databasePool.query('SELECT id FROM company_settings LIMIT 1');
            const records = existing;
            if (records.length > 0) {
                const targetId = records[0].id;
                // Update
                await pool_1.databasePool.query(`UPDATE company_settings SET 
                     company_name = ?, company_address = ?, company_phone = ?, 
                     company_email = ?, company_website = ?, template_header = ?, 
                     template_footer = ?, font_size = ?, paper_size = ?, 
                     orientation = ?, logo_url = ?, qris_image_url = ?, 
                     vpn_username = ?, vpn_password = ?, vpn_server_ip = ?, 
                     bank_name = ?, bank_account_number = ?, bank_account_name = ?, 
                     updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`, [
                    company_name, company_address, company_phone,
                    company_email, company_website, template_header,
                    template_footer, font_size, paper_size,
                    orientation, final_logo_url, final_qris_url,
                    vpn_username, vpn_password, vpn_server_ip,
                    bank_name, bank_account_number, bank_account_name,
                    targetId
                ]);
            }
            else {
                // Insert (force ID=1 if possible or let auto_increment work)
                await pool_1.databasePool.query(`INSERT INTO company_settings (
                        id, company_name, company_address, company_phone,
                        company_email, company_website, template_header, 
                        template_footer, font_size, paper_size, orientation, logo_url, qris_image_url,
                        vpn_username, vpn_password, vpn_server_ip, bank_name, bank_account_number, bank_account_name
                    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    company_name, company_address, company_phone,
                    company_email, company_website, template_header,
                    template_footer, font_size, paper_size, orientation, final_logo_url, final_qris_url,
                    vpn_username, vpn_password, vpn_server_ip, bank_name, bank_account_number, bank_account_name
                ]);
            }
            req.flash('success', 'Pengaturan perusahaan berhasil disimpan');
            res.redirect('/settings/company');
        }
        catch (error) {
            console.error('Error saving company settings:', error);
            req.flash('error', `Gagal menyimpan: ${error instanceof Error ? error.message : 'Unknown error'}`);
            res.redirect('/settings/company');
        }
    }
    // Upload logo perusahaan
    static async uploadLogo(req, res) {
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
                await pool_1.databasePool.query('UPDATE company_settings SET logo_url = ?, updated_at = CURRENT_TIMESTAMP ORDER BY updated_at DESC LIMIT 1', [logoUrl]);
                req.flash('success', 'Logo berhasil diupload');
                res.redirect('/settings/company');
            });
        }
        catch (error) {
            console.error('Error uploading logo:', error);
            req.flash('error', 'Gagal upload logo');
            res.redirect('/settings/company');
        }
    }
    // Preview template
    static async previewTemplate(req, res) {
        try {
            const [companySettings] = await pool_1.databasePool.query('SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1');
            // Buat data dummy untuk preview
            const previewData = {
                company: companySettings[0] || {
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
            res.render('billing/tagihan-print-invoice-template', previewData);
        }
        catch (error) {
            console.error('Error previewing template:', error);
            req.flash('error', 'Gagal memuat preview template');
            res.redirect('/settings/company');
        }
    }
    // Export pengaturan
    static async exportSettings(req, res) {
        try {
            const [companySettings] = await pool_1.databasePool.query('SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1');
            const settingsData = {
                company_settings: companySettings[0] || null,
                export_date: new Date().toISOString(),
                version: '1.0'
            };
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="company-settings.json"');
            res.json(settingsData);
        }
        catch (error) {
            console.error('Error exporting settings:', error);
            req.flash('error', 'Gagal export pengaturan');
            res.redirect('/settings/company');
        }
    }
    // Import pengaturan
    static async importSettings(req, res) {
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
            await pool_1.databasePool.query(`INSERT INTO company_settings (
                    company_name, company_address, company_phone, 
                    company_email, company_website, template_header, 
                    template_footer, font_size, paper_size, orientation, logo_url,
                    vpn_username, vpn_password, vpn_server_ip, bank_name, bank_account_number, bank_account_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    vpn_username = VALUES(vpn_username),
                    vpn_password = VALUES(vpn_password),
                    vpn_server_ip = VALUES(vpn_server_ip),
                    bank_name = VALUES(bank_name),
                    bank_account_number = VALUES(bank_account_number),
                    bank_account_name = VALUES(bank_account_name),
                    updated_at = CURRENT_TIMESTAMP`, [
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
                settings.logo_url,
                settings.vpn_username,
                settings.vpn_password,
                settings.vpn_server_ip,
                settings.bank_name,
                settings.bank_account_number,
                settings.bank_account_name
            ]);
            req.flash('success', 'Pengaturan berhasil diimport');
            res.redirect('/settings/company');
        }
        catch (error) {
            console.error('Error importing settings:', error);
            req.flash('error', 'Gagal import pengaturan');
            res.redirect('/settings/company');
        }
    }
    // Reset ke pengaturan default
    static async resetToDefault(req, res) {
        try {
            await pool_1.databasePool.query(`UPDATE company_settings SET 
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
                 vpn_username = NULL,
                 vpn_password = NULL,
                 vpn_server_ip = NULL,
                 bank_name = NULL,
                 bank_account_number = NULL,
                 bank_account_name = NULL,
                 updated_at = CURRENT_TIMESTAMP
                 ORDER BY updated_at DESC LIMIT 1`);
            req.flash('success', 'Pengaturan berhasil direset ke default');
            res.redirect('/settings/company');
        }
        catch (error) {
            console.error('Error resetting settings:', error);
            req.flash('error', 'Gagal reset pengaturan');
            res.redirect('/settings/company');
        }
    }
}
exports.CompanyController = CompanyController;
//# sourceMappingURL=companyController.js.map