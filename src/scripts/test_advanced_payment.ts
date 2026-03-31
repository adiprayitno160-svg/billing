import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { AdvancedPaymentVerificationService } from '../services/ai/AdvancedPaymentVerificationService';

// I need an image buffer of a transfer. Empty buffer will fail OCR. I'll pass a dummy test image or mock it.
// Actually, let's just make a very basic image or read a dummy issue.
// No, I will just mock the "stageExtraction" of AdvancedPaymentVerificationService.

async function mockTest() {
    const [cRows] = await databasePool.query<RowDataPacket[]>('SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1', ['%joko%']);
    if (cRows.length === 0) {
        console.log("Customer not found");
        process.exit();
    }
    const customer = cRows[0];
    console.log(`Testing for Customer: ${customer.name} (ID: ${customer.id})`);

    const imageBuffer = Buffer.from('fake-image-data', 'utf-8');

    // MOCK extraction to pretend Gemini worked
    (AdvancedPaymentVerificationService as any).stageExtraction = async (buffer: any, cid: any) => {
        return {
            passed: true,
            confidence: 90,
            details: {
                source: 'gemini',
                amount: 150000, // Typical payment amount
                bank: 'BCA',
                isPaymentProof: true,
                date: new Date().toISOString()
            },
            warnings: []
        };
    };

    // MOCK validation to pretend Gemini gave medium risk (because it's just a general transfer)
    (AdvancedPaymentVerificationService as any).stageValidation = async (buffer: any, invoice: any, extract: any) => {
        return {
            passed: true,
            confidence: 65, // Below 70
            details: {
                riskLevel: 'medium', // Not critical, not low
                riskScore: 50,
                fraudIndicators: [],
                isPaymentProof: true,
                amountMatches: true,
                isRecent: true
            },
            warnings: ['Nama penerima tidak spesifik']
        };
    };

    // Replace the real checkReferenceNumber avoiding real DB logic causing issues if mock is bad
    (AdvancedPaymentVerificationService as any).checkReferenceNumber = async (ref: string) => false;
    (AdvancedPaymentVerificationService as any).verifyDateTime = async (d: any, t: any) => true;

    // Make stage Matching return exact match for 150000
    const originalMatching = (AdvancedPaymentVerificationService as any).stageMatching;
    (AdvancedPaymentVerificationService as any).stageMatching = async (cid: any, amnt: any, spc: any) => {
        const res = await originalMatching.call(AdvancedPaymentVerificationService, cid, amnt, spc);
        if(!res.passed) {
            console.log("Mocking match success because original failed (maybe no invoice right now)");
            return {
                passed: true,
                confidence: 100,
                details: {
                    invoice: { id: 999, invoice_number: 'INV-TEST', remaining_amount: 150000, total_amount: 150000 },
                    isPaymentRequest: false,
                    matchType: 'exact',
                    extractedAmount: 150000,
                    expectedAmount: 150000
                },
                warnings: []
            };
        }
        return res;
    };

    const result = await AdvancedPaymentVerificationService.verifyPaymentAdvanced(
        imageBuffer,
        customer.id
    );

    console.log("RESULTS:", JSON.stringify(result, null, 2));
    process.exit();
}

mockTest().catch(console.error);
