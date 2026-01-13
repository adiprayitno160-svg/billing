import { GoogleGenerativeAI } from '@google/generative-ai';
import { AISettingsService } from '../payment/AISettingsService';
import { KnowledgeBaseService } from './KnowledgeBaseService';

export class ChatBotService {
    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    private static async initialize(): Promise<void> {
        if (this.model) return;

        const isEnabled = await AISettingsService.isEnabled();
        if (!isEnabled) throw new Error('AI is not enabled');

        const apiKey = await AISettingsService.getAPIKey();
        if (!apiKey) throw new Error('API Key missing');

        const settings = await AISettingsService.getSettings();
        const modelName = settings?.model || 'gemini-1.5-flash';

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Ask a question to the AI with context from the knowledge base (RAG)
     * Includes Retry Logic for Robustness
     */
    static async ask(userQuery: string, customerData?: any): Promise<string> {
        try {
            await this.initialize();

            // 1. Retrieve context from Knowledge Base
            const relevantDocs = await KnowledgeBaseService.search(userQuery);
            let context = '';

            if (relevantDocs.length > 0) {
                context = "Gunakan informasi dari basis pengetahuan berikut untuk menjawab jika relevan:\n\n";
                relevantDocs.forEach((doc, idx) => {
                    context += `Dokumen ${idx + 1}:\nPertanyaan: ${doc.question}\nJawaban: ${doc.answer}\n\n`;
                });
            }

            // 2. Prepare System Prompt
            const systemPrompt = `
                Anda adalah asisten AI ramah untuk ISP (Internet Service Provider) bernama "Billing System".
                Identitas Anda: Customer Service ISP.
                
                Data Pelanggan (Jika ada):
                ${customerData ? JSON.stringify(customerData, null, 2) : 'Pelanggan belum login/identitas tidak dikenal'}

                Instruksi:
                1. Jawab dengan ramah dan profesional dalam Bahasa Indonesia.
                2. Gunakan konteks dari basis pengetahuan yang diberikan jika tersedia.
                3. Jika informasi tidak ada di konteks atau data pelanggan, arahkan untuk menghubungi admin manusia.
                4. Jika ditanya tagihan, dan data pelanggan tersedia, berikan ringkasan singkat.
                5. Singkat dan jelas adalah kunci.
            `;

            // 3. Generate response with Retry Logic
            const prompt = `
                System Context: ${systemPrompt}
                ${context ? `RAG Context: ${context}` : ''}
                User Question: ${userQuery}
                Asisten AI:
            `;

            let lastError: any;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const result = await this.model.generateContent(prompt);
                    const response = await result.response;
                    return response.text().trim();
                } catch (error) {
                    lastError = error;
                    console.warn(`[ChatBot] Attempt ${attempt} failed:`, error);
                    // Exponential backoff for retries
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
            throw lastError;

        } catch (error) {
            console.error('Error in ChatBotService:', error);
            // Graceful Degradation
            return "Maaf, sistem AI sedang mengalami gangguan sementara. Silakan hubungi admin kami secara manual atau coba lagi nanti.";
        }
    }
}
