import { Router } from 'express';
import { CompanyController } from '../controllers/settings/companyController';
import { SystemSettingsController } from '../controllers/settings/SystemSettingsController';
import { SystemUpdateController } from '../controllers/settings/SystemUpdateController';
import { AISettingsController } from '../controllers/settings/AISettingsController';
import { WhatsAppSettingsController } from '../controllers/settings/WhatsAppSettingsController';
import CustomerTierController from '../controllers/settings/CustomerTierController';
import SLAContractController from '../controllers/settings/SLAContractController';
import PaymentReminderController from '../controllers/settings/PaymentReminderController';
import TaxCalculationController from '../controllers/settings/TaxCalculationController';
import multer from 'multer';

const router = Router();

// Konfigurasi multer untuk import settings
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Routes untuk pengaturan perusahaan
router.get('/company', CompanyController.showSettings);
router.post('/company', upload.fields([
  { name: 'company_logo', maxCount: 1 },
  { name: 'qris_image', maxCount: 1 }
]), CompanyController.saveSettings);
router.post('/company/upload-logo', upload.single('company_logo'), CompanyController.uploadLogo);
router.get('/company/preview', CompanyController.previewTemplate);
router.get('/company/export', CompanyController.exportSettings);
router.post('/company/import', upload.single('settings_file'), CompanyController.importSettings);
router.post('/company/reset', CompanyController.resetToDefault);

// Routes untuk System Settings
router.get('/system', SystemSettingsController.index);
router.post('/system', SystemSettingsController.updateSettings);
router.post('/system/check-update', SystemSettingsController.checkUpdate);
router.post('/system/perform-update', SystemSettingsController.performUpdate);

// Routes untuk System Update (Git-based)
router.get('/system-update', SystemUpdateController.showUpdatePage);
router.get('/system-update/check', SystemUpdateController.checkForUpdates);
router.post('/system-update/perform', SystemUpdateController.performUpdate);
router.get('/system-update/history', SystemUpdateController.getUpdateHistory);
router.post('/system-update/rollback', SystemUpdateController.rollbackUpdate);

// Routes untuk AI Settings (Gemini API)
router.get('/ai', AISettingsController.index);
router.post('/ai', AISettingsController.updateSettings);
router.post('/ai/test', AISettingsController.testAPIKey);
router.get('/ai/stats', AISettingsController.getStatistics);

// Routes untuk WhatsApp Settings
router.get('/whatsapp', WhatsAppSettingsController.showSettings);
router.get('/whatsapp/status', WhatsAppSettingsController.getStatus);
router.post('/whatsapp/regenerate-qr', WhatsAppSettingsController.regenerateQR);
router.post('/whatsapp/test-send', WhatsAppSettingsController.testSendMessage);
router.post('/whatsapp/update-foonte', WhatsAppSettingsController.updateFoonteToken);

// WhatsApp Monitor - Message Log & Manual Verification
router.get('/whatsapp/monitor', WhatsAppSettingsController.showMonitor);
router.get('/whatsapp/messages', WhatsAppSettingsController.getMessages);
router.get('/whatsapp/pending-verifications', WhatsAppSettingsController.getPendingVerifications);
router.get('/whatsapp/verification/:id', WhatsAppSettingsController.getVerificationDetail);
router.get('/whatsapp/customer-invoices/:customerId', WhatsAppSettingsController.getCustomerInvoices);
router.post('/whatsapp/verify-payment', WhatsAppSettingsController.processVerification);

// Routes untuk Backup & Restore
import { BackupController } from '../controllers/backupController';
router.get('/backup', BackupController.index);
router.post('/backup/config', BackupController.saveConfig);
router.post('/backup/upload-key', upload.single('keyFile'), BackupController.uploadKey);
router.post('/backup/run', BackupController.runBackup);
router.post('/backup/run-local', BackupController.runLocalBackup);
router.get('/backup/list', BackupController.listBackups);
router.get('/backup/download/:filename', BackupController.downloadBackup);
router.post('/backup/restore/:filename', BackupController.restoreBackup);
router.post('/backup/delete/:filename', BackupController.deleteBackup);
// Konfigurasi multer khusus untuk backup (Large file support via Disk Storage)
import fs from 'fs';
import path from 'path';
const backupStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(process.cwd(), 'storage', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'upload-restore-' + Date.now() + '.sql');
  }
});

const uploadBackup = multer({
  storage: backupStorage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit
  }
});

router.post('/backup/restore-upload', uploadBackup.single('sqlFile'), BackupController.restoreFromUpload);

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
router.get('/api/customer-tiers', CustomerTierController.getAllTiers);
router.get('/api/customer-tiers/:id', CustomerTierController.getTierById);
router.post('/api/customer-tiers', CustomerTierController.createTier);
router.put('/api/customer-tiers/:id', CustomerTierController.updateTier);
router.delete('/api/customer-tiers/:id', CustomerTierController.deleteTier);

// API Routes for SLA Contract Management
router.get('/api/sla-contracts', SLAContractController.getAllContracts);
router.get('/api/sla-contracts/:id', SLAContractController.getContractById);
router.get('/api/sla-contracts/customer/:customerId', SLAContractController.getContractsByCustomerId);
router.get('/api/sla-contracts/active', SLAContractController.getActiveContracts);
router.post('/api/sla-contracts', SLAContractController.createContract);
router.put('/api/sla-contracts/:id', SLAContractController.updateContract);
router.patch('/api/sla-contracts/:id/status', SLAContractController.updateContractStatus);
router.get('/api/sla-contracts/customer/:customerId/has-active', SLAContractController.hasActiveContract);
router.get('/api/sla-contracts/customer/:customerId/sla-target', SLAContractController.getCurrentSLATarget);
router.get('/api/sla-contracts/expiring', SLAContractController.getExpiringContracts);
router.get('/api/sla-contracts/expired', SLAContractController.getExpiredContracts);
router.get('/api/sla-contracts/by-number/:contractNumber', SLAContractController.getContractByNumber);

// API Routes for Payment Reminder Management
router.get('/api/payment-reminders', PaymentReminderController.getAllReminders);
router.get('/api/payment-reminders/customer/:customerId', PaymentReminderController.getRemindersByCustomerId);
router.get('/api/payment-reminders/invoice/:invoiceId', PaymentReminderController.getRemindersByInvoiceId);
router.get('/api/payment-reminders/pending', PaymentReminderController.getPendingReminders);
router.patch('/api/payment-reminders/:id/status', PaymentReminderController.updateReminderStatus);
router.get('/api/payment-reminders/overdue-invoices', PaymentReminderController.getOverdueInvoicesForReminders);
router.post('/api/payment-reminders/send', PaymentReminderController.sendPaymentReminders);
router.get('/api/payment-reminders/counts-by-level', PaymentReminderController.getReminderCountsByLevel);
router.get('/api/payment-reminders/recent', PaymentReminderController.getRecentReminders);
router.get('/api/payment-reminders/stats', PaymentReminderController.getReminderStats);
router.post('/api/payment-reminders', PaymentReminderController.createReminder);

// API Routes for Tax Calculation Management
router.get('/api/tax-calculations', TaxCalculationController.getAllTaxCalculations);
router.post('/api/tax-calculations/calculate', TaxCalculationController.calculateTax);
router.get('/api/tax-calculations/transaction/:transactionId/type/:transactionType', TaxCalculationController.getTaxCalculation);
router.get('/api/tax-calculations/transaction/:transactionId', TaxCalculationController.getTaxCalculationsForTransaction);
router.get('/api/tax-calculations/summary', TaxCalculationController.getTaxSummary);
router.get('/api/tax-calculations/invoice/:invoiceId', TaxCalculationController.calculateInvoiceTax);
router.post('/api/tax-calculations/invoice/:invoiceId/process', TaxCalculationController.processInvoiceTax);
router.get('/api/tax-calculations/monthly-report', TaxCalculationController.getMonthlyTaxReport);
router.get('/api/tax-calculations/type/:type', TaxCalculationController.getTaxCalculationsByType);


export default router;
