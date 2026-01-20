/**
 * Gemini Service
 * Integration with Google Gemini API for payment proof analysis
 * Uses Gemini Vision API to analyze payment proof images
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AISettingsService } from './AISettingsService';
import { FraudDetectionPrompts } from '../ai/FraudDetectionPrompts';

export interface GeminiAnalysisResult {
    isValid: boolean;
    confidence: number;
    extractedData: {
        amount?: number;
        date?: string;
        time?: string;
        bank?: string;
        accountNumber?: string;
        accountHolder?: string;
        referenceNumber?: string;
        transferMethod?: string; // e.g., "Brimo", "Bank Transfer", "E-Wallet"
    };
    validation: {
        isPaymentProof: boolean;
        isRecent: boolean;
        amountMatches: boolean;
        bankMatches: boolean;
        isExactMatch?: boolean;
        riskLevel: 'low' | 'medium' | 'high';
        riskReasons: string[];
    };
    rawResponse: any;
}

export class GeminiService {
    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    /**
     * Reset model (call this when settings change)
     */
    static resetModel(): void {
        this.model = null;
        this.genAI = null;
        console.log('🔄 Gemini model reset');
    }

    /**
     * Initialize Gemini API (reads from database)
     */
    private static async initialize(): Promise<void> {
        if (this.model) {
            return; // Already initialized
        }

        // Check if AI is enabled
        const isEnabled = await AISettingsService.isEnabled();
        if (!isEnabled) {
            throw new Error('AI is not enabled or API key is not set');
        }

        // Get API key from database (with env fallback)
        const apiKey = await AISettingsService.getAPIKey();

        console.log(`[GeminiService] Initializing...`);
        console.log(`[GeminiService] AI Enabled: ${isEnabled}`);

        if (!apiKey || apiKey.trim() === '') {
            console.error('[GeminiService] ❌ API Key is MISSING or EMPTY (checked DB and .env)');
            throw new Error('Gemini API key is not configured. Please set it in Settings > AI Settings');
        } else {
            console.log(`[GeminiService] ✅ API Key found (Length: ${apiKey.length})`);
        }

        // Get settings for model name
        const settings = await AISettingsService.getSettings();
        const modelName = settings?.model || 'gemini-flash-latest';

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: modelName });
            console.log(`✅ Gemini API initialized with model: ${modelName}`);
        } catch (error) {
            console.error('❌ Failed to initialize Gemini API:', error);
            throw new Error('Failed to initialize Gemini API');
        }
    }

    /**
     * Check if AI analysis is enabled
     */
    static async isEnabled(): Promise<boolean> {
        try {
            return await AISettingsService.isEnabled();
        } catch (error) {
            return false;
        }
    }

    /**
     * Analyze payment proof image using Gemini Vision
     * Enhanced with comprehensive fraud detection
     */
    static async analyzePaymentProof(
        imageBuffer: Buffer,
        expectedAmount?: number,
        expectedBank?: string,
        customerName?: string,
        invoiceNumber?: string,
        expectedRecipientName?: string,
        isPrepaid?: boolean
    ): Promise<GeminiAnalysisResult> {
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
            const prompt = this.buildAnalysisPrompt(
                expectedAmount,
                expectedBank,
                customerName,
                invoiceNumber
            );

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

            return {
                ...analysisResult,
                rawResponse: text
            };

        } catch (error) {
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
    private static buildAnalysisPrompt(
        expectedAmount?: number,
        expectedBank?: string,
        customerName?: string,
        invoiceNumber?: string,
        expectedRecipientName?: string,
        isPrepaid?: boolean
    ): string {
        // Use comprehensive fraud detection prompt
        const currentDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        return FraudDetectionPrompts.getPaymentProofVerificationPrompt(
            expectedAmount,
            expectedBank,
            customerName,
            invoiceNumber,
            expectedRecipientName,
            isPrepaid,
            currentDate
        );
    }

    /**
     * Parse Gemini response to structured data
     */
    private static parseGeminiResponse(
        responseText: string,
        expectedAmount?: number,
        expectedBank?: string
    ): Omit<GeminiAnalysisResult, 'rawResponse'> {
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
            const riskLevel = parsed.riskLevel || parsed.validation?.riskLevel || 'high';
            const riskScore = parsed.riskScore || 0;
            const fraudIndicators = parsed.fraudIndicators || [];

            const result: Omit<GeminiAnalysisResult, 'rawResponse'> = {
                isValid: parsed.isValid === true,
                confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
                extractedData: {
                    amount: parsed.extractedData?.amount ? parseFloat(parsed.extractedData.amount) : undefined,
                    date: parsed.extractedData?.date,
                    time: parsed.extractedData?.time,
                    bank: parsed.extractedData?.bank,
                    accountNumber: parsed.extractedData?.accountNumber,
                    accountHolder: parsed.extractedData?.accountHolder,
                    referenceNumber: parsed.extractedData?.referenceNumber,
                    transferMethod: parsed.extractedData?.transferMethod
                },
                validation: {
                    isPaymentProof: parsed.validation?.isPaymentProof === true,
                    isRecent: parsed.validation?.isRecent === true,
                    amountMatches: parsed.validation?.amountMatches === true,
                    bankMatches: parsed.validation?.bankMatches === true,
                    isExactMatch: parsed.validation?.isExactMatch === true,
                    riskLevel: ['low', 'medium', 'high', 'critical'].includes(riskLevel)
                        ? riskLevel as 'low' | 'medium' | 'high'
                        : 'high',
                    riskReasons: Array.isArray(parsed.validation?.riskReasons)
                        ? parsed.validation.riskReasons
                        : (fraudIndicators.length > 0
                            ? fraudIndicators.map((ind: any) => ind.description || ind).filter(Boolean)
                            : [])
                }
            };

            // Store additional data if available (for future use)
            if (riskScore > 0) {
                (result as any).riskScore = riskScore;
            }
            if (fraudIndicators.length > 0) {
                (result as any).fraudIndicators = fraudIndicators;
            }
            if (parsed.recommendation) {
                (result as any).recommendation = parsed.recommendation;
            }
            if (parsed.reasoning) {
                (result as any).reasoning = parsed.reasoning;
            }

            // Additional validation (STRICT)
            if (expectedAmount && result.extractedData.amount) {
                const amountDiff = Math.abs(result.extractedData.amount - expectedAmount);
                const tolerance = 100; // Almost exact match (e.g., Rp 150.000 vs Rp 150.045)
                result.validation.amountMatches = amountDiff <= tolerance;

                // Set isExactMatch for very close matches
                (result.validation as any).isExactMatch = amountDiff <= 10;
            }

            if (expectedBank && result.extractedData.bank) {
                result.validation.bankMatches = result.extractedData.bank
                    .toLowerCase()
                    .includes(expectedBank.toLowerCase());
            }

            return result;

        } catch (error) {
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
    private static detectMimeType(buffer: Buffer): string {
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
    static async shouldAutoApprove(analysis: GeminiAnalysisResult): Promise<{
        shouldApprove: boolean;
        confidence: number;
        reasons: string[];
    }> {
        // Get settings from database
        const settings = await AISettingsService.getSettings();
        if (!settings || !settings.auto_approve_enabled) {
            return {
                shouldApprove: false,
                confidence: 0,
                reasons: ['Auto-approve dinonaktifkan di pengaturan']
            };
        }

        const reasons: string[] = [];
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
        } else {
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

