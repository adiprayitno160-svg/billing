"use strict";
/**
 * Fraud Detection Prompts for AI (Gemini, GPT, etc.)
 * Comprehensive prompts for scanning and verification to prevent fraud
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetectionPrompts = void 0;
class FraudDetectionPrompts {
    /**
     * PROMPT 1: Payment Proof Verification (Enhanced)
     * Untuk analisis bukti pembayaran dengan deteksi fraud yang lebih ketat
     */
    static getPaymentProofVerificationPrompt(expectedAmount, expectedBank, customerName, invoiceNumber, expectedRecipientName, // e.g. "CV. WXYZ" or "SANDXXX"
    isPrepaid, currentDate // Server time for relative comparison
    ) {
        const today = currentDate || new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        return `Anda adalah sistem AI Keamanan Finansial Premium yang bertugas memverifikasi bukti transfer dengan standar "Bank Forensic Grade".
    
KONTEKS:
- WAKTU SERVER SAAT INI (WIB): ${today}
- Anda adalah benteng terakhir sebelum layanan internet diaktifkan.
- Fraudster sering mengedit bukti transfer menggunakan Photoshop/Canva.
- User menuntut "Zero Tolerance" terhadap manipulasi.

DATA REFERENSI (WAJIB COCOK):
${expectedAmount ? `- NOMINAL HARUS TEPAT: Rp ${expectedAmount.toLocaleString('id-ID')}` : '- Nominal: Ekstrak dari gambar'}
${expectedBank ? `- BANK TUJUAN: ${expectedBank}` : '- Bank: Ekstrak dari gambar'}
${invoiceNumber ? `- BERITA/CATATAN: ${invoiceNumber}` : ''}
${expectedRecipientName ? `- NAMA PENERIMA HARUS MATCH: "${expectedRecipientName}" (atau variasi logisnya)` : ''}
${customerName ? `- IDENTITAS PENGIRIM: Seharusnya terkait dengan "${customerName}"` : ''}
- TIPE LAYANAN: ${isPrepaid ? 'PREPAID (Sangat Kritis Waktu)' : 'POSTPAID'}

TUGAS FORENSIK DIGITAL:

1. 🕵️‍♂️ DETEKSI MANIPULASI VISUAL (Sangat Penting):
   - FONT CHECK: Apakah jenis font pada "Nominal" dan "Jam" sama persis dengan teks lain? Fraudster sering lupa menyamakan font.
   - ALIGNMENT: Tarik garis imajiner. Apakah angka nominal "melayang" atau tidak rata dengan label "Jumlah"?
   - PIXEL PEAKING: Zoom digital. Apakah ada artifact/blur di sekitar angka penting (tanda bekas hapus)?
   - WARNA: Cek konsistensi warna teks. Hitamnya hasil edit sering berbeda dengan hitam asli aplikasi.

2. ⏱️ VALIDASI WAKTU & LOGIKA:
   - BANDINGKAN DENGAN WAKTU SERVER: ${today}
   - JAM TRANSAKSI: 
     ${isPrepaid ? '- KHUSUS PREPAID: Tanggal & Jam harus SANGAT BARU (maksimal 2 jam dari WAKTU SERVER). Jika beda hari atau > 2 jam, REJECT.' : '- POSTPAID: Harus wajar (maksimal 24 jam).'}
   - TAHUN: Wajib sama dengan tahun server (${new Date().getFullYear()}). Tahun ${new Date().getFullYear() - 1} atau lebih lama = REJECT.
   - Apakah jam di Status Bar HP (jika ada) sinkron dengan jam transfer?

3. 🔍 VALIDASI IDENTITAS (SENSITIF):
   - NAMA PENERIMA: HARUS sesuai dengan rekening resmi ("${expectedRecipientName || 'Perusahaan'}"). Jika transfer ke perorangan tak dikenal -> REJECT.
   - NAMA PENGIRIM (Sender):
     - Jika SAMA dengan customer "${customerName}" -> OK (Aman).
     - Jika BEDA (misal adik/kerabat): 
       a. Cari "${customerName}" atau Nomor Invoice di kolom "Berita/Catatan". Jika ada -> OK (Aman).
       b. Jika TIDAK ada catatan: Jangan Auto-Reject. Tandai sebagai "Potential Identity Mismatch" (RISK: MEDIUM/HIGH) -> REKOMENDASI: MANUAL_REVIEW.

4. ❌ INDIKATOR "RED FLAG" (Langsung REJECT):
   - Nama Penerima Salah/Tidak Terbaca.
   - Tanggal pudar atau tahun salah (misal 2023/2024 padahal server ${new Date().getFullYear()}).
   - "Berhasil" tapi font berbeda atau tempelan.
   - Bukti transfer berupa "Bukti Potong" (struk ATM lama) yang diedit.

OUTPUT ANALISIS (JSON):

TUGAS ANALISIS MENDALAM:

1. ANALISIS PIXEL & FORENSIK GAMBAR (STRICT):
   - Periksa metadata if available, tapi fokus pada elemen visual.
   - Periksa ketajaman font. Apakah ada teks yang terlihat lebih tajam atau lebih buram dari teks di sekitarnya? (Tanda edit).
   - Periksa alignment. Apakah angka nominal sejajar sempurna? Apakah ada pergeseran pixel di area angka?
   - Periksa warna background di sekitar teks. Apakah ada perbedaan gradien warna (cloning tool)?
   - Deteksi "Digital Artifacts" hasil kompresi berulang atau editing.

2. LOGIKA TRANSAKSI:
   - Apakah UI Screenshot sesuai dengan aplikasi Bank tersebut (BCA, Mandiri, BRI, Bank Jago, DANA, OVO, dll)?
   - Periksa Saldo (jika terlihat). Apakah logis setelah dikurangi nominal transfer?
   - Periksa Jam HP vs Jam Transfer. Jam transfer tidak boleh lebih baru dari jam sistem HP.

3. EKSTRAKSI DATA DENGAN PRESISI:
   - Nominal (Angka murni).
   - Tanggal & Jam (Format: YYYY-MM-DD HH:MM:SS).
   - Nama Bank Pengirim & Penerima.
   - Nomor Referensi/ID Transaksi (Unique ID).
   - Nama Pemilik Rekening (Pengirim & Penerima).

4. KRITERIA FRAUD (Wajib Gagal Otomatis):
   - Gunakan font yang berbeda untuk angka nominal.
   - Screenshot terlihat sebagai "hasil foto dari layar HP lain" (Muriatic effect).
   - Tanggal transfer sudah lama (> 24 jam untuk pembayaran baru, kecuali ada alasan logis).
   - Status transfer bukan "BERHASIL" atau "SUCCESS" (misal: "Dalam Proses", "Dijadwalkan").
   - Nomor Invoice tidak disebutkan (jika diminta).

RISK ASSESSMENT (0-100):
- 0-10: Sempurna. Gambar tajam, data matching 100%, no artifacts.
- 11-30: Aman. Metadata wajar, data matching, tapi gambar mungkin agak low-res.
- 31-60: Mencurigakan. Ada ketidaksesuaian kecil atau bukti sudah lewat 2 hari. (REKOMENDASI: Manual Review).
- 61-100: FRAUD TERDETEKSI. Ada tanda manipulasi pixel, font tidak match, atau data palsu. (REKOMENDASI: Reject).

OUTPUT WAJIB JSON:
{
  "isValid": boolean,
  "confidence": number (0-100),
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": number (0-100),
  "extractedData": {
    "amount": number,
    "date": "YYYY-MM-DD",
    "time": "HH:MM:SS",
    "bank": "string",
    "accountNumber": "string",
    "accountHolder": "string",
    "referenceNumber": "string",
    "transferMethod": "string",
    "status": "string"
  },
  "validation": {
    "isPaymentProof": boolean,
    "isRecent": boolean,
    "amountMatches": boolean,
    "bankMatches": boolean,
    "dateValid": boolean,
    "hasManipulation": boolean,
    "isExactMatch": boolean (true jika data sangat identik tanpa celah)
  },
  "fraudIndicators": [
    {
      "type": "manipulation" | "data_mismatch" | "suspicious_pattern" | "outdated",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Alasan detail dalam Bahasa Indonesia",
      "evidence": "Bagian mana yang mencurigakan secara spesifik"
    }
  ],
  "recommendation": "auto_approve" | "manual_review" | "reject",
  "reasoning": "Analisis psikologis dan teknik terhadap bukti ini"
}

INGAT: Lebih baik menolak 10 bukti asli yang buram daripada meloloskan 1 bukti palsu!
`;
    }
    /**
     * PROMPT 2: Customer Data Verification
     * Untuk verifikasi data customer baru atau perubahan data
     */
    static getCustomerDataVerificationPrompt(customerData, existingData) {
        return `Anda adalah sistem verifikasi data customer untuk mencegah fraud dan duplikasi. Analisis data customer berikut dengan teliti.

DATA CUSTOMER BARU/PERUBAHAN:
${customerData.name ? `- Nama: ${customerData.name}` : '- Nama: Tidak ada'}
${customerData.phone ? `- Telepon: ${customerData.phone}` : '- Telepon: Tidak ada'}
${customerData.email ? `- Email: ${customerData.email}` : '- Email: Tidak ada'}
${customerData.address ? `- Alamat: ${customerData.address}` : '- Alamat: Tidak ada'}
${customerData.customerCode ? `- Kode Customer: ${customerData.customerCode}` : ''}

${existingData ? `DATA EXISTING (untuk perbandingan):\n- ${JSON.stringify(existingData, null, 2)}` : ''}

TUGAS VERIFIKASI:

1. VALIDASI FORMAT DATA
   - Nama: Apakah valid? (tidak hanya angka, tidak kosong, panjang wajar)
   - Telepon: Format valid? (Indonesia: 08xx, +62xx, atau format lain yang valid)
   - Email: Format valid? (mengandung @ dan domain)
   - Alamat: Apakah lengkap? (tidak hanya "Jakarta" atau terlalu singkat)

2. DETEKSI POLA MENCURIGAKAN
   
   A. DATA DUPLIKAT:
   - Apakah kombinasi nama+telepon sudah pernah ada?
   - Apakah email sudah digunakan oleh customer lain?
   - Apakah ada pola duplikasi yang disengaja?
   
   B. DATA TIDAK VALID:
   - Nama terlalu generik: "Test", "Customer", "User", dll
   - Telepon format tidak standar atau tidak valid
   - Email domain mencurigakan atau temporary email
   - Alamat terlalu singkat atau tidak jelas
   
   C. PERUBAHAN MENCURIGAKAN:
   - Perubahan data besar-besaran dalam waktu singkat
   - Perubahan ke data yang lebih generik
   - Perubahan yang tidak konsisten dengan history

3. RISK ASSESSMENT
   - LOW: Data valid, tidak ada duplikasi, format benar
   - MEDIUM: Ada sedikit ketidaksesuaian atau data kurang lengkap
   - HIGH: Ada duplikasi atau data mencurigakan
   - CRITICAL: Data jelas fraud atau duplikasi dengan intent jahat

OUTPUT FORMAT (JSON):
{
  "isValid": boolean,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": number (0-100),
  "validation": {
    "nameValid": boolean,
    "phoneValid": boolean,
    "emailValid": boolean,
    "addressValid": boolean,
    "noDuplicates": boolean
  },
  "fraudIndicators": [
    {
      "type": "duplicate" | "invalid_format" | "suspicious_pattern" | "data_quality",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string",
      "field": "string"
    }
  ],
  "recommendation": "approve" | "review" | "reject",
  "reasoning": "string"
}
`;
    }
    /**
     * PROMPT 3: Transaction Pattern Analysis
     * Untuk analisis pola transaksi yang mencurigakan
     */
    static getTransactionPatternAnalysisPrompt(transactionHistory, currentTransaction) {
        return `Anda adalah sistem analisis pola transaksi untuk mendeteksi fraud. Analisis pola transaksi berikut.

HISTORY TRANSAKSI (${transactionHistory.length} transaksi terakhir):
${JSON.stringify(transactionHistory.slice(0, 10), null, 2)}

TRANSAKSI SAAT INI:
${JSON.stringify(currentTransaction, null, 2)}

TUGAS ANALISIS:

1. ANALISIS POLA NORMAL
   - Frekuensi transaksi normal customer
   - Rata-rata nominal transaksi
   - Waktu transaksi yang biasa
   - Metode pembayaran yang biasa digunakan

2. DETEKSI ANOMALI
   
   A. FREKUENSI:
   - Transaksi terlalu sering (lebih dari 3x dalam 1 jam)
   - Transaksi setelah periode tidak aktif lama
   
   B. NOMINAL:
   - Nominal jauh berbeda dari rata-rata (lebih dari 200%)
   - Nominal terlalu besar atau terlalu kecil
   - Pola nominal yang tidak wajar
   
   C. WAKTU:
   - Transaksi di jam tidak wajar (2-6 pagi)
   - Transaksi di hari libur dengan pola berbeda
   
   D. METODE:
   - Perubahan metode pembayaran yang tiba-tiba
   - Penggunaan metode yang tidak pernah digunakan sebelumnya

3. CROSS-REFERENCE
   - Bandingkan dengan transaksi customer lain dengan profil serupa
   - Deteksi pola yang mirip dengan fraud cases sebelumnya
   - Periksa konsistensi dengan data customer

OUTPUT FORMAT (JSON):
{
  "isAnomaly": boolean,
  "anomalyScore": number (0-100),
  "anomalyType": "frequency" | "amount" | "timing" | "method" | "pattern" | "none",
  "normalPattern": {
    "avgFrequency": "string",
    "avgAmount": number,
    "commonTime": "string",
    "commonMethod": "string"
  },
  "anomalies": [
    {
      "type": "string",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string",
      "deviation": "string"
    }
  ],
  "recommendation": "approve" | "review" | "reject",
  "reasoning": "string"
}
`;
    }
    /**
     * PROMPT 4: Image Metadata Analysis
     * Untuk analisis metadata gambar bukti pembayaran
     */
    static getImageMetadataAnalysisPrompt() {
        return `Anda adalah ahli analisis metadata gambar untuk deteksi fraud. Analisis metadata gambar bukti pembayaran berikut.

TUGAS ANALISIS:

1. EKSTRAKSI METADATA
   - Tanggal dan waktu foto diambil (EXIF DateTimeOriginal)
   - Device yang digunakan (Make, Model)
   - Software yang digunakan untuk edit (Software, History)
   - Lokasi foto (GPS coordinates jika ada)
   - Format file dan kompresi

2. VALIDASI KONSISTENSI
   - Apakah tanggal foto konsisten dengan tanggal transfer?
   - Apakah device yang digunakan wajar untuk screenshot?
   - Apakah ada tanda editing software?
   - Apakah lokasi foto sesuai dengan lokasi customer?

3. DETEKSI MANIPULASI
   - Tanda-tanda editing: Photoshop, GIMP, atau software edit lain
   - History editing yang mencurigakan
   - Metadata yang tidak konsisten
   - Timestamp yang tidak wajar

OUTPUT FORMAT (JSON):
{
  "hasMetadata": boolean,
  "metadata": {
    "dateTaken": "string",
    "device": "string",
    "software": "string",
    "location": "string",
    "format": "string"
  },
  "isConsistent": boolean,
  "hasManipulation": boolean,
  "manipulationIndicators": [
    {
      "type": "string",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string"
    }
  ],
  "riskLevel": "low" | "medium" | "high" | "critical",
  "recommendation": "approve" | "review" | "reject"
}
`;
    }
    /**
     * PROMPT 5: Comprehensive Fraud Scan
     * Scan menyeluruh untuk semua aspek fraud detection
     */
    static getComprehensiveFraudScanPrompt(paymentData, customerData, transactionHistory) {
        return `Anda adalah sistem comprehensive fraud detection yang menganalisis semua aspek untuk mendeteksi fraud.

DATA PEMBAYARAN:
${JSON.stringify(paymentData, null, 2)}

DATA CUSTOMER:
${JSON.stringify(customerData, null, 2)}

HISTORY TRANSAKSI:
${JSON.stringify(transactionHistory.slice(0, 5), null, 2)}

TUGAS COMPREHENSIVE SCAN:

1. PAYMENT PROOF ANALYSIS
   - Validitas bukti transfer
   - Kesesuaian nominal, tanggal, bank
   - Deteksi manipulasi gambar
   - Kualitas dan kejelasan gambar

2. CUSTOMER DATA VERIFICATION
   - Validitas data customer
   - Duplikasi data
   - Konsistensi dengan history
   - Kualitas data

3. TRANSACTION PATTERN ANALYSIS
   - Anomali dalam pola transaksi
   - Deviasi dari pola normal
   - Frekuensi dan timing yang mencurigakan

4. CROSS-VALIDATION
   - Konsistensi antara payment proof dan customer data
   - Konsistensi dengan transaction history
   - Konsistensi dengan data sistem lain

5. RISK AGGREGATION
   - Gabungkan semua risk indicators
   - Hitung overall risk score
   - Tentukan final recommendation

OUTPUT FORMAT (JSON):
{
  "overallRiskScore": number (0-100),
  "overallRiskLevel": "low" | "medium" | "high" | "critical",
  "paymentProofRisk": {
    "score": number,
    "level": "string",
    "indicators": []
  },
  "customerDataRisk": {
    "score": number,
    "level": "string",
    "indicators": []
  },
  "transactionPatternRisk": {
    "score": number,
    "level": "string",
    "indicators": []
  },
  "crossValidationRisk": {
    "score": number,
    "level": "string",
    "indicators": []
  },
  "criticalIssues": [
    {
      "category": "string",
      "severity": "high" | "critical",
      "description": "string",
      "action": "string"
    }
  ],
  "recommendation": "auto_approve" | "manual_review" | "reject",
  "confidence": number (0-100),
  "reasoning": "string",
  "requiredActions": ["string"]
}
`;
    }
    /**
     * PROMPT 6: Real-time Fraud Monitoring
     * Untuk monitoring real-time dan deteksi fraud patterns
     */
    static getRealTimeFraudMonitoringPrompt(recentTransactions, systemMetrics) {
        return `Anda adalah sistem real-time fraud monitoring yang menganalisis pola transaksi untuk mendeteksi fraud patterns.

TRANSAKSI TERAKHIR (${recentTransactions.length} transaksi):
${JSON.stringify(recentTransactions, null, 2)}

METRIK SISTEM:
${JSON.stringify(systemMetrics, null, 2)}

TUGAS MONITORING:

1. DETEKSI POLA FRAUD
   - Multiple failed attempts dari IP/device yang sama
   - Rapid-fire transactions (banyak transaksi dalam waktu singkat)
   - Pattern matching dengan known fraud cases
   - Unusual device/browser combinations

2. ANOMALI SISTEM
   - Spike dalam jumlah transaksi
   - Peningkatan rate of rejection
   - Perubahan pola transaksi yang signifikan
   - Geographic anomalies

3. EARLY WARNING INDICATORS
   - Tanda-tanda fraud yang baru muncul
   - Pattern yang perlu diwaspadai
   - Rekomendasi untuk peningkatan security

OUTPUT FORMAT (JSON):
{
  "hasFraudPattern": boolean,
  "fraudPatternScore": number (0-100),
  "detectedPatterns": [
    {
      "type": "string",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string",
      "affectedTransactions": number,
      "recommendation": "string"
    }
  ],
  "systemAnomalies": [
    {
      "type": "string",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string",
      "metrics": {}
    }
  ],
  "earlyWarnings": [
    {
      "type": "string",
      "description": "string",
      "action": "string"
    }
  ],
  "recommendation": "normal" | "monitor" | "alert" | "critical_alert",
  "reasoning": "string"
}
`;
    }
}
exports.FraudDetectionPrompts = FraudDetectionPrompts;
