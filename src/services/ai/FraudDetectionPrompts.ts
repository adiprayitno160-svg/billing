/**
 * Fraud Detection Prompts for AI (Gemini, GPT, etc.)
 * Comprehensive prompts for scanning and verification to prevent fraud
 */

export class FraudDetectionPrompts {

  /**
   * PROMPT 1: Payment Proof Verification (Enhanced)
   * Untuk analisis bukti pembayaran dengan deteksi fraud yang lebih ketat
   */
  static getPaymentProofVerificationPrompt(
    expectedAmount?: number,
    expectedBank?: string,
    customerName?: string,
    invoiceNumber?: string
  ): string {
    return `Anda adalah ahli analisis bukti pembayaran digital dan deteksi fraud yang berpengalaman. Tugas Anda adalah menganalisis gambar bukti transfer dengan sangat teliti untuk mendeteksi potensi fraud.

KONTEKS SISTEM:
- Sistem billing internet service provider
- Verifikasi pembayaran invoice
- Target: Deteksi fraud dengan akurasi tinggi

DATA YANG DIHARAPKAN:
${expectedAmount ? `- Nominal yang diharapkan: Rp ${expectedAmount.toLocaleString('id-ID')}` : '- Nominal: Tidak ditentukan'}
${expectedBank ? `- Bank yang diharapkan: ${expectedBank}` : '- Bank: Tidak ditentukan'}
${customerName ? `- Nama pelanggan: ${customerName}` : ''}
${invoiceNumber ? `- Nomor invoice/tagihan: ${invoiceNumber}` : ''}
- Tipe transaksi: Pembayaran Invoice

TUGAS ANALISIS (URUTAN PRIORITAS):

1. VERIFIKASI AUTENTIKASI BUKTI TRANSFER
   - Apakah ini benar-benar screenshot/bukti transfer yang valid?
   - Identifikasi platform: Brimo, Mobile Banking, E-Wallet (OVO, DANA, GoPay, dll), atau Bank Transfer
   - Periksa elemen visual standar: logo bank, watermark, timestamp, UI aplikasi
   - Deteksi apakah ini screenshot asli atau hasil edit/manipulasi
   - Periksa konsistensi font, spacing, alignment (tanda editing)
   - Deteksi blur, noise, atau distorsi yang mencurigakan

2. EKSTRAKSI DATA KRITIS
   Ekstrak dengan akurat:
   - Nominal pembayaran (dalam Rupiah, format: angka tanpa titik/koma)
   - Tanggal dan waktu transfer (format: YYYY-MM-DD HH:MM)
   - Bank atau metode transfer (BCA, Mandiri, BRI, BNI, Brimo, OVO, DANA, GoPay, dll)
   - Nomor rekening tujuan (jika terlihat)
   - Nama pengirim (jika terlihat)
   - Nomor referensi/transaksi (nomor unik transfer)
   - Status transfer (Berhasil, Pending, Gagal)
   - Metode transfer (Transfer Bank, E-Wallet, QRIS, dll)

3. VALIDASI KESESUAIAN DATA
   Bandingkan dengan data yang diharapkan:
   - Nominal: Apakah sesuai? (toleransi ±Rp 1.000 untuk pembulatan)
   - Bank/Metode: Apakah sesuai dengan yang diharapkan?
   - Tanggal: Apakah masih relevan? (maksimal 7 hari dari sekarang)
   - Nomor referensi: Apakah format valid? (biasanya alphanumeric)

4. DETEKSI FRAUD INDICATORS (PRIORITAS TINGGI)
   
   A. MANIPULASI GAMBAR:
   - Tanda-tanda editing: font tidak konsisten, spacing aneh, warna tidak natural
   - Overlay text yang mencurigakan
   - Crop yang tidak wajar
   - Kualitas gambar terlalu rendah (sengaja blur untuk menyembunyikan detail)
   - Metadata gambar tidak konsisten (jika bisa dianalisis)
   
   B. KETIDAKSESUAIAN DATA:
   - Nominal tidak sesuai dengan yang diharapkan (selisih > Rp 1.000)
   - Tanggal transfer di masa depan atau terlalu lama (>30 hari)
   - Bank/metode tidak sesuai
   - Format nomor referensi tidak standar
   
   C. POLA MENCURIGAKAN:
   - Screenshot dari aplikasi yang berbeda dengan yang disebutkan
   - UI aplikasi tidak konsisten dengan versi resmi
   - Watermark atau logo bank tidak jelas/terdistorsi
   - Informasi penting sengaja di-blur atau ditutup
   - Multiple screenshots dengan data yang berbeda
   
   D. KONTEKS MENCURIGAKAN:
   - Status transfer tidak "Berhasil" atau "Success"
   - Nomor rekening tujuan tidak sesuai
   - Nama pengirim berbeda dengan nama pelanggan
   - Waktu transfer di jam tidak wajar (2-6 pagi untuk transaksi normal)

5. ANALISIS RISIKO
   Tentukan tingkat risiko dengan skala 0-100:
   - RISK 0-30 (LOW): Bukti transfer jelas, semua data sesuai, tidak ada tanda manipulasi
   - RISK 31-60 (MEDIUM): Bukti transfer kurang jelas atau ada sedikit ketidaksesuaian minor
   - RISK 61-80 (HIGH): Ada tanda manipulasi atau ketidaksesuaian signifikan
   - RISK 81-100 (CRITICAL): Bukti transfer sangat mencurigakan, kemungkinan besar fraud

6. CONFIDENCE SCORE
   Berikan confidence score (0-100) berdasarkan:
   - Kejelasan gambar
   - Kelengkapan informasi yang terlihat
   - Konsistensi data
   - Tidak ada tanda manipulasi

OUTPUT FORMAT (WAJIB JSON):
{
  "isValid": boolean,
  "confidence": number (0-100),
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": number (0-100),
  "extractedData": {
    "amount": number,
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
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
    "hasManipulation": boolean
  },
  "fraudIndicators": [
    {
      "type": "manipulation" | "data_mismatch" | "suspicious_pattern" | "context_issue",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string",
      "evidence": "string"
    }
  ],
  "recommendation": "auto_approve" | "manual_review" | "reject",
  "reasoning": "string (penjelasan singkat analisis)"
}

PENTING:
- Jika ada tanda manipulasi atau fraud indicators dengan severity "high" atau "critical", set isValid = false
- Jika riskScore > 60, set recommendation = "manual_review" atau "reject"
- Jika confidence < 50, set recommendation = "manual_review"
- Berikan reasoning yang jelas untuk setiap fraud indicator
- Pastikan response hanya berisi JSON yang valid, tanpa teks tambahan di luar JSON
`;
  }

  /**
   * PROMPT 2: Customer Data Verification
   * Untuk verifikasi data customer baru atau perubahan data
   */
  static getCustomerDataVerificationPrompt(
    customerData: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      customerCode?: string;
    },
    existingData?: any
  ): string {
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
  static getTransactionPatternAnalysisPrompt(
    transactionHistory: any[],
    currentTransaction: any
  ): string {
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
  static getImageMetadataAnalysisPrompt(): string {
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
  static getComprehensiveFraudScanPrompt(
    paymentData: any,
    customerData: any,
    transactionHistory: any[]
  ): string {
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
  static getRealTimeFraudMonitoringPrompt(
    recentTransactions: any[],
    systemMetrics: any
  ): string {
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


