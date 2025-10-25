import { databasePool } from '../../db/pool';
import { PaymentService } from './paymentService';
import { InvoiceService } from './invoiceService';

export interface WhatsAppSession {
    id: number;
    customer_id: number;
    session_id: string;
    phone_number: string;
    current_state: string;
    context_data: any;
    is_active: boolean;
    last_activity: Date;
    created_at: Date;
}

export interface WhatsAppMessage {
    id: number;
    session_id: string;
    message_type: 'incoming' | 'outgoing';
    message_content: string;
    message_data: any;
    processed: boolean;
    created_at: Date;
}

export interface AIAnalysisResult {
    analysis_type: 'transfer_proof' | 'sentiment' | 'intent' | 'fraud_detection';
    input_data: any;
    analysis_result: any;
    confidence_score: number;
    status: 'pending' | 'completed' | 'failed';
}

export class WhatsAppBotService {
    /**
     * Create or get WhatsApp session
     */
    static async createOrGetSession(customerId: number, phoneNumber: string): Promise<WhatsAppSession> {
        // Check if session exists
        const existingSessionQuery = `
            SELECT * FROM whatsapp_bot_sessions 
            WHERE customer_id = ? AND phone_number = ? AND is_active = TRUE
            ORDER BY last_activity DESC LIMIT 1
        `;
        
        const [existingResult] = await databasePool.query(existingSessionQuery, [customerId, phoneNumber]);
        
        if ((existingResult as any[]).length > 0) {
            // Update last activity
            const updateQuery = `
                UPDATE whatsapp_bot_sessions 
                SET last_activity = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            await databasePool.query(updateQuery, [(existingResult as any[])[0].id]);
            return (existingResult as any[])[0];
        }
        
        // Create new session
        const sessionId = `session_${customerId}_${Date.now()}`;
        const insertQuery = `
            INSERT INTO whatsapp_bot_sessions (customer_id, session_id, phone_number, current_state, context_data, is_active)
            VALUES (?, ?, ?, 'idle', '{}', TRUE)
        `;
        
        const [result] = await databasePool.query(insertQuery, [customerId, sessionId, phoneNumber]);
        const sessionIdResult = (result as any).insertId;
        
        return {
            id: sessionIdResult,
            customer_id: customerId,
            session_id: sessionId,
            phone_number: phoneNumber,
            current_state: 'idle',
            context_data: {},
            is_active: true,
            last_activity: new Date(),
            created_at: new Date()
        };
    }

    /**
     * Save WhatsApp message
     */
    static async saveMessage(
        sessionId: string,
        messageType: 'incoming' | 'outgoing',
        content: string,
        messageData: any = {}
    ): Promise<number> {
        const query = `
            INSERT INTO whatsapp_bot_messages (session_id, message_type, message_content, message_data, processed)
            VALUES (?, ?, ?, ?, FALSE)
        `;
        
        const [result] = await databasePool.query(query, [
            sessionId,
            messageType,
            content,
            JSON.stringify(messageData),
            false
        ]);
        
        return (result as any).insertId;
    }

    /**
     * Process incoming message with AI
     */
    static async processIncomingMessage(sessionId: string, message: string, messageData: any = {}): Promise<string> {
        try {
            // Save incoming message
            await this.saveMessage(sessionId, 'incoming', message, messageData);
            
            // Get session info
            const sessionQuery = `
                SELECT wbs.*, c.name as customer_name, c.phone
                FROM whatsapp_bot_sessions wbs
                JOIN customers c ON wbs.customer_id = c.id
                WHERE wbs.session_id = ?
            `;
            
            const [sessionResult] = await databasePool.query(sessionQuery, [sessionId]);
            const session = (sessionResult as any[])[0];
            
            if (!session) {
                return "Maaf, sesi tidak ditemukan. Silakan hubungi customer service.";
            }
            
            // AI Intent Recognition
            const intent = await this.analyzeIntent(message);
            
            // Process based on intent
            let response = '';
            switch (intent.intent) {
                case 'greeting':
                    response = await this.handleGreeting(session);
                    break;
                case 'check_invoice':
                    response = await this.handleCheckInvoice(session);
                    break;
                case 'payment_inquiry':
                    response = await this.handlePaymentInquiry(session);
                    break;
                case 'upload_proof':
                    response = await this.handleUploadProof(session);
                    break;
                case 'payment_status':
                    response = await this.handlePaymentStatus(session);
                    break;
                case 'complaint':
                    response = await this.handleComplaint(session, message);
                    break;
                case 'help':
                    response = await this.handleHelp();
                    break;
                default:
                    response = await this.handleUnknownIntent(session);
            }
            
            // Save outgoing message
            await this.saveMessage(sessionId, 'outgoing', response);
            
            return response;
            
        } catch (error) {
            console.error('Error processing incoming message:', error);
            return "Maaf, terjadi kesalahan. Silakan coba lagi atau hubungi customer service.";
        }
    }

    /**
     * AI Intent Recognition
     */
    private static async analyzeIntent(message: string): Promise<{intent: string, confidence: number}> {
        const lowerMessage = message.toLowerCase();
        
        // Simple keyword-based intent recognition
        // In production, this would use a trained ML model
        
        if (lowerMessage.includes('halo') || lowerMessage.includes('hai') || lowerMessage.includes('selamat')) {
            return { intent: 'greeting', confidence: 0.9 };
        }
        
        if (lowerMessage.includes('tagihan') || lowerMessage.includes('invoice') || lowerMessage.includes('bill')) {
            return { intent: 'check_invoice', confidence: 0.8 };
        }
        
        if (lowerMessage.includes('bayar') || lowerMessage.includes('pembayaran') || lowerMessage.includes('payment')) {
            return { intent: 'payment_inquiry', confidence: 0.8 };
        }
        
        if (lowerMessage.includes('bukti') || lowerMessage.includes('transfer') || lowerMessage.includes('proof')) {
            return { intent: 'upload_proof', confidence: 0.9 };
        }
        
        if (lowerMessage.includes('status') || lowerMessage.includes('cek')) {
            return { intent: 'payment_status', confidence: 0.7 };
        }
        
        if (lowerMessage.includes('komplain') || lowerMessage.includes('masalah') || lowerMessage.includes('error')) {
            return { intent: 'complaint', confidence: 0.8 };
        }
        
        if (lowerMessage.includes('bantuan') || lowerMessage.includes('help') || lowerMessage.includes('menu')) {
            return { intent: 'help', confidence: 0.9 };
        }
        
        return { intent: 'unknown', confidence: 0.1 };
    }

    /**
     * Handle greeting
     */
    private static async handleGreeting(session: any): Promise<string> {
        return `Halo ${session.customer_name}! 👋

Selamat datang di Billing Bot PT. Internet Provider.

Saya siap membantu Anda dengan:
• 📋 Cek tagihan
• 💰 Informasi pembayaran  
• 📤 Upload bukti transfer
• 📊 Status pembayaran
• 🆘 Bantuan lainnya

Ketik "menu" untuk melihat semua opsi yang tersedia.`;
    }

    /**
     * Handle check invoice
     */
    private static async handleCheckInvoice(session: any): Promise<string> {
        try {
            // Get customer's invoices
            const invoiceQuery = `
                SELECT i.*, s.package_name
                FROM invoices i
                LEFT JOIN subscriptions s ON i.subscription_id = s.id
                WHERE i.customer_id = ? 
                AND i.status IN ('sent', 'partial', 'overdue')
                ORDER BY i.created_at DESC
                LIMIT 5
            `;
            
            const [invoiceResult] = await databasePool.query(invoiceQuery, [session.customer_id]);
            const invoices = invoiceResult as any[];
            
            if (invoices.length === 0) {
                return "✅ Tidak ada tagihan yang belum dibayar untuk Anda.";
            }
            
            let response = "📋 *Daftar Tagihan Anda:*\n\n";
            
            for (const invoice of invoices) {
                const status = invoice.status === 'sent' ? 'Belum Bayar' : 
                             invoice.status === 'partial' ? 'Bayar Sebagian' : 'Overdue';
                
                response += `📄 *${invoice.invoice_number}*\n`;
                response += `💰 Rp ${parseFloat(invoice.total_amount).toLocaleString('id-ID')}\n`;
                response += `📅 Jatuh Tempo: ${new Date(invoice.due_date).toLocaleDateString('id-ID')}\n`;
                response += `📊 Status: ${status}\n\n`;
            }
            
            response += "Ketik 'bayar' untuk informasi pembayaran.";
            
            return response;
            
        } catch (error) {
            console.error('Error getting invoices:', error);
            return "Maaf, terjadi kesalahan saat mengambil data tagihan.";
        }
    }

    /**
     * Handle payment inquiry
     */
    private static async handlePaymentInquiry(session: any): Promise<string> {
        return `💰 *Informasi Pembayaran*

Anda dapat melakukan pembayaran melalui:

🏦 *Bank Transfer:*
• BCA: 1234567890 (PT. Internet Provider)
• Mandiri: 0987654321 (PT. Internet Provider)
• BRI: 1122334455 (PT. Internet Provider)

💳 *E-Wallet:*
• GoPay: 081234567890
• OVO: 081234567890
• DANA: 081234567890

📱 *QRIS:*
Scan QR code di invoice untuk pembayaran instan

📤 *Upload Bukti:*
Kirim foto bukti transfer untuk konfirmasi otomatis

Ketik 'upload' untuk mengirim bukti transfer.`;
    }

    /**
     * Handle upload proof
     */
    private static async handleUploadProof(session: any): Promise<string> {
        // Update session state
        const updateQuery = `
            UPDATE whatsapp_bot_sessions 
            SET current_state = 'waiting_proof', context_data = '{"waiting_for": "transfer_proof"}'
            WHERE session_id = ?
        `;
        await databasePool.query(updateQuery, [session.session_id]);
        
        return `📤 *Upload Bukti Transfer*

Silakan kirim foto bukti transfer Anda dengan format:
• Foto jelas dan tidak blur
• Tampilkan nominal transfer
• Tampilkan nama penerima
• Tampilkan tanggal transfer

Sistem akan otomatis memverifikasi bukti transfer Anda.

⏰ *Estimasi verifikasi: 1-5 menit*`;
    }

    /**
     * Handle payment status
     */
    private static async handlePaymentStatus(session: any): Promise<string> {
        try {
            // Get recent payments
            const paymentQuery = `
                SELECT p.*, i.invoice_number
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE i.customer_id = ?
                ORDER BY p.payment_date DESC
                LIMIT 3
            `;
            
            const [paymentResult] = await databasePool.query(paymentQuery, [session.customer_id]);
            const payments = paymentResult as any[];
            
            if (payments.length === 0) {
                return "📊 Belum ada riwayat pembayaran.";
            }
            
            let response = "📊 *Riwayat Pembayaran Terbaru:*\n\n";
            
            for (const payment of payments) {
                response += `💰 *${payment.invoice_number}*\n`;
                response += `💵 Rp ${parseFloat(payment.amount).toLocaleString('id-ID')}\n`;
                response += `📅 ${new Date(payment.payment_date).toLocaleDateString('id-ID')}\n`;
                response += `🏦 ${payment.payment_method}\n\n`;
            }
            
            return response;
            
        } catch (error) {
            console.error('Error getting payment status:', error);
            return "Maaf, terjadi kesalahan saat mengambil status pembayaran.";
        }
    }

    /**
     * Handle complaint
     */
    private static async handleComplaint(session: any, message: string): Promise<string> {
        // Save complaint for admin review
        const complaintQuery = `
            INSERT INTO whatsapp_bot_messages (session_id, message_type, message_content, message_data, processed)
            VALUES (?, 'incoming', ?, '{"type": "complaint", "priority": "high"}', FALSE)
        `;
        
        await databasePool.query(complaintQuery, [session.session_id, message]);
        
        return `🆘 *Komplain Anda Telah Dicatat*

Terima kasih telah melaporkan masalah Anda. Tim customer service akan segera menindaklanjuti.

📞 *Kontak Langsung:*
• WhatsApp: 081234567890
• Telepon: (021) 123-4567
• Email: support@internetprovider.com

⏰ *Estimasi respon: 1-2 jam kerja*`;
    }

    /**
     * Handle help
     */
    private static async handleHelp(): Promise<string> {
        return `🆘 *Menu Bantuan*

*Perintah yang tersedia:*
• "tagihan" - Cek tagihan Anda
• "bayar" - Informasi pembayaran
• "upload" - Upload bukti transfer
• "status" - Status pembayaran
• "komplain" - Laporkan masalah
• "menu" - Tampilkan menu ini

*Kontak Customer Service:*
📞 Telepon: (021) 123-4567
📱 WhatsApp: 081234567890
📧 Email: support@internetprovider.com

*Jam Operasional:*
Senin - Jumat: 08:00 - 17:00
Sabtu: 08:00 - 12:00`;
    }

    /**
     * Handle unknown intent
     */
    private static async handleUnknownIntent(session: any): Promise<string> {
        return `Maaf, saya tidak memahami pesan Anda. 😅

Ketik "menu" untuk melihat opsi yang tersedia, atau "help" untuk bantuan.

Atau hubungi customer service di:
📞 (021) 123-4567`;
    }

    /**
     * Process image for transfer proof
     */
    static async processTransferProof(sessionId: string, imageData: Buffer, fileName: string): Promise<string> {
        try {
            // Get session
            const sessionQuery = `
                SELECT wbs.*, c.name as customer_name
                FROM whatsapp_bot_sessions wbs
                JOIN customers c ON wbs.customer_id = c.id
                WHERE wbs.session_id = ?
            `;
            
            const [sessionResult] = await databasePool.query(sessionQuery, [sessionId]);
            const session = (sessionResult as any[])[0];
            
            if (!session) {
                return "Maaf, sesi tidak ditemukan.";
            }
            
            // AI Analysis of transfer proof
            const aiResult = await this.analyzeTransferProof(imageData);
            
            if (aiResult.confidence > 0.8) {
                // Auto approve
                await this.autoApprovePayment(session, aiResult);
                return `✅ *Pembayaran Dikonfirmasi*

Terima kasih! Pembayaran Anda telah dikonfirmasi secara otomatis.

💰 *Detail Pembayaran:*
• Nominal: Rp ${aiResult.amount?.toLocaleString('id-ID') || 'Terdeteksi'}
• Bank: ${aiResult.bank || 'Terdeteksi'}
• Tanggal: ${aiResult.date || 'Terdeteksi'}

Layanan Anda akan segera aktif.`;
            } else {
                // Manual verification
                await this.forwardToManualVerification(session, imageData, fileName, aiResult);
                return `⏳ *Bukti Transfer Diterima*

Bukti transfer Anda telah diterima dan sedang diverifikasi oleh tim kami.

⏰ *Estimasi verifikasi: 1-2 jam kerja*

Anda akan mendapat notifikasi setelah verifikasi selesai.`;
            }
            
        } catch (error) {
            console.error('Error processing transfer proof:', error);
            return "Maaf, terjadi kesalahan saat memproses bukti transfer. Silakan coba lagi.";
        }
    }

    /**
     * AI Analysis of transfer proof
     */
    private static async analyzeTransferProof(imageData: Buffer): Promise<any> {
        // This is a mock implementation
        // In production, this would use actual AI/ML models
        
        const mockResult = {
            confidence: Math.random() * 0.4 + 0.6, // 60-100% confidence
            amount: Math.floor(Math.random() * 500000) + 100000, // Random amount
            bank: ['BCA', 'Mandiri', 'BRI', 'BNI'][Math.floor(Math.random() * 4)],
            date: new Date().toISOString().split('T')[0],
            account_number: '1234567890'
        };
        
        return mockResult;
    }

    /**
     * Auto approve payment
     */
    private static async autoApprovePayment(session: any, aiResult: any): Promise<void> {
        try {
            // Find matching invoice
            const invoiceQuery = `
                SELECT * FROM invoices 
                WHERE customer_id = ? 
                AND status IN ('sent', 'partial', 'overdue')
                AND total_amount = ?
                ORDER BY created_at DESC LIMIT 1
            `;
            
            const [invoiceResult] = await databasePool.query(invoiceQuery, [session.customer_id, aiResult.amount]);
            const invoices = invoiceResult as any[];
            
            if (invoices.length > 0) {
                const invoice = invoices[0];
                
                // Create payment record
                await PaymentService.recordPayment({
                    invoice_id: invoice.id,
                    amount: aiResult.amount,
                    payment_method: 'bank_transfer',
                    // payment_date: new Date(), // Removed as it's not in PaymentData interface
                    reference_number: `AUTO-${Date.now()}`,
                    notes: 'Auto approved via WhatsApp Bot'
                });
            }
            
        } catch (error) {
            console.error('Error auto approving payment:', error);
        }
    }

    /**
     * Forward to manual verification
     */
    private static async forwardToManualVerification(session: any, imageData: Buffer, fileName: string, aiResult: any): Promise<void> {
        try {
            // Save transfer proof file
            const filePath = `uploads/transfer-proofs/${session.customer_id}_${Date.now()}_${fileName}`;
            // In production, save file to filesystem
            
            // Create transfer proof record
            const proofQuery = `
                INSERT INTO transfer_proofs (customer_id, file_path, file_name, ai_analysis, status)
                VALUES (?, ?, ?, ?, 'pending')
            `;
            
            await databasePool.query(proofQuery, [
                session.customer_id,
                filePath,
                fileName,
                JSON.stringify(aiResult)
            ]);
            
        } catch (error) {
            console.error('Error forwarding to manual verification:', error);
        }
    }


    /**
     * Get bot statistics for dashboard
     */
    static async getBotStatistics(): Promise<any> {
        try {
            // Get total sessions
            const totalSessionsQuery = `
                SELECT COUNT(*) as total FROM whatsapp_bot_sessions
            `;
            const [totalSessionsResult] = await databasePool.query(totalSessionsQuery);
            const totalSessions = (totalSessionsResult as any[])[0].total;

            // Get active sessions
            const activeSessionsQuery = `
                SELECT COUNT(*) as active FROM whatsapp_bot_sessions 
                WHERE is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `;
            const [activeSessionsResult] = await databasePool.query(activeSessionsQuery);
            const activeSessions = (activeSessionsResult as any[])[0].active;

            // Get messages today
            const messagesTodayQuery = `
                SELECT COUNT(*) as today FROM whatsapp_bot_messages 
                WHERE DATE(created_at) = CURDATE()
            `;
            const [messagesTodayResult] = await databasePool.query(messagesTodayQuery);
            const messagesToday = (messagesTodayResult as any[])[0].today;

            // Calculate success rate
            const successRateQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful
                FROM notification_logs 
                WHERE channel = 'whatsapp' AND DATE(created_at) = CURDATE()
            `;
            const [successRateResult] = await databasePool.query(successRateQuery);
            const successRate = (successRateResult as any[])[0];
            const successRatePercent = successRate.total > 0 ? 
                Math.round((successRate.successful / successRate.total) * 100) : 0;

            return {
                totalSessions,
                activeSessions,
                messagesToday,
                successRate: successRatePercent
            };
        } catch (error) {
            console.error('Error getting bot statistics:', error);
            return {
                totalSessions: 0,
                activeSessions: 0,
                messagesToday: 0,
                successRate: 0
            };
        }
    }

    /**
     * Get bot commands
     */
    static async getBotCommands(): Promise<any[]> {
        try {
            // Return predefined commands for now
            return [
                {
                    command: '/cek_tagihan',
                    description: 'Cek status tagihan pelanggan',
                    category: 'Billing',
                    status: 'Aktif',
                    usage: 45
                },
                {
                    command: '/upload_bukti',
                    description: 'Upload bukti pembayaran',
                    category: 'Payment',
                    status: 'Aktif',
                    usage: 32
                },
                {
                    command: '/status_pembayaran',
                    description: 'Cek status pembayaran',
                    category: 'Payment',
                    status: 'Aktif',
                    usage: 28
                },
                {
                    command: '/bantuan',
                    description: 'Tampilkan menu bantuan',
                    category: 'Help',
                    status: 'Aktif',
                    usage: 15
                },
                {
                    command: '/gangguan',
                    description: 'Laporkan gangguan internet',
                    category: 'Support',
                    status: 'Aktif',
                    usage: 8
                }
            ];
        } catch (error) {
            console.error('Error getting bot commands:', error);
            return [];
        }
    }

    /**
     * Get chat sessions with pagination
     */
    static async getChatSessions(page: number = 1, limit: number = 20): Promise<any> {
        try {
            const offset = (page - 1) * limit;
            
            const sessionsQuery = `
                SELECT 
                    s.*,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM whatsapp_bot_sessions s
                LEFT JOIN customers c ON s.customer_id = c.id
                ORDER BY s.last_activity DESC
                LIMIT ? OFFSET ?
            `;
            
            const [sessions] = await databasePool.query(sessionsQuery, [limit, offset]);
            
            const countQuery = `SELECT COUNT(*) as total FROM whatsapp_bot_sessions`;
            const [countResult] = await databasePool.query(countQuery);
            const total = (countResult as any[])[0].total;
            
            return {
                sessions: sessions as any[],
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting chat sessions:', error);
            return {
                sessions: [],
                pagination: { page: 1, limit: 20, total: 0, pages: 0 }
            };
        }
    }

    /**
     * Get notifications with pagination
     */
    static async getNotifications(page: number = 1, limit: number = 20): Promise<any> {
        try {
            const offset = (page - 1) * limit;
            
            const notificationsQuery = `
                SELECT 
                    n.*,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM notification_logs n
                LEFT JOIN customers c ON n.customer_id = c.id
                WHERE n.channel = 'whatsapp'
                ORDER BY n.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const [notifications] = await databasePool.query(notificationsQuery, [limit, offset]);
            
            const countQuery = `SELECT COUNT(*) as total FROM notification_logs WHERE channel = 'whatsapp'`;
            const [countResult] = await databasePool.query(countQuery);
            const total = (countResult as any[])[0].total;
            
            return {
                notifications: notifications as any[],
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting notifications:', error);
            return {
                notifications: [],
                pagination: { page: 1, limit: 20, total: 0, pages: 0 }
            };
        }
    }

    /**
     * Get message templates
     */
    static async getMessageTemplates(): Promise<any[]> {
        try {
            // Return predefined templates for now
            return [
                {
                    id: 1,
                    name: 'Tagihan Reminder',
                    category: 'Billing',
                    content: 'Halo {{nama}}, tagihan internet Anda sebesar {{jumlah}} jatuh tempo pada {{tanggal}}. Silakan lakukan pembayaran untuk menghindari pemutusan layanan.',
                    usage: 45,
                    status: 'Aktif'
                },
                {
                    id: 2,
                    name: 'Konfirmasi Pembayaran',
                    category: 'Payment',
                    content: 'Terima kasih {{nama}}! Pembayaran sebesar {{jumlah}} telah berhasil diterima. Layanan internet Anda akan aktif kembali dalam beberapa menit.',
                    usage: 32,
                    status: 'Aktif'
                },
                {
                    id: 3,
                    name: 'Gangguan Internet',
                    category: 'Support',
                    content: 'Halo {{nama}}, kami mendeteksi gangguan pada layanan internet di area {{lokasi}}. Tim teknis sedang bekerja untuk mengatasi masalah ini. Estimasi perbaikan: {{estimasi}}.',
                    usage: 8,
                    status: 'Aktif'
                },
                {
                    id: 4,
                    name: 'Promo Paket Baru',
                    category: 'Marketing',
                    content: 'Halo {{nama}}! Kami punya paket internet terbaru dengan kecepatan {{kecepatan}} dan harga spesial {{harga}}. Hubungi kami untuk info lebih lanjut!',
                    usage: 12,
                    status: 'Aktif'
                }
            ];
        } catch (error) {
            console.error('Error getting message templates:', error);
            return [];
        }
    }
}
