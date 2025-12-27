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
            const [companySettings] = await pool_1.databasePool.query('SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1');
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
            const { company_name, company_address, company_phone, company_email, company_website, template_header, template_footer, font_size, paper_size, orientation, logo_url } = req.body;
            // Cek apakah sudah ada pengaturan
            const [existingSettings] = await pool_1.databasePool.query('SELECT id FROM company_settings ORDER BY updated_at DESC LIMIT 1');
            if (existingSettings.length > 0) {
                // Update pengaturan yang sudah ada
                await pool_1.databasePool.query(`UPDATE company_settings SET 
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
                     WHERE id = ?`, [
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
                    existingSettings[0].id
                ]);
            }
            else {
                // Insert pengaturan baru
                await pool_1.databasePool.query(`INSERT INTO company_settings (
                        company_name, company_address, company_phone, 
                        company_email, company_website, template_header, 
                        template_footer, font_size, paper_size, orientation, logo_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ]);
            }
            req.flash('success', 'Pengaturan perusahaan berhasil disimpan');
            res.redirect('/settings/company');
        }
        catch (error) {
            console.error('Error saving company settings:', error);
            req.flash('error', 'Gagal menyimpan pengaturan perusahaan');
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
                settings.logo_url
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