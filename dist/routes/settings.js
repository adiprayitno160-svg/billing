"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const companyController_1 = require("../controllers/settings/companyController");
const SystemSettingsController_1 = require("../controllers/settings/SystemSettingsController");
const SystemUpdateController_1 = require("../controllers/settings/SystemUpdateController");
const AISettingsController_1 = require("../controllers/settings/AISettingsController");
const WhatsAppSettingsController_1 = require("../controllers/settings/WhatsAppSettingsController");
const CustomerTierController_1 = __importDefault(require("../controllers/settings/CustomerTierController"));
const SLAContractController_1 = __importDefault(require("../controllers/settings/SLAContractController"));
const PaymentReminderController_1 = __importDefault(require("../controllers/settings/PaymentReminderController"));
const TaxCalculationController_1 = __importDefault(require("../controllers/settings/TaxCalculationController"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Konfigurasi multer untuk upload file perusahaan
const companyStorage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        console.log('[DEBUG-MULTER] Destination called for file:', file.fieldname);
        const uploadPath = path_1.default.join(process.cwd(), 'public/uploads/company');
        try {
            if (!fs_1.default.existsSync(uploadPath)) {
                console.log('[DEBUG-MULTER] Creating directory:', uploadPath);
                fs_1.default.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        }
        catch (err) {
            console.error('[DEBUG-MULTER] Error in destination:', err);
            cb(err, uploadPath);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const uploadCompany = (0, multer_1.default)({
    storage: companyStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});
// Konfigurasi multer untuk import settings/backup (memory storage)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});
// Routes untuk pengaturan perusahaan
router.get('/company', companyController_1.CompanyController.showSettings);
router.post('/company', uploadCompany.fields([
    { name: 'company_logo', maxCount: 1 },
    { name: 'qris_image', maxCount: 1 }
]), companyController_1.CompanyController.saveSettings);
router.post('/company/upload-logo', upload.single('company_logo'), companyController_1.CompanyController.uploadLogo);
router.get('/company/preview', companyController_1.CompanyController.previewTemplate);
router.get('/company/export', companyController_1.CompanyController.exportSettings);
router.post('/company/import', upload.single('settings_file'), companyController_1.CompanyController.importSettings);
router.post('/company/reset', companyController_1.CompanyController.resetToDefault);
// Routes untuk System Settings
router.get('/system', SystemSettingsController_1.SystemSettingsController.index);
router.post('/system', SystemSettingsController_1.SystemSettingsController.updateSettings);
router.post('/system/check-update', SystemSettingsController_1.SystemSettingsController.checkUpdate);
router.post('/system/perform-update', SystemSettingsController_1.SystemSettingsController.performUpdate);
router.post('/system/send-finance-report', SystemSettingsController_1.SystemSettingsController.sendTestMonthlyReport);
// Routes untuk System Update (Git-based)
const SystemUpdatePageController_1 = require("../controllers/settings/SystemUpdatePageController");
router.get('/system-update', SystemUpdatePageController_1.getSystemUpdatePage);
// router.get('/system-update', SystemUpdateController.showUpdatePage); // Deprecated/Replaced
router.get('/system-update/check', SystemUpdateController_1.SystemUpdateController.checkForUpdates);
router.post('/system-update/perform', SystemUpdateController_1.SystemUpdateController.performUpdate);
router.get('/system-update/history', SystemUpdateController_1.SystemUpdateController.getUpdateHistory);
router.post('/system-update/rollback', SystemUpdateController_1.SystemUpdateController.rollbackUpdate);
// Routes untuk AI Settings (Gemini API)
router.get('/ai', AISettingsController_1.AISettingsController.index);
router.post('/ai', AISettingsController_1.AISettingsController.updateSettings);
router.post('/ai/test', AISettingsController_1.AISettingsController.testAPIKey);
router.get('/ai/stats', AISettingsController_1.AISettingsController.getStatistics);
// Routes untuk WhatsApp Settings
router.get('/whatsapp', WhatsAppSettingsController_1.WhatsAppSettingsController.showSettings);
router.get('/whatsapp/status', WhatsAppSettingsController_1.WhatsAppSettingsController.getStatus);
router.post('/whatsapp/regenerate-qr', WhatsAppSettingsController_1.WhatsAppSettingsController.regenerateQR);
router.post('/whatsapp/test-send', WhatsAppSettingsController_1.WhatsAppSettingsController.testSendMessage);
router.post('/whatsapp/update-foonte', WhatsAppSettingsController_1.WhatsAppSettingsController.updateFoonteToken);
// WhatsApp Monitor - Message Log & Manual Verification
router.get('/whatsapp/monitor', WhatsAppSettingsController_1.WhatsAppSettingsController.showMonitor);
router.get('/whatsapp/messages', WhatsAppSettingsController_1.WhatsAppSettingsController.getMessages);
router.get('/whatsapp/pending-verifications', WhatsAppSettingsController_1.WhatsAppSettingsController.getPendingVerifications);
router.get('/whatsapp/verification/:id', WhatsAppSettingsController_1.WhatsAppSettingsController.getVerificationDetail);
router.get('/whatsapp/customer-invoices/:customerId', WhatsAppSettingsController_1.WhatsAppSettingsController.getCustomerInvoices);
router.post('/whatsapp/verify-payment', WhatsAppSettingsController_1.WhatsAppSettingsController.processVerification);
// Clear all WhatsApp notification queue
router.post('/whatsapp/clear-queue', async (req, res) => {
    try {
        const pool = require('../db/pool').default;
        // Count pending before delete
        const [countRows] = await pool.query("SELECT COUNT(*) as cnt FROM unified_notifications_queue WHERE status IN ('pending', 'processing', 'failed')");
        const pendingCount = countRows[0]?.cnt || 0;
        // Delete all pending/processing/failed notifications
        await pool.query("DELETE FROM unified_notifications_queue WHERE status IN ('pending', 'processing', 'failed')");
        // Also clear in-memory message queue in WhatsApp service
        try {
            const { WhatsAppService } = require('../services/whatsapp/WhatsAppService');
            const waService = WhatsAppService.getInstance();
            // Access the private queue and clear it
            if (waService.messageQueue) {
                const queueLen = waService.messageQueue.length;
                waService.messageQueue = [];
                console.log(`[WhatsApp] Cleared ${queueLen} messages from in-memory queue`);
            }
        }
        catch (e) { }
        console.log(`[Settings] Cleared ${pendingCount} notifications from queue`);
        res.json({ success: true, message: `Berhasil menghapus ${pendingCount} antrian notifikasi WhatsApp` });
    }
    catch (error) {
        console.error('[Settings] Error clearing queue:', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal menghapus antrian' });
    }
});
// Routes untuk Backup & Restore
const backupController_1 = require("../controllers/backupController");
router.get('/backup', backupController_1.BackupController.index);
router.post('/backup/config', backupController_1.BackupController.saveConfig);
router.post('/backup/upload-key', upload.single('keyFile'), backupController_1.BackupController.uploadKey);
router.post('/backup/run', backupController_1.BackupController.runBackup);
router.post('/backup/run-local', backupController_1.BackupController.runLocalBackup);
router.post('/backup/run-full', backupController_1.BackupController.runFullBackup);
router.get('/backup/list', backupController_1.BackupController.listBackups);
router.get('/backup/download/:filename', backupController_1.BackupController.downloadBackup);
router.post('/backup/restore/:filename', backupController_1.BackupController.restoreBackup);
router.post('/backup/delete/:filename', backupController_1.BackupController.deleteBackup);
// Konfigurasi multer khusus untuk backup (Large file support via Disk Storage)
const backupStorage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        const tempDir = path_1.default.join(process.cwd(), 'storage', 'temp');
        if (!fs_1.default.existsSync(tempDir))
            fs_1.default.mkdirSync(tempDir, { recursive: true });
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'upload-restore-' + Date.now() + '.sql');
    }
});
const uploadBackup = (0, multer_1.default)({
    storage: backupStorage,
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1GB limit
    }
});
router.post('/backup/restore-upload', uploadBackup.single('sqlFile'), backupController_1.BackupController.restoreFromUpload);
// System Logs
const SystemLogController_1 = require("../controllers/settings/SystemLogController");
router.get('/logs', SystemLogController_1.SystemLogController.index);
router.get('/logs/api/content/:filename', SystemLogController_1.SystemLogController.getLogContent);
// UI Pages for Billing/SLA Management (render views)
router.get('/customer-tiers', (req, res) => {
    const { getCustomerTierManagement } = require('../controllers/settingsController');
    getCustomerTierManagement(req, res);
});
router.get('/sla-contracts', (req, res) => {
    const { getSLAContractManagement } = require('../controllers/settingsController');
    getSLAContractManagement(req, res);
});
router.get('/payment-reminders', (req, res) => {
    const { getPaymentReminderManagement } = require('../controllers/settingsController');
    getPaymentReminderManagement(req, res);
});
router.get('/tax-calculations', (req, res) => {
    const { getTaxCalculationManagement } = require('../controllers/settingsController');
    getTaxCalculationManagement(req, res);
});
router.get('/credit-score', (req, res) => {
    const { getCreditScoreManagement } = require('../controllers/settingsController');
    getCreditScoreManagement(req, res);
});
router.get('/integrations', (req, res) => {
    const { getIntegrationSettings } = require('../controllers/settingsController');
    getIntegrationSettings(req, res);
});
router.get('/sla-contracts/:id/print', (req, res) => {
    const { printSLAContract } = require('../controllers/settingsController');
    printSLAContract(req, res);
});
// API Routes for Customer Tier Management
router.get('/api/customer-tiers', CustomerTierController_1.default.getAllTiers);
router.get('/api/customer-tiers/:id', CustomerTierController_1.default.getTierById);
router.post('/api/customer-tiers', CustomerTierController_1.default.createTier);
router.put('/api/customer-tiers/:id', CustomerTierController_1.default.updateTier);
router.delete('/api/customer-tiers/:id', CustomerTierController_1.default.deleteTier);
// API Routes for SLA Contract Management
router.get('/api/sla-contracts', SLAContractController_1.default.getAllContracts);
router.get('/api/sla-contracts/:id', SLAContractController_1.default.getContractById);
router.get('/api/sla-contracts/customer/:customerId', SLAContractController_1.default.getContractsByCustomerId);
router.get('/api/sla-contracts/active', SLAContractController_1.default.getActiveContracts);
router.post('/api/sla-contracts', SLAContractController_1.default.createContract);
router.put('/api/sla-contracts/:id', SLAContractController_1.default.updateContract);
router.patch('/api/sla-contracts/:id/status', SLAContractController_1.default.updateContractStatus);
router.get('/api/sla-contracts/customer/:customerId/has-active', SLAContractController_1.default.hasActiveContract);
router.get('/api/sla-contracts/customer/:customerId/sla-target', SLAContractController_1.default.getCurrentSLATarget);
router.get('/api/sla-contracts/expiring', SLAContractController_1.default.getExpiringContracts);
router.get('/api/sla-contracts/expired', SLAContractController_1.default.getExpiredContracts);
router.get('/api/sla-contracts/by-number/:contractNumber', SLAContractController_1.default.getContractByNumber);
// API Routes for Payment Reminder Management
router.get('/api/payment-reminders', PaymentReminderController_1.default.getAllReminders);
router.get('/api/payment-reminders/customer/:customerId', PaymentReminderController_1.default.getRemindersByCustomerId);
router.get('/api/payment-reminders/invoice/:invoiceId', PaymentReminderController_1.default.getRemindersByInvoiceId);
router.get('/api/payment-reminders/pending', PaymentReminderController_1.default.getPendingReminders);
router.patch('/api/payment-reminders/:id/status', PaymentReminderController_1.default.updateReminderStatus);
router.get('/api/payment-reminders/overdue-invoices', PaymentReminderController_1.default.getOverdueInvoicesForReminders);
router.post('/api/payment-reminders/send', PaymentReminderController_1.default.sendPaymentReminders);
router.get('/api/payment-reminders/counts-by-level', PaymentReminderController_1.default.getReminderCountsByLevel);
router.get('/api/payment-reminders/recent', PaymentReminderController_1.default.getRecentReminders);
router.get('/api/payment-reminders/stats', PaymentReminderController_1.default.getReminderStats);
router.post('/api/payment-reminders', PaymentReminderController_1.default.createReminder);
// API Routes for Tax Calculation Management
router.get('/api/tax-calculations', TaxCalculationController_1.default.getAllTaxCalculations);
router.post('/api/tax-calculations/calculate', TaxCalculationController_1.default.calculateTax);
router.get('/api/tax-calculations/transaction/:transactionId/type/:transactionType', TaxCalculationController_1.default.getTaxCalculation);
router.get('/api/tax-calculations/transaction/:transactionId', TaxCalculationController_1.default.getTaxCalculationsForTransaction);
router.get('/api/tax-calculations/summary', TaxCalculationController_1.default.getTaxSummary);
router.get('/api/tax-calculations/invoice/:invoiceId', TaxCalculationController_1.default.calculateInvoiceTax);
router.post('/api/tax-calculations/invoice/:invoiceId/process', TaxCalculationController_1.default.processInvoiceTax);
router.get('/api/tax-calculations/monthly-report', TaxCalculationController_1.default.getMonthlyTaxReport);
router.get('/api/tax-calculations/type/:type', TaxCalculationController_1.default.getTaxCalculationsByType);
exports.default = router;
//# sourceMappingURL=settings.js.map