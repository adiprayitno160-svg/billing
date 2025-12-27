"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppBusinessController = void 0;
const WhatsAppBusinessService_1 = require("../../services/whatsapp/WhatsAppBusinessService");
class WhatsAppBusinessController {
    /**
     * Dashboard/Index page
     */
    async getDashboard(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const status = service.getStatus();
            let history = [];
            try {
                history = await service.getHistory(10);
            }
            catch (historyError) {
                console.error('Error getting history:', historyError);
                // Continue with empty history
            }
            res.render('whatsapp/dashboard', {
                title: 'WhatsApp Business - Dashboard',
                currentPath: req.path,
                status,
                history
            });
        }
        catch (error) {
            console.error('Error in getDashboard:', error);
            res.status(500).render('error', {
                title: 'Error',
                status: 500,
                message: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Binding page (QR Code)
     */
    async getBinding(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const status = service.getStatus();
            const qrCode = service.getQRCode();
            // Check if this is an API request (JSON expected)
            const acceptsJson = req.headers.accept?.includes('application/json') ||
                req.headers['content-type']?.includes('application/json');
            if (acceptsJson) {
                return res.json({
                    success: true,
                    status,
                    qrCode
                });
            }
            res.render('whatsapp/binding', {
                title: 'WhatsApp Business - Binding',
                currentPath: req.path,
                status,
                qrCode
            });
        }
        catch (error) {
            console.error('Error in getBinding:', error);
            // Check if this is an API request
            const acceptsJson = req.headers.accept?.includes('application/json') ||
                req.headers['content-type']?.includes('application/json');
            if (acceptsJson) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Internal server error'
                });
            }
            res.status(500).render('error', {
                title: 'Error',
                status: 500,
                message: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Get status (API)
     */
    async getStatus(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const status = service.getStatus();
            res.json({
                success: true,
                status
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Get QR Code (API)
     */
    async getQRCode(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const qrCode = service.getQRCode();
            if (qrCode) {
                res.json({
                    success: true,
                    qrCode
                });
            }
            else {
                res.json({
                    success: false,
                    message: 'QR Code not available. Please start the WhatsApp client first.'
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Start WhatsApp client
     */
    async start(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            await service.start();
            res.json({
                success: true,
                message: 'WhatsApp client started'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to start WhatsApp client'
            });
        }
    }
    /**
     * Stop WhatsApp client
     */
    async stop(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            await service.stop();
            res.json({
                success: true,
                message: 'WhatsApp client stopped'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to stop WhatsApp client'
            });
        }
    }
    /**
     * Restart WhatsApp client
     */
    async restart(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            await service.restart();
            res.json({
                success: true,
                message: 'WhatsApp client restarted'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to restart WhatsApp client'
            });
        }
    }
    /**
     * Send message to phone number
     */
    async sendToPhone(req, res) {
        try {
            const { phone, message } = req.body;
            if (!phone || !message) {
                res.status(400).json({
                    success: false,
                    error: 'Phone and message are required'
                });
                return;
            }
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const result = await service.sendMessage(phone, message);
            if (result.success) {
                res.json({
                    success: true,
                    messageId: result.messageId,
                    message: 'Message sent successfully'
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to send message'
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Send message to customer by ID
     */
    async sendToCustomer(req, res) {
        try {
            const { customerId } = req.params;
            const { message } = req.body;
            if (!message) {
                res.status(400).json({
                    success: false,
                    error: 'Message is required'
                });
                return;
            }
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const result = await service.sendToCustomer(parseInt(customerId), message);
            if (result.success) {
                res.json({
                    success: true,
                    messageId: result.messageId,
                    message: 'Message sent successfully'
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to send message'
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Send message to multiple customers
     */
    async sendToMultiple(req, res) {
        try {
            const { customerIds, message } = req.body;
            if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'customerIds array is required'
                });
                return;
            }
            if (!message) {
                res.status(400).json({
                    success: false,
                    error: 'Message is required'
                });
                return;
            }
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const result = await service.sendToMultiple(customerIds, message);
            res.json({
                success: true,
                ...result,
                message: `Sent to ${result.success} customers, ${result.failed} failed`
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Get notification history
     */
    async getHistory(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const history = await service.getHistory(limit, offset);
            res.json({
                success: true,
                history
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Check phone number
     */
    async checkNumber(req, res) {
        try {
            const { phone } = req.query;
            if (!phone) {
                res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
                return;
            }
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const result = await service.checkNumber(phone);
            res.json({
                success: true,
                ...result
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
    /**
     * Diagnostic endpoint
     */
    async getDiagnostic(req, res) {
        try {
            const service = (0, WhatsAppBusinessService_1.getWhatsAppBusinessService)();
            const status = service.getStatus();
            const qrCode = service.getQRCode();
            const phone = req.query.phone;
            let numberCheck = null;
            if (phone) {
                numberCheck = await service.checkNumber(phone);
            }
            res.json({
                success: true,
                status,
                qrCode: qrCode ? 'Available' : 'Not available',
                numberCheck
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
}
exports.WhatsAppBusinessController = WhatsAppBusinessController;
//# sourceMappingURL=WhatsAppBusinessController.js.map