"use strict";
/**
 * AI Settings Controller
 * Manage AI (Gemini) configuration for payment auto-approval
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISettingsController = void 0;
const AISettingsService_1 = require("../../services/payment/AISettingsService");
class AISettingsController {
    /**
     * Show AI settings page
     */
    static async index(req, res) {
        try {
            const settings = await AISettingsService_1.AISettingsService.getSettings();
            res.render('settings/ai', {
                title: 'Pengaturan AI Pembayaran',
                currentPath: '/settings/ai',
                settings: settings || {
                    api_key: '',
                    model: 'gemini-1.5-pro',
                    enabled: false,
                    auto_approve_enabled: true,
                    min_confidence: 70,
                    risk_threshold: 'medium',
                    max_age_days: 7
                },
                success: req.query.success || null,
                error: req.query.error || null
            });
        }
        catch (error) {
            console.error('AI settings page error:', error);
            res.status(500).render('error', {
                error: 'Gagal memuat pengaturan AI',
                user: req.session.user
            });
        }
    }
    /**
     * Update AI settings
     */
    static async updateSettings(req, res) {
        try {
            const { api_key, model, enabled, auto_approve_enabled, min_confidence, risk_threshold, max_age_days } = req.body;
            // Validate
            if (!api_key || api_key.trim() === '') {
                return res.redirect('/settings/ai?error=' + encodeURIComponent('API Key tidak boleh kosong'));
            }
            if (min_confidence && (min_confidence < 0 || min_confidence > 100)) {
                return res.redirect('/settings/ai?error=' + encodeURIComponent('Min confidence harus antara 0-100'));
            }
            if (max_age_days && (max_age_days < 1 || max_age_days > 30)) {
                return res.redirect('/settings/ai?error=' + encodeURIComponent('Max age days harus antara 1-30'));
            }
            // Update settings
            const success = await AISettingsService_1.AISettingsService.updateSettings({
                api_key: api_key.trim(),
                model: model || 'gemini-1.5-pro',
                enabled: enabled === '1' || enabled === true,
                auto_approve_enabled: auto_approve_enabled === '1' || auto_approve_enabled === true,
                min_confidence: parseInt(min_confidence) || 70,
                risk_threshold: (risk_threshold || 'medium'),
                max_age_days: parseInt(max_age_days) || 7
            });
            if (success) {
                // Reset Gemini model to reload with new settings
                const { GeminiService } = await Promise.resolve().then(() => __importStar(require('../../services/payment/GeminiService')));
                GeminiService.resetModel();
                res.redirect('/settings/ai?success=' + encodeURIComponent('Pengaturan AI berhasil diperbarui'));
            }
            else {
                res.redirect('/settings/ai?error=' + encodeURIComponent('Gagal memperbarui pengaturan AI'));
            }
        }
        catch (error) {
            console.error('Error updating AI settings:', error);
            res.redirect('/settings/ai?error=' + encodeURIComponent('Terjadi kesalahan saat memperbarui pengaturan'));
        }
    }
    /**
     * Test API key
     */
    static async testAPIKey(req, res) {
        try {
            const { api_key } = req.body;
            if (!api_key || api_key.trim() === '') {
                res.json({
                    success: false,
                    message: 'API Key tidak boleh kosong'
                });
            }
            const result = await AISettingsService_1.AISettingsService.testAPIKey(api_key.trim());
            res.json(result);
        }
        catch (error) {
            console.error('Error testing API key:', error);
            res.json({
                success: false,
                message: error.message || 'Gagal menguji API key'
            });
        }
    }
}
exports.AISettingsController = AISettingsController;
//# sourceMappingURL=AISettingsController.js.map