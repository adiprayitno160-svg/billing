"use strict";
/**
 * Gemini Service
 * Integration with Google Gemini API for payment proof analysis
 * Uses Gemini Vision API to analyze payment proof images
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const AISettingsService_1 = require("./AISettingsService");
const FraudDetectionPrompts_1 = require("../ai/FraudDetectionPrompts");
class GeminiService {
    /**
     * Reset model (call this when settings change)
     */
    static resetModel() {
        this.model = null;
        this.genAI = null;
        console.log('🔄 Gemini model reset');
    }
    /**
     * Initialize Gemini API (reads from database)
     */
    static async initialize() {
        if (this.model) {
            return; // Already initialized
        }
        // Check if AI is enabled
        const isEnabled = await AISettingsService_1.AISettingsService.isEnabled();
        if (!isEnabled) {
            throw new Error('AI is not enabled or API key is not set');
        }
        // Get API key from database (with env fallback)
        const apiKey = await AISettingsService_1.AISettingsService.getAPIKey();
        console.log(`[GeminiService] Initializing...`);
        console.log(`[GeminiService] AI Enabled: ${isEnabled}`);
        if (!apiKey || apiKey.trim() === '') {
            console.error('[GeminiService] ❌ API Key is MISSING or EMPTY (checked DB and .env)');
            throw new Error('Gemini API key is not configured. Please set it in Settings > AI Settings');
        }
        else {
            console.log(`[GeminiService] ✅ API Key found (Length: ${apiKey.length})`);
        }
        // Get settings for model name
        const settings = await AISettingsService_1.AISettingsService.getSettings();
        const modelName = (settings === null || settings === void 0 ? void 0 : settings.model) || 'gemini-flash-latest';
        try {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: modelName });
            console.log(`✅ Gemini API initialized with model: ${modelName}`);
        }
        catch (error) {
            console.error('❌ Failed to initialize Gemini API:', error);
            throw new Error('Failed to initialize Gemini API');
        }
    }
    /**
     * Check if AI analysis is enabled
     */
    static async isEnabled() {
        try {
            return await AISettingsService_1.AISettingsService.isEnabled();
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Analyze payment proof image using Gemini Vision
     * Enhanced with comprehensive fraud detection
     */
    static async analyzePaymentProof(imageBuffer, expectedAmount, expectedBank, customerName, invoiceNumber, expectedRecipientName, isPrepaid) {
        try {
            await this.initialize();
            if (!this.model) {
                throw new Error('Gemini model not initialized');
            }
            console.log('🔍 Starting Gemini analysis...');
            // Convert image buffer to base64
            const base64Image = imageBuffer.toString('base64');
            const mimeType = this.detectMimeType(imageBuffer);
            // Prepare prompt with comprehensive fraud detection
            const prompt = this.buildAnalysisPrompt(expectedAmount, expectedBank, customerName, invoiceNumber);
            // Call Gemini Vision API
            const result = await this.model.generateContent([
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: mimeType
                    }
                },
                prompt
            ]);
            const response = await result.response;
            const text = response.text();
            console.log('✅ Gemini analysis completed');
            // Parse Gemini response
            const analysisResult = this.parseGeminiResponse(text, expectedAmount, expectedBank);
            return Object.assign(Object.assign({}, analysisResult), { rawResponse: text });
        }
        catch (error) {
            console.error('Error in Gemini analysis:', error);
            // Fallback: return safe default
            return {
                isValid: false,
                confidence: 0,
                extractedData: {},
                validation: {
                    isPaymentProof: false,
                    isRecent: false,
                    amountMatches: false,
                    bankMatches: false,
                    riskLevel: 'high',
                    riskReasons: ['Gemini analysis failed: ' + (error instanceof Error ? error.message : String(error))]
                },
                rawResponse: null
            };
        }
    }
    /**
     * Build analysis prompt for Gemini
     * Uses comprehensive fraud detection prompts
     */
    static buildAnalysisPrompt(expectedAmount, expectedBank, customerName, invoiceNumber, expectedRecipientName, isPrepaid) {
        // Use comprehensive fraud detection prompt
        const currentDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        return FraudDetectionPrompts_1.FraudDetectionPrompts.getPaymentProofVerificationPrompt(expectedAmount, expectedBank, customerName, invoiceNumber, expectedRecipientName, isPrepaid, currentDate);
    }
    /**
     * Parse Gemini response to structured data
     */
    static parseGeminiResponse(responseText, expectedAmount, expectedBank) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        try {
            // Extract JSON from response (might have markdown code blocks)
            let jsonText = responseText.trim();
            // Remove markdown code blocks if present
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            }
            const parsed = JSON.parse(jsonText);
            // Validate and normalize data
            // Support both old format (riskLevel in validation) and new format (riskLevel at root)
            const riskLevel = parsed.riskLevel || ((_a = parsed.validation) === null || _a === void 0 ? void 0 : _a.riskLevel) || 'high';
            const riskScore = parsed.riskScore || 0;
            const fraudIndicators = parsed.fraudIndicators || [];
            const result = {
                isValid: parsed.isValid === true,
                confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
                extractedData: {
                    amount: ((_b = parsed.extractedData) === null || _b === void 0 ? void 0 : _b.amount) ? parseFloat(parsed.extractedData.amount) : undefined,
                    date: (_c = parsed.extractedData) === null || _c === void 0 ? void 0 : _c.date,
                    time: (_d = parsed.extractedData) === null || _d === void 0 ? void 0 : _d.time,
                    bank: (_e = parsed.extractedData) === null || _e === void 0 ? void 0 : _e.bank,
                    accountNumber: (_f = parsed.extractedData) === null || _f === void 0 ? void 0 : _f.accountNumber,
                    accountHolder: (_g = parsed.extractedData) === null || _g === void 0 ? void 0 : _g.accountHolder,
                    referenceNumber: (_h = parsed.extractedData) === null || _h === void 0 ? void 0 : _h.referenceNumber,
                    transferMethod: (_j = parsed.extractedData) === null || _j === void 0 ? void 0 : _j.transferMethod
                },
                validation: {
                    isPaymentProof: ((_k = parsed.validation) === null || _k === void 0 ? void 0 : _k.isPaymentProof) === true,
                    isRecent: ((_l = parsed.validation) === null || _l === void 0 ? void 0 : _l.isRecent) === true,
                    amountMatches: ((_m = parsed.validation) === null || _m === void 0 ? void 0 : _m.amountMatches) === true,
                    bankMatches: ((_o = parsed.validation) === null || _o === void 0 ? void 0 : _o.bankMatches) === true,
                    isExactMatch: ((_p = parsed.validation) === null || _p === void 0 ? void 0 : _p.isExactMatch) === true,
                    riskLevel: ['low', 'medium', 'high', 'critical'].includes(riskLevel)
                        ? riskLevel
                        : 'high',
                    riskReasons: Array.isArray((_q = parsed.validation) === null || _q === void 0 ? void 0 : _q.riskReasons)
                        ? parsed.validation.riskReasons
                        : (fraudIndicators.length > 0
                            ? fraudIndicators.map((ind) => ind.description || ind).filter(Boolean)
                            : [])
                }
            };
            // Store additional data if available (for future use)
            if (riskScore > 0) {
                result.riskScore = riskScore;
            }
            if (fraudIndicators.length > 0) {
                result.fraudIndicators = fraudIndicators;
            }
            if (parsed.recommendation) {
                result.recommendation = parsed.recommendation;
            }
            if (parsed.reasoning) {
                result.reasoning = parsed.reasoning;
            }
            // Additional validation (STRICT)
            if (expectedAmount && result.extractedData.amount) {
                const amountDiff = Math.abs(result.extractedData.amount - expectedAmount);
                const tolerance = 2000; // Tolerance for admin fees/random numbers (Rp 0 - 2000)
                result.validation.amountMatches = amountDiff <= tolerance;
                // Set isExactMatch for matches within tolerance
                result.validation.isExactMatch = amountDiff <= 2000;
            }
            if (expectedBank && result.extractedData.bank) {
                result.validation.bankMatches = result.extractedData.bank
                    .toLowerCase()
                    .includes(expectedBank.toLowerCase());
            }
            return result;
        }
        catch (error) {
            console.error('Error parsing Gemini response:', error);
            console.error('Response text:', responseText);
            // Return safe default
            return {
                isValid: false,
                confidence: 0,
                extractedData: {},
                validation: {
                    isPaymentProof: false,
                    isRecent: false,
                    amountMatches: false,
                    bankMatches: false,
                    riskLevel: 'high',
                    riskReasons: ['Failed to parse Gemini response']
                }
            };
        }
    }
    /**
     * Detect MIME type from image buffer
     */
    static detectMimeType(buffer) {
        // Check magic numbers
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            return 'image/jpeg';
        }
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return 'image/png';
        }
        if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            return 'image/gif';
        }
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            return 'image/webp';
        }
        // Default to JPEG
        return 'image/jpeg';
    }
    /**
     * Determine if payment should be auto-approved based on Gemini analysis
     */
    static async shouldAutoApprove(analysis) {
        // Get settings from database
        const settings = await AISettingsService_1.AISettingsService.getSettings();
        if (!settings || !settings.auto_approve_enabled) {
            return {
                shouldApprove: false,
                confidence: 0,
                reasons: ['Auto-approve dinonaktifkan di pengaturan']
            };
        }
        const reasons = [];
        let shouldApprove = false;
        let confidence = analysis.confidence;
        const minConfidence = settings.min_confidence || 70;
        // Check if it's a valid payment proof
        if (!analysis.validation.isPaymentProof) {
            reasons.push('Gambar tidak terdeteksi sebagai bukti transfer yang valid');
            return { shouldApprove: false, confidence: 0, reasons };
        }
        // Check risk level
        if (analysis.validation.riskLevel === 'high') {
            reasons.push('Tingkat risiko tinggi terdeteksi');
            reasons.push(...analysis.validation.riskReasons);
            return { shouldApprove: false, confidence: 0, reasons };
        }
        // Check amount match
        if (!analysis.validation.amountMatches && analysis.extractedData.amount) {
            reasons.push('Nominal tidak sesuai dengan yang diharapkan');
            confidence -= 20;
        }
        // Check bank match (if specified)
        if (!analysis.validation.bankMatches && analysis.extractedData.bank) {
            reasons.push('Bank/metode transfer tidak sesuai');
            confidence -= 10;
        }
        // Check if recent
        if (!analysis.validation.isRecent) {
            reasons.push('Bukti transfer terlalu lama');
            confidence -= 15;
        }
        // Decision logic based on settings
        const riskThreshold = settings.risk_threshold || 'medium';
        const riskLevels = ['low', 'medium', 'high'];
        const currentRiskIndex = riskLevels.indexOf(analysis.validation.riskLevel);
        const thresholdIndex = riskLevels.indexOf(riskThreshold);
        if (currentRiskIndex <= thresholdIndex && confidence >= minConfidence) {
            shouldApprove = true;
            reasons.push(`Bukti transfer valid dengan confidence ${confidence}%`);
            reasons.push(`Tingkat risiko: ${analysis.validation.riskLevel}`);
        }
        else {
            shouldApprove = false;
            if (confidence < minConfidence) {
                reasons.push(`Confidence score terlalu rendah (${confidence}% < ${minConfidence}%)`);
            }
            if (currentRiskIndex > thresholdIndex) {
                reasons.push(`Tingkat risiko terlalu tinggi (${analysis.validation.riskLevel} > ${riskThreshold})`);
            }
        }
        return {
            shouldApprove,
            confidence: Math.max(0, Math.min(100, confidence)),
            reasons
        };
    }
}
exports.GeminiService = GeminiService;
GeminiService.genAI = null;
GeminiService.model = null;
