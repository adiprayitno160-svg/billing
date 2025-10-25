import { Router, Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { WhatsAppBotService } from '../services/whatsapp/WhatsAppBotService';

const router = Router();

// Get bot statistics
router.get('/bot-statistics', async (req: Request, res: Response) => {
    try {
        const conn = await databasePool.getConnection();
        
        try {
            // Get messages today
            const [todayMessages] = await conn.query(`
                SELECT COUNT(*) as count 
                FROM whatsapp_bot_conversations 
                WHERE DATE(created_at) = CURDATE()
            `) as any;
            
            // Get auto responses today
            const [autoResponses] = await conn.query(`
                SELECT COUNT(*) as count 
                FROM whatsapp_bot_conversations 
                WHERE DATE(created_at) = CURDATE() AND outgoing_message IS NOT NULL
            `) as any;
            
            // Get notifications sent today
            const [notifications] = await conn.query(`
                SELECT COUNT(*) as count 
                FROM whatsapp_notification_logs 
                WHERE DATE(sent_at) = CURDATE() AND status = 'sent'
            `) as any;
            
            // Calculate success rate
            const [total] = await conn.query(`
                SELECT COUNT(*) as count 
                FROM whatsapp_notification_logs 
                WHERE DATE(sent_at) = CURDATE()
            `) as any;
            
            const [success] = await conn.query(`
                SELECT COUNT(*) as count 
                FROM whatsapp_notification_logs 
                WHERE DATE(sent_at) = CURDATE() AND status = 'sent'
            `) as any;
            
            const successRate = total[0].count > 0 
                ? Math.round((success[0].count / total[0].count) * 100) 
                : 100;
            
            res.json({
                messagesToday: todayMessages[0].count,
                autoResponses: autoResponses[0].count,
                notificationsSent: notifications[0].count,
                successRate
            });
        } finally {
            conn.release();
        }
    } catch (error: any) {
        console.error('Error fetching bot statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent conversations
router.get('/recent-conversations', async (req: Request, res: Response) => {
    try {
        const conn = await databasePool.getConnection();
        
        try {
            const [conversations] = await conn.query(`
                SELECT * FROM whatsapp_bot_conversations 
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            res.json(conversations);
        } finally {
            conn.release();
        }
    } catch (error: any) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test bot with message
router.post('/test-bot', async (req: Request, res: Response) => {
    try {
        const { from, message } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }
        
        const response = await WhatsAppBotService.handleIncomingMessage(
            from || '6281234567890',
            message,
            'test_' + Date.now()
        );
        
        res.json({
            success: true,
            response: response || 'No response generated'
        });
    } catch (error: any) {
        console.error('Error testing bot:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
