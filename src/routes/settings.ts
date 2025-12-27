import { Router } from 'express';
import { CompanyController } from '../controllers/settings/companyController';
import { SystemSettingsController } from '../controllers/settings/SystemSettingsController';
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
router.post('/company', upload.single('company_logo'), CompanyController.saveSettings);
router.post('/company/upload-logo', upload.single('company_logo'), CompanyController.uploadLogo);
router.get('/company/preview', CompanyController.previewTemplate);
router.get('/company/export', CompanyController.exportSettings);
router.post('/company/import', upload.single('settings_file'), CompanyController.importSettings);
router.post('/company/reset', CompanyController.resetToDefault);

// Routes untuk System Settings
router.get('/system', SystemSettingsController.index);
router.post('/system', SystemSettingsController.updateSettings);

// Routes untuk AI Settings (Gemini API)
router.get('/ai', AISettingsController.index);
router.post('/ai', AISettingsController.updateSettings);
router.post('/ai/test', AISettingsController.testAPIKey);

// Routes untuk WhatsApp Settings
router.get('/whatsapp', WhatsAppSettingsController.showSettings);
router.get('/whatsapp/status', WhatsAppSettingsController.getStatus);
router.post('/whatsapp/regenerate-qr', WhatsAppSettingsController.regenerateQR);
router.post('/whatsapp/test-send', WhatsAppSettingsController.testSendMessage);

export default router;
