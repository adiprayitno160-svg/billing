import { GoogleGenerativeAI } from '@google/generative-ai';
import { AISettingsService } from '../payment/AISettingsService';
import { KnowledgeBaseService } from './KnowledgeBaseService';

export class ChatBotService {
    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    // Circuit‑breaker state
    private static failureCount = 0;
    private static readonly FAILURE_THRESHOLD = 3; // attempts before disabling
    private static readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
    private static disabledUntil: number | null = null;

    private static async initialize(): Promise<void> {
        if (this.model) return;

        const isEnabled = await AISettingsService.isEnabled();
        // Allow initialization even if disabled in DB if ENV is set (for testing)
        // if (!isEnabled) throw new Error('AI is not enabled');

        let apiKey = process.env.GEMINI_API_KEY || (await AISettingsService.getAPIKey());
        if (!apiKey) throw new Error('API Key missing (Check .env or DB Settings)');

        const settings = await AISettingsService.getSettings();
        const modelName = settings?.model || "gemini-1.5-flash"; // Fallback to 1.5-flash

        console.log(`[ChatBot] Initializing with model: ${modelName}`);

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Returns true if the AI service is currently disabled due to repeated failures.
     */
    private static isDisabled(): boolean {
        if (this.disabledUntil && Date.now() < this.disabledUntil) return true;
        // reset if cooldown passed
        if (this.disabledUntil && Date.now() >= this.disabledUntil) {
            this.disabledUntil = null;
            this.failureCount = 0;
        }
        return false;
    }

    /** Reset circuit‑breaker after a successful call */
    private static resetFailure(): void {
        this.failureCount = 0;
        this.disabledUntil = null;
    }

    /**
     * Ask a question to the AI with context from the knowledge base (RAG)
     * Includes Retry Logic for Robustness
     */
    static async ask(userQuery: string, customerData?: any): Promise<string> {
        // If circuit‑breaker is active, short‑circuit with graceful message
        if (this.isDisabled()) {
            return "Maaf, layanan AI sedang dalam pemulihan. Silakan coba lagi nanti atau gunakan */menu* untuk opsi lainnya.";
        }

        let relevantDocs: any[] = [];
        try {
            await this.initialize();

            // 1. Retrieve context from Knowledge Base
            relevantDocs = await KnowledgeBaseService.search(userQuery);
            let context = '';

            if (relevantDocs.length > 0) {
                context = "Gunakan informasi dari basis pengetahuan berikut untuk menjawab jika relevan:\n\n";
                relevantDocs.forEach((doc, idx) => {
                    context += `Dokumen ${idx + 1}: \nPertanyaan: ${doc.question} \nJawaban: ${doc.answer} \n\n`;
                });
            }

            // 2. Prepare System Prompt
            const systemPrompt = `
                Anda adalah asisten AI ramah untuk ISP(Internet Service Provider) bernama "Billing System".
                Identitas Anda: Customer Service ISP.
                
                Data Pelanggan(Jika ada):
                ${customerData ? JSON.stringify(customerData, null, 2) : 'Pelanggan belum login/identitas tidak dikenal'}
                
                Instruksi:
                1. Jawab dengan ramah dan profesional dalam Bahasa Indonesia.
                2. Gunakan konteks dari basis pengetahuan yang diberikan jika tersedia.
                3. Jika informasi tidak ada di konteks atau data pelanggan, arahkan untuk menghubungi admin manusia.
                4. Jika ditanya tagihan, dan data pelanggan tersedia, berikan ringkasan singkat.
                5. Singkat dan jelas adalah kunci.
                6. SELALU sertakan perintah "Ketik */menu* untuk melihat opsi lainnya" di akhir jawaban Anda.
                7. Jika pengguna hanya menyapa(halo, p, tes, oi), jangan menjawab panjang lebar, tapi langsung tampilkan ringkasan menu atau arahkan ke */menu*.
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
                    // Ensure initialization (especially if cleared by previous error)
                    if (!this.model) await this.initialize();

                    const result = await this.model.generateContent(prompt);
                    const response = await result.response;

                    // Success – reset circuit‑breaker
                    this.resetFailure();
                    return response.text().trim();
                } catch (error: any) {
                    lastError = error;
                    const errorMessage = error.message || error.toString();
                    console.warn(`[ChatBot] Attempt ${attempt} failed: `, errorMessage);

                    // Check for Auth/Key errors (Auto-Healing)
                    const isAuthError = errorMessage.includes('API_KEY_INVALID') ||
                        errorMessage.includes('403') ||
                        errorMessage.includes('permission_denied') ||
                        errorMessage.includes('API key not valid');

                    if (isAuthError) {
                        console.log('[ChatBot] 🔄 Detected Invalid Key in memory. Refreshing settings from DB...');
                        this.model = null; // Clear cached model
                        this.genAI = null; // Clear cached instance
                        // Next loop iteration will call initialize() again, fetching new key
                        continue;
                    }

                    // Exponential backoff for other errors
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }

            // If we get here, all retries failed
            // Increment circuit breaker count
            this.failureCount++;
            if (this.failureCount >= this.FAILURE_THRESHOLD) {
                this.disabledUntil = Date.now() + this.COOLDOWN_MS;
                console.error('[ChatBot] Circuit‑breaker activated. Disabling AI calls temporarily.');
            }

            throw lastError;

        } catch (error: any) {
            console.error('Error in ChatBotService:', error.message || error);

            // If we have relevant docs from knowledge base, use the best match as fallback
            if (relevantDocs && relevantDocs.length > 0) {
                console.log('[ChatBot] 🔄 Falling back to Knowledge Base (RAG) due to AI error');
                return relevantDocs[0].answer;
            }

            // Graceful Degradation
            return "Maaf, sistem AI sedang mengalami gangguan sementara (API Key bermasalah). Silakan ketik */menu* untuk melihat opsi layanan.";
        }
    }

    /**
     * Analyze an image using Gemini Vision
     */
    static async analyzeImage(imageBuffer: Buffer, mimeType: string, promptText: string): Promise<string> {
        if (this.isDisabled()) {
            throw new Error('AI service temporarily disabled due to repeated failures');
        }
        try {
            await this.initialize();

            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType
                },
            };

            const result = await this.model.generateContent([promptText, imagePart]);
            const response = await result.response;

            // Success – reset failure counter
            this.resetFailure();
            return response.text().trim();

        } catch (error: any) {
            console.error('[ChatBot] Image analysis error:', error);

            // Increment failure counter and possibly trigger circuit‑breaker
            this.failureCount++;
            if (this.failureCount >= this.FAILURE_THRESHOLD) {
                this.disabledUntil = Date.now() + this.COOLDOWN_MS;
                console.error('[ChatBot] Circuit‑breaker activated after image error.');
            }
            throw error;
        }
    }
}
