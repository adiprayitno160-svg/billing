import { Router } from 'express';
import { CompanyController } from '../controllers/settings/companyController';
import { SystemSettingsController } from '../controllers/settings/SystemSettingsController';
import { SystemUpdateController } from '../controllers/settings/SystemUpdateController';
import { AISettingsController } from '../controllers/settings/AISettingsController';
import { WhatsAppSettingsController } from '../controllers/settings/WhatsAppSettingsController';
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

export default router;
