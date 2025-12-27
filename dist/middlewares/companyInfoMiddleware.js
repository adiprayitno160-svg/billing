"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyInfoMiddleware = companyInfoMiddleware;
const pool_1 = require("../db/pool");
/**
 * Middleware untuk menyediakan informasi perusahaan di semua view
 * Data company settings akan tersedia sebagai companyInfo di semua EJS templates
 */
async function companyInfoMiddleware(req, res, next) {
    try {
        // Query company settings dari database
        const [companySettings] = await pool_1.databasePool.query('SELECT * FROM company_settings ORDER BY updated_at DESC LIMIT 1');
        // Set companyInfo di res.locals agar tersedia di semua view
        const company = companySettings[0] || null;
        res.locals.companyInfo = company;
        // Set default values jika tidak ada data
        if (!company) {
            res.locals.companyInfo = {
                company_name: 'Billing System',
                company_address: null,
                company_phone: null,
                company_email: null,
                company_website: null,
                logo_url: null,
                template_header: null,
                template_footer: null,
                font_size: '14',
                paper_size: 'A4',
                orientation: 'portrait'
            };
        }
        next();
    }
    catch (error) {
        console.error('Error loading company info:', error);
        // Set default values jika terjadi error
        res.locals.companyInfo = {
            company_name: 'Billing System',
            company_address: null,
            company_phone: null,
            company_email: null,
            company_website: null,
            logo_url: null,
            template_header: null,
            template_footer: null,
            font_size: '14',
            paper_size: 'A4',
            orientation: 'portrait'
        };
        next();
    }
}
//# sourceMappingURL=companyInfoMiddleware.js.map