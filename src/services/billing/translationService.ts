import { databasePool } from '../../db/pool';

export interface TranslationCache {
    id: number;
    source_text: string;
    source_language: string;
    target_language: string;
    translated_text: string;
    confidence_score: number;
    created_at: Date;
}

export class TranslationService {
    /**
     * Translate text with caching
     */
    static async translateText(
        text: string,
        sourceLanguage: string = 'id',
        targetLanguage: string = 'en'
    ): Promise<string> {
        try {
            // Check cache first
            const cached = await this.getCachedTranslation(text, sourceLanguage, targetLanguage);
            if (cached) {
                return cached.translated_text;
            }
            
            // Perform translation
            const translatedText = await this.performTranslation(text, sourceLanguage, targetLanguage);
            
            // Cache the result
            await this.cacheTranslation(text, sourceLanguage, targetLanguage, translatedText, 0.9);
            
            return translatedText;
            
        } catch (error) {
            console.error('Error translating text:', error);
            return text; // Return original text if translation fails
        }
    }

    /**
     * Get cached translation
     */
    private     static async getCachedTranslation(
        text: string, 
        sourceLanguage: string, 
        targetLanguage: string
    ): Promise<TranslationCache | undefined> {
        const query = `
            SELECT * FROM translation_cache 
            WHERE source_text = ? 
            AND source_language = ? 
            AND target_language = ?
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        
        const [result] = await databasePool.query(query, [text, sourceLanguage, targetLanguage]);
        const translations = result as TranslationCache[];
        
        return translations.length > 0 ? translations[0] : undefined;
    }

    /**
     * Cache translation
     */
    private static async cacheTranslation(
        sourceText: string,
        sourceLanguage: string,
        targetLanguage: string,
        translatedText: string,
        confidence: number
    ): Promise<void> {
        const query = `
            INSERT INTO translation_cache (source_text, source_language, target_language, translated_text, confidence_score)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await databasePool.query(query, [
            sourceText,
            sourceLanguage,
            targetLanguage,
            translatedText,
            confidence
        ]);
    }

    /**
     * Perform translation (mock implementation)
     */
    private static async performTranslation(
        text: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string> {
        // Mock translation implementation
        // In production, this would use Google Translate API, Azure Translator, etc.
        
        const translations: { [key: string]: { [key: string]: any } } = {
            'id': {
                'en': {
                    'halo': 'hello',
                    'terima kasih': 'thank you',
                    'tagihan': 'invoice',
                    'pembayaran': 'payment',
                    'bukti transfer': 'transfer proof',
                    'status': 'status',
                    'bantuan': 'help',
                    'komplain': 'complaint',
                    'selamat datang': 'welcome',
                    'saya butuh bantuan': 'i need help',
                    'bagaimana cara bayar': 'how to pay',
                    'kapan tagihan jatuh tempo': 'when is the invoice due',
                    'saya sudah bayar': 'i have paid',
                    'cek status pembayaran': 'check payment status',
                    'upload bukti transfer': 'upload transfer proof'
                },
                'zh': {
                    'halo': '你好',
                    'terima kasih': '谢谢',
                    'tagihan': '发票',
                    'pembayaran': '付款',
                    'bukti transfer': '转账证明',
                    'status': '状态',
                    'bantuan': '帮助',
                    'komplain': '投诉'
                }
            },
            'en': {
                'id': {
                    'hello': 'halo',
                    'thank you': 'terima kasih',
                    'invoice': 'tagihan',
                    'payment': 'pembayaran',
                    'transfer proof': 'bukti transfer',
                    'status': 'status',
                    'help': 'bantuan',
                    'complaint': 'komplain',
                    'welcome': 'selamat datang',
                    'i need help': 'saya butuh bantuan',
                    'how to pay': 'bagaimana cara bayar',
                    'when is the invoice due': 'kapan tagihan jatuh tempo',
                    'i have paid': 'saya sudah bayar',
                    'check payment status': 'cek status pembayaran',
                    'upload transfer proof': 'upload bukti transfer'
                }
            }
        };
        
        // Simple word-by-word translation
        let translatedText = text.toLowerCase();
        
        if (translations[sourceLanguage] && translations[sourceLanguage][targetLanguage]) {
            const translationMap = translations[sourceLanguage][targetLanguage];
            
            for (const [source, target] of Object.entries(translationMap)) {
                translatedText = translatedText.replace(new RegExp(source, 'gi'), target as string);
            }
        }
        
        // If no translation found, return original text
        if (translatedText === text.toLowerCase()) {
            return text;
        }
        
        return translatedText;
    }

    /**
     * Translate WhatsApp message
     */
    static async translateWhatsAppMessage(
        message: string,
        customerLanguage: string = 'id',
        botLanguage: string = 'id'
    ): Promise<string> {
        if (customerLanguage === botLanguage) {
            return message;
        }
        
        return await this.translateText(message, customerLanguage, botLanguage);
    }

    /**
     * Translate customer response
     */
    static async translateCustomerResponse(
        message: string,
        customerLanguage: string = 'id',
        adminLanguage: string = 'id'
    ): Promise<string> {
        if (customerLanguage === adminLanguage) {
            return message;
        }
        
        return await this.translateText(message, customerLanguage, adminLanguage);
    }

    /**
     * Detect language
     */
    static async detectLanguage(text: string): Promise<string> {
        // Simple language detection based on common words
        const lowerText = text.toLowerCase();
        
        // Indonesian indicators
        const indonesianWords = ['halo', 'terima kasih', 'tagihan', 'pembayaran', 'bukti', 'status', 'bantuan', 'komplain'];
        const indonesianCount = indonesianWords.filter(word => lowerText.includes(word)).length;
        
        // English indicators
        const englishWords = ['hello', 'thank you', 'invoice', 'payment', 'proof', 'status', 'help', 'complaint'];
        const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
        
        // Chinese indicators
        const chineseWords = ['你好', '谢谢', '发票', '付款', '证明', '状态', '帮助', '投诉'];
        const chineseCount = chineseWords.filter(word => lowerText.includes(word)).length;
        
        if (indonesianCount > englishCount && indonesianCount > chineseCount) {
            return 'id';
        } else if (englishCount > indonesianCount && englishCount > chineseCount) {
            return 'en';
        } else if (chineseCount > indonesianCount && chineseCount > englishCount) {
            return 'zh';
        }
        
        return 'id'; // Default to Indonesian
    }

    /**
     * Get supported languages
     */
    static getSupportedLanguages(): { [key: string]: string } {
        return {
            'id': 'Bahasa Indonesia',
            'en': 'English',
            'zh': '中文 (Chinese)',
            'ja': '日本語 (Japanese)',
            'ko': '한국어 (Korean)',
            'th': 'ไทย (Thai)',
            'vi': 'Tiếng Việt (Vietnamese)',
            'ms': 'Bahasa Melayu (Malay)'
        };
    }

    /**
     * Get translation statistics
     */
    static async getTranslationStatistics(days: number = 30): Promise<any> {
        const query = `
            SELECT 
                source_language,
                target_language,
                COUNT(*) as translation_count,
                AVG(confidence_score) as avg_confidence
            FROM translation_cache 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY source_language, target_language
            ORDER BY translation_count DESC
        `;
        
        const [result] = await databasePool.query(query, [days]);
        return result;
    }

    /**
     * Clean old cache entries
     */
    static async cleanOldCache(days: number = 90): Promise<number> {
        const query = `
            DELETE FROM translation_cache 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        
        const [result] = await databasePool.query(query, [days]);
        return (result as any).affectedRows;
    }

    /**
     * Translate invoice content
     */
    static async translateInvoiceContent(
        invoiceData: any,
        targetLanguage: string = 'en'
    ): Promise<any> {
        const translatedInvoice = { ...invoiceData };
        
        // Translate customer name if needed
        if (invoiceData.customer_name) {
            translatedInvoice.customer_name = await this.translateText(
                invoiceData.customer_name,
                'id',
                targetLanguage
            );
        }
        
        // Translate package name if needed
        if (invoiceData.package_name) {
            translatedInvoice.package_name = await this.translateText(
                invoiceData.package_name,
                'id',
                targetLanguage
            );
        }
        
        // Translate status if needed
        if (invoiceData.status) {
            const statusTranslations: { [key: string]: { [key: string]: string } } = {
                'sent': { 'en': 'sent', 'id': 'terkirim' },
                'paid': { 'en': 'paid', 'id': 'lunas' },
                'overdue': { 'en': 'overdue', 'id': 'terlambat' },
                'partial': { 'en': 'partial', 'id': 'sebagian' },
                'draft': { 'en': 'draft', 'id': 'draft' }
            };
            
            if (statusTranslations[invoiceData.status] && statusTranslations[invoiceData.status]![targetLanguage]) {
                translatedInvoice.status = statusTranslations[invoiceData.status]![targetLanguage];
            }
        }
        
        return translatedInvoice;
    }

    /**
     * Translate WhatsApp bot responses
     */
    static async translateBotResponse(
        response: string,
        customerLanguage: string = 'id'
    ): Promise<string> {
        if (customerLanguage === 'id') {
            return response;
        }
        
        // Translate common bot responses
        const responseTranslations: { [key: string]: { [key: string]: any } } = {
            'id': {
                'en': {
                    'Selamat datang di Billing Bot': 'Welcome to Billing Bot',
                    'Saya siap membantu Anda': 'I am ready to help you',
                    'Ketik "menu" untuk melihat opsi': 'Type "menu" to see options',
                    'Terima kasih atas kepercayaan Anda': 'Thank you for your trust',
                    'Pembayaran berhasil dikonfirmasi': 'Payment successfully confirmed',
                    'Bukti transfer diterima': 'Transfer proof received',
                    'Maaf, terjadi kesalahan': 'Sorry, an error occurred',
                    'Hubungi customer service': 'Contact customer service'
                }
            }
        };
        
        if (responseTranslations['id'] && responseTranslations['id'][customerLanguage]) {
            const translations = responseTranslations['id'][customerLanguage];
            
            for (const [source, target] of Object.entries(translations)) {
                response = response.replace(new RegExp(source, 'gi'), target as string);
            }
        }
        
        return response;
    }
}
