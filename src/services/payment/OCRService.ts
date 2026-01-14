/**
 * OCR Service
 * Extract text from payment proof images using Tesseract.js
 */

// Dynamic imports for optional dependencies
let Tesseract: any;
let sharp: any;

try {
    Tesseract = require('tesseract.js');
    sharp = require('sharp');
} catch (e) {
    console.warn('⚠️ OCR dependencies not installed. Please run: npm install tesseract.js sharp');
}

export interface ExtractedPaymentData {
    amount?: number;
    date?: Date;
    bank?: string;
    accountHolder?: string;
    accountNumber?: string;
    referenceNumber?: string;
    confidence: number;
    rawText: string;
}

export class OCRService {
    /**
     * Extract payment data from image buffer
     */
    static async extractPaymentData(imageBuffer: Buffer): Promise<ExtractedPaymentData> {
        try {
            if (!Tesseract) {
                throw new Error('Tesseract.js not installed. Please run: npm install tesseract.js');
            }

            console.log('🔍 Starting OCR extraction...');

            // Preprocess image for better OCR accuracy
            const processedImage = await this.preprocessImage(imageBuffer);

            // Run OCR with Indonesian language
            const { data: { text, confidence } } = await Tesseract.recognize(
                processedImage,
                'ind+eng',
                {
                    logger: (info: any) => {
                        if (info.status === 'recognizing text') {
                            console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
                        }
                    }
                }
            );

            console.log(`✅ OCR completed. Confidence: ${confidence.toFixed(2)}%`);

            // Extract payment details from text
            const extractedData = this.parsePaymentText(text, confidence);

            return extractedData;

        } catch (error) {
            console.error('Error in OCR extraction:', error);
            throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Preprocess image for better OCR accuracy
     */
    private static async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
        try {
            if (!sharp) {
                console.warn('Sharp not installed, skipping image preprocessing');
                return imageBuffer;
            }

            // Enhance image: grayscale, sharpen, increase contrast
            const processed = await sharp(imageBuffer)
                .greyscale()
                .normalize()
                .sharpen()
                .toBuffer();

            return processed;
        } catch (error) {
            console.warn('Image preprocessing failed, using original:', error);
            return imageBuffer;
        }
    }

    /**
     * Parse extracted text to extract payment details
     */
    private static parsePaymentText(text: string, confidence: number): ExtractedPaymentData {
        const extracted: ExtractedPaymentData = {
            rawText: text,
            confidence: confidence
        };

        // Normalize text (remove extra spaces, convert to lowercase for matching)
        const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');

        // Extract amount (Rp, IDR, rupiah) - More robust patterns
        const amountPatterns = [
            /rp\s*[.,]?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/gi, // Standard Rp 100.000
            /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)\s*(?:rupiah|idr)/gi, // 100.000 Rupiah
            /nominal[:\s]*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/gi, // Nominal: 100.000
            /total[:\s]*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/gi, // Total: 100.000
            /jumlah[:\s]*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/gi, // Jumlah: 100.000
            /(\d{1,3}(?:\.\d{3}){1,})/g, // Any number like 100.000 (usually large amounts in receipts)
        ];

        let foundAmounts: { value: number, patternIndex: number }[] = [];

        for (let i = 0; i < amountPatterns.length; i++) {
            const pattern = amountPatterns[i];
            const matches = normalizedText.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    const amountStr = match[1].replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount) && amount >= 1000) { // Assume payments are at least 1000
                        foundAmounts.push({ value: amount, patternIndex: i });
                    }
                } else if (match[0]) {
                    // Check if match[0] itself has a number
                    const amountStr = match[0].replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount) && amount >= 1000) {
                        foundAmounts.push({ value: amount, patternIndex: i });
                    }
                }
            }
        }

        // Pick the most likely amount (usually the largest one or the first specific pattern)
        if (foundAmounts.length > 0) {
            // Sort by priority (pattern index) then by value
            foundAmounts.sort((a, b) => {
                if (a.patternIndex !== b.patternIndex) return a.patternIndex - b.patternIndex;
                return b.value - a.value;
            });
            extracted.amount = foundAmounts[0].value;
            console.log(`[OCR] Identified amount: Rp ${extracted.amount.toLocaleString('id-ID')}`);
        }

        // Extract date (various formats)
        const datePatterns = [
            /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/g,
            /(\d{2,4})[-\/](\d{1,2})[-\/](\d{1,2})/g,
            /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{2,4})/gi
        ];

        for (const pattern of datePatterns) {
            const match = normalizedText.match(pattern);
            if (match) {
                try {
                    const dateStr = match[0];
                    const date = new Date(dateStr.replace(/\//g, '-'));
                    if (!isNaN(date.getTime())) {
                        extracted.date = date;
                        break;
                    }
                } catch (e) {
                    // Continue to next pattern
                }
            }
        }

        // Extract bank name
        const banks = ['bca', 'mandiri', 'bri', 'bni', 'cimb', 'dbs', 'uob', 'maybank', 'permata', 'ocbc'];
        for (const bank of banks) {
            if (normalizedText.includes(bank)) {
                extracted.bank = bank.toUpperCase();
                break;
            }
        }

        // Extract account holder name (usually after "nama" or "dari" or "pengirim")
        const namePatterns = [
            /nama[:\s]+([a-z\s]{3,30})/gi,
            /pengirim[:\s]+([a-z\s]{3,30})/gi,
            /dari[:\s]+([a-z\s]{3,30})/gi
        ];

        for (const pattern of namePatterns) {
            const match = normalizedText.match(pattern);
            if (match && match[1]) {
                extracted.accountHolder = match[1].trim();
                break;
            }
        }

        // Extract account number
        const accountPatterns = [
            /rekening[:\s]*(\d{8,16})/gi,
            /no[.\s]*rek[:\s]*(\d{8,16})/gi,
            /account[:\s]*(\d{8,16})/gi
        ];

        for (const pattern of accountPatterns) {
            const match = normalizedText.match(pattern);
            if (match && match[1]) {
                extracted.accountNumber = match[1];
                break;
            }
        }

        // Extract reference number
        const refPatterns = [
            /referensi[:\s]*([a-z0-9]{6,20})/gi,
            /no[.\s]*ref[:\s]*([a-z0-9]{6,20})/gi,
            /ref[:\s]*([a-z0-9]{6,20})/gi
        ];

        for (const pattern of refPatterns) {
            const match = normalizedText.match(pattern);
            if (match && match[1]) {
                extracted.referenceNumber = match[1];
                break;
            }
        }

        return extracted;
    }
}
