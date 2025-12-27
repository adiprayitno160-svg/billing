"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const companyController_1 = require("../controllers/settings/companyController");
const SystemSettingsController_1 = require("../controllers/settings/SystemSettingsController");
const AISettingsController_1 = require("../controllers/settings/AISettingsController");
const WhatsAppSettingsController_1 = require("../controllers/settings/WhatsAppSettingsController");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Konfigurasi multer untuk import settings
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});
// Routes untuk pengaturan perusahaan
router.get('/company', companyController_1.CompanyController.showSettings);
router.post('/company', upload.single('company_logo'), companyController_1.CompanyController.saveSettings);
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
// Routes untuk AI Settings (Gemini API)
router.get('/ai', AISettingsController_1.AISettingsController.index);
router.post('/ai', AISettingsController_1.AISettingsController.updateSettings);
router.post('/ai/test', AISettingsController_1.AISettingsController.testAPIKey);
// Routes untuk WhatsApp Settings
router.get('/whatsapp', WhatsAppSettingsController_1.WhatsAppSettingsController.showSettings);
router.get('/whatsapp/status', WhatsAppSettingsController_1.WhatsAppSettingsController.getStatus);
router.post('/whatsapp/regenerate-qr', WhatsAppSettingsController_1.WhatsAppSettingsController.regenerateQR);
router.post('/whatsapp/test-send', WhatsAppSettingsController_1.WhatsAppSettingsController.testSendMessage);
exports.default = router;
//# sourceMappingURL=settings.js.map