import { Router } from 'express';
import { CompanyController } from '../controllers/settings/companyController';
import { TelegramSettingsController } from '../controllers/settings/TelegramSettingsController';
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

// Routes untuk pengaturan Telegram Bot
router.get('/telegram', TelegramSettingsController.showSettings);
router.post('/telegram', TelegramSettingsController.saveSettings);
router.post('/telegram/test', TelegramSettingsController.testConnection);
router.post('/telegram/restart', TelegramSettingsController.restartBot);

export default router;
