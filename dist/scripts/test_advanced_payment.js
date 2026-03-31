"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
const AdvancedPaymentVerificationService_1 = require("../services/ai/AdvancedPaymentVerificationService");
// I need an image buffer of a transfer. Empty buffer will fail OCR. I'll pass a dummy test image or mock it.
// Actually, let's just make a very basic image or read a dummy issue.
// No, I will just mock the "stageExtraction" of AdvancedPaymentVerificationService.
async function mockTest() {
    const [cRows] = await pool_1.databasePool.query('SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1', ['%joko%']);
    if (cRows.length === 0) {
        console.log("Customer not found");
        process.exit();
    }
    const customer = cRows[0];
    console.log(`Testing for Customer: ${customer.name} (ID: ${customer.id})`);
    const imageBuffer = Buffer.from('fake-image-data', 'utf-8');
    // MOCK extraction to pretend Gemini worked
    AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.stageExtraction = async (buffer, cid) => {
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
    AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.stageValidation = async (buffer, invoice, extract) => {
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
    AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.checkReferenceNumber = async (ref) => false;
    AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.verifyDateTime = async (d, t) => true;
    // Make stage Matching return exact match for 150000
    const originalMatching = AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.stageMatching;
    AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.stageMatching = async (cid, amnt, spc) => {
        const res = await originalMatching.call(AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService, cid, amnt, spc);
        if (!res.passed) {
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
    const result = await AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.verifyPaymentAdvanced(imageBuffer, customer.id);
    console.log("RESULTS:", JSON.stringify(result, null, 2));
    process.exit();
}
mockTest().catch(console.error);
//# sourceMappingURL=test_advanced_payment.js.map