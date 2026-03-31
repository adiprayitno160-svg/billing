import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import * as crypto from 'crypto';
import { ChatBotService } from '../ai/ChatBotService';

/**
 * Service to verify payment proof images using a combination of OCR (stub) and Gemini Vision.
 * Returns detailed verification data and a fraud score (0 = no fraud, 1 = high fraud).
 */
export class PaymentProofVerificationService {
    /**
     * Verify the image buffer.
     * @param buffer Image buffer of the payment proof.
     * @param expectedAmount Amount that the user is expected to pay (from session).
     * @param customerId ID of the customer (optional, used for duplicate check).
     */
    static async verify(
        buffer: Buffer,
        expectedAmount: number,
        customerName: string,
        customerPhone: string
    ): Promise<{
        status: 'auto_approved' | 'manual_review' | 'rejected';
        message: string;
        extractedData?: any;
        proofHash?: string;
    }> {
        const { AISettingsService } = await import('../payment/AISettingsService');
        const settings = await AISettingsService.getSettings();

        const proofHash = crypto.createHash('sha256').update(buffer).digest('hex');
        const [dupRows] = await databasePool.query<RowDataPacket[]>(
            `SELECT id, invoice_number FROM invoices WHERE proof_image_hash = ? AND status = 'paid' LIMIT 1`,
            [proofHash]
        );

        if (dupRows.length > 0) {
            return {
                status: 'rejected',
                message: `⚠️ Bukti DUPLIKAT! Sudah dipakai di Invoice #${dupRows[0].invoice_number}.`,
                proofHash
            };
        }

        const prompt = `
        PERAN: Verifikator Pembayaran Otomatis (Lenient/Toleran).
        TUGAS: Ekstrak data dari gambar struk/bukti transfer ini.

        KONTEKS:
        - Gambar adalah screenshot dari HP (Mobile Banking seperti BRImo, BCA, Dana, dll).
        - Bisa mode GELAP (Dark Mode) atau TERANG.
        - Bisa berupa foto struk ATM kertas.

        INSTRUKSI UTAMA (PENTING):
        1. **Anggap Valid (is_legit_proof: true)** jika:
           - Terdapat kata kunci: "Berhasil", "Sukses", "Transaksi Berhasil", "Transfer", atau "Struk".
           - Terbaca NOMINAL uang.
           - Terbaca TANGGAL (walau format apapun).
        2. JANGAN tandai sebagai FRAUD/PALSU hanya karena:
           - Tampilan mode gelap/dark mode.
           - Font HP pengguna yang unik/kustom.
           - Screenshot yang terpotong sedikit header/footernya.
        
        DATA YANG DIHARAPKAN (Data Pelanggan):
        - Nama Pelanggan: "${customerName}"
        - No HP: "${customerPhone}"
        - Nominal Tagihan: Rp ${expectedAmount.toLocaleString('id-ID')}
        
        INSTRUKSI VALIDASI KHUSUS:
        1. **Cek Nominal**: Harus persis atau selisih dikit (biaya admin).
        2. **Cek Tanggal**: Ekstrak tanggal transaksi. (Jika tanggal lama/tahun lalu, TETAP ANGGAP VALID dokemennya, cukup catat tanggalnya).
        3. **Cek Pengirim**: Siapa nama pengirimnya? (Jika beda, cek apakah ada di catatan).
        4. **Cek Penerima**: Siapa penerimanya?
        5. **Anti-Fraud**: Hanya tandai 'true' jika ada EDITAN KASAR (misal tempelan kotak putih menutupi angka).

        Output JSON:
        {
            "is_legit_proof": true/false,
            "transaction_date": "YYYY-MM-DD",
            "amount": 100000,
            "sender_name_on_proof": "...",
            "receiver_name_on_proof": "...",
            "receiver_account_on_proof": "...",
            "notes_content": "...",
            "name_match_status": "MATCH" | "mismatch_but_found_in_notes" | "NO_MATCH",
            "fraud_indication": true/false,
            "fraud_reason": "...",
            "confidence_score": 0-100,
            "analysis_summary": "..."
        }
        `;


        try {
            const responseText = await ChatBotService.analyzeImage(buffer, 'image/jpeg', prompt);
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const cleanJson = jsonStr.substring(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1);

            const data = JSON.parse(cleanJson);

            // LOGGING EXTRACTION DATA
            console.log('--- [PaymentVerification] Extracted:', JSON.stringify(data, null, 2));

            // Logic Decision
            const extractedAmount = Number(data.amount) || 0;
            const isAmountValid = Math.abs(extractedAmount - expectedAmount) < 2000;

            // Date Check (Relaxed to 60 days)
            let isDateValid = false;
            if (data.transaction_date) {
                const transDate = new Date(data.transaction_date);
                const diffTime = Math.abs(Date.now() - transDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) isDateValid = true; // LOOSENED TO 30 DAYS FOR TESTING IF USER KEEPS GETTING REJECTED
            } else {
                // If AI can't read date, safer to manual review
                isDateValid = false;
            }

            const confidence = Number(data.confidence_score) || 0;
            const isNameValid = data.name_match_status !== 'NO_MATCH';

            // DECISION MATRIX

            // 1. REJECT CONDITIONS (HARD REJECT for Junk/Fraud)
            if (data.fraud_indication || confidence < 15) {
                return {
                    status: 'rejected',
                    message: `❌ Ditolak Sistem: Bukan bukti transfer valid atau terindikasi manipulasi.`,
                    extractedData: data,
                    proofHash
                };
            }

            // 2. AMBIGUOUS PROOF -> MANUAL REVIEW (Soft Reject)
            // If AI says it's not legit proof OR confidence is low (15-50), let Admin decide.
            if (!data.is_legit_proof || confidence <= 50) {
                return {
                    status: 'manual_review',
                    message: '⚠️ Bukti diragukan (Confidence Rendah). Masuk antrian cek manual.',
                    extractedData: data,
                    proofHash
                };
            }

            // 2. MANUAL REVIEW CONDITIONS
            let reviewReasons = [];
            if (!isAmountValid) reviewReasons.push(`Nominal beda (Bukti: ${extractedAmount}, Tagihan: ${expectedAmount})`);
            if (!isDateValid) reviewReasons.push(`Tanggal transaksi kadaluarsa/tidak terbaca (${data.transaction_date})`);
            if (!isNameValid) reviewReasons.push(`Nama pengirim tidak sesuai & tidak ada catatan nama pelanggan.`);

            if (reviewReasons.length > 0) {
                return {
                    status: 'manual_review',
                    message: `⚠️ Bukti diterima tapi butuh verifikasi manual: ${reviewReasons.join(', ')}`,
                    extractedData: data,
                    proofHash
                };
            }

            // 3. AUTO APPROVE
            if (confidence >= 85) {
                // Respect global setting
                if (settings && !settings.auto_approve_enabled) {
                    return {
                        status: 'manual_review',
                        message: '✅ Valid (AI Konfiden), namun Auto-Approve dimatikan di pengaturan.',
                        extractedData: data,
                        proofHash
                    };
                }

                return {
                    status: 'auto_approved',
                    message: '✅ Pembayaran Berhasil Diverifikasi Otomatis.',
                    extractedData: data,
                    proofHash
                };
            }

            // Fallback
            return {
                status: 'manual_review',
                message: '⚠️ AI kurang yakin (Confidence < 85%), mohon cek manual.',
                extractedData: data,
                proofHash
            };

        } catch (error) {
            console.error(error);
            return { status: 'manual_review', message: 'Gagal analisis AI, silakan cek manual.', proofHash };
        }
    }
}
