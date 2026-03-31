/**
 * AI Settings Controller
 * Manage AI (Gemini) configuration for payment auto-approval
 */

import { Request, Response } from 'express';
import { AISettingsService } from '../../services/payment/AISettingsService';

export class AISettingsController {
    /**
     * Show AI settings page
     */
    static async index(req: Request, res: Response): Promise<void> {
        try {
            const settings = await AISettingsService.getSettings();

            res.render('settings/ai', {
                title: 'Pengaturan AI Pembayaran',
                currentPath: '/settings/ai',
                settings: settings || {
                    api_key: '',
                    model: 'gemini-flash-latest',
                    enabled: false,
                    auto_approve_enabled: true,
                    min_confidence: 70,
                    risk_threshold: 'medium',
                    max_age_days: 7
                },
                success: req.query.success || null,
                error: req.query.error || null
            });
        } catch (error) {
            console.error('AI settings page error:', error);
            res.status(500).render('error', {
                error: 'Gagal memuat pengaturan AI',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Update AI settings
     */
    static async updateSettings(req: Request, res: Response): Promise<void> {
        try {
            const {
                api_key,
                model,
                enabled,
                auto_approve_enabled,
                min_confidence,
                risk_threshold,
                max_age_days
            } = req.body;

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
            // Update settings
            await AISettingsService.updateSettings({
                api_key: api_key.trim(),
                model: model || 'gemini-flash-latest',
                enabled: enabled === '1' || enabled === true,
                auto_approve_enabled: auto_approve_enabled === '1' || auto_approve_enabled === true,
                min_confidence: parseInt(min_confidence) || 70,
                risk_threshold: (risk_threshold || 'medium') as 'low' | 'medium' | 'high',
                max_age_days: parseInt(max_age_days) || 7
            });

            // Reset Gemini model to reload with new settings
            const { GeminiService } = await import('../../services/payment/GeminiService');
            GeminiService.resetModel();

            res.redirect('/settings/ai?success=' + encodeURIComponent('Pengaturan AI berhasil diperbarui'));
        } catch (error: any) {
            console.error('Error updating AI settings:', error);
            res.redirect('/settings/ai?error=' + encodeURIComponent(error.message || 'Terjadi kesalahan saat memperbarui pengaturan'));
        }
    }

    /**
     * Test API key
     */
    static async testAPIKey(req: Request, res: Response): Promise<void> {
        try {
            const { api_key } = req.body;

            if (!api_key || api_key.trim() === '') {
                res.json({
                    success: false,
                    message: 'API Key tidak boleh kosong'
                });
            }

            const result = await AISettingsService.testAPIKey(api_key.trim());

            res.json(result);
        } catch (error: any) {
            console.error('Error testing API key:', error);
            res.json({
                success: false,
                message: error.message || 'Gagal menguji API key'
            });
        }
    }

    /**
     * Get AI verification statistics
     */
    static async getStatistics(req: Request, res: Response): Promise<void> {
        try {
            const { AdvancedPaymentVerificationService } = await import('../../services/ai/AdvancedPaymentVerificationService');
            const stats = await AdvancedPaymentVerificationService.getVerificationStatistics();

            res.json({
                success: true,
                data: stats
            });
        } catch (error: any) {
            console.error('Error getting AI stats:', error);
            res.json({
                success: false,
                message: error.message || 'Gagal memuat statistik AI',
                data: {
                    total: 0,
                    autoApproved: 0,
                    manualReview: 0,
                    rejected: 0,
                    avgConfidence: 0,
                    avgProcessingTime: 0
                }
            });
        }
    }
}

