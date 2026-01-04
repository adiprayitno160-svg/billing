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

// Routes untuk WhatsApp Settings
router.get('/whatsapp', WhatsAppSettingsController.showSettings);
router.get('/whatsapp/status', WhatsAppSettingsController.getStatus);
router.post('/whatsapp/regenerate-qr', WhatsAppSettingsController.regenerateQR);
router.post('/whatsapp/test-send', WhatsAppSettingsController.testSendMessage);

// Routes untuk Backup & Restore
import { BackupController } from '../controllers/backupController';
router.get('/backup', BackupController.index);
router.post('/backup/config', BackupController.saveConfig);
router.post('/backup/upload-key', upload.single('keyFile'), BackupController.uploadKey);
router.post('/backup/run', BackupController.runBackup);

export default router;
