# AI Fraud Detection Prompts Documentation

Dokumentasi lengkap untuk sistem prompt AI (Gemini, GPT, dll) untuk scanning dan verifikasi yang lebih proper untuk antisipasi fraud.

## Overview

Sistem ini menyediakan 6 jenis prompt yang komprehensif untuk berbagai skenario fraud detection:

1. **Payment Proof Verification** - Verifikasi bukti pembayaran dengan deteksi manipulasi
2. **Customer Data Verification** - Verifikasi data customer untuk mencegah duplikasi
3. **Transaction Pattern Analysis** - Analisis pola transaksi untuk deteksi anomali
4. **Image Metadata Analysis** - Analisis metadata gambar untuk deteksi editing
5. **Comprehensive Fraud Scan** - Scan menyeluruh semua aspek
6. **Real-time Fraud Monitoring** - Monitoring real-time untuk deteksi pola fraud

## 1. Payment Proof Verification

### Penggunaan

```typescript
import { FraudDetectionPrompts } from '../services/ai/FraudDetectionPrompts';

const prompt = FraudDetectionPrompts.getPaymentProofVerificationPrompt(
    expectedAmount,      // Nominal yang diharapkan
    expectedBank,        // Bank yang diharapkan
    customerName,        // Nama customer (optional)
    invoiceNumber,       // Nomor invoice (optional)
    'invoice'           // 'invoice' atau 'prepaid'
);
```

### Fitur

- **Verifikasi Autentikasi**: Deteksi apakah bukti transfer valid
- **Ekstraksi Data**: Ekstrak nominal, tanggal, bank, nomor referensi, dll
- **Validasi Kesesuaian**: Bandingkan dengan data yang diharapkan
- **Deteksi Manipulasi**: Deteksi tanda-tanda editing/manipulasi gambar
- **Risk Assessment**: Tentukan tingkat risiko (low/medium/high/critical)

### Output Format

```json
{
  "isValid": boolean,
  "confidence": 0-100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
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
  "reasoning": "string"
}
```

## 2. Customer Data Verification

### Penggunaan

```typescript
const prompt = FraudDetectionPrompts.getCustomerDataVerificationPrompt(
    {
        name: "John Doe",
        phone: "081234567890",
        email: "john@example.com",
        address: "Jl. Example No. 123",
        customerCode: "CUST001"
    },
    existingData  // Data existing untuk perbandingan (optional)
);
```

### Fitur

- **Validasi Format**: Validasi format nama, telepon, email, alamat
- **Deteksi Duplikasi**: Deteksi data duplikat
- **Deteksi Pola Mencurigakan**: Deteksi data generik atau tidak valid
- **Risk Assessment**: Tentukan tingkat risiko

### Output Format

```json
{
  "isValid": boolean,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
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
```

## 3. Transaction Pattern Analysis

### Penggunaan

```typescript
const prompt = FraudDetectionPrompts.getTransactionPatternAnalysisPrompt(
    transactionHistory,  // Array of transaction history
    currentTransaction   // Current transaction data
);
```

### Fitur

- **Analisis Pola Normal**: Identifikasi pola transaksi normal customer
- **Deteksi Anomali**: Deteksi anomali dalam frekuensi, nominal, waktu, metode
- **Cross-Reference**: Bandingkan dengan transaksi customer lain

### Output Format

```json
{
  "isAnomaly": boolean,
  "anomalyScore": 0-100,
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
```

## 4. Image Metadata Analysis

### Penggunaan

```typescript
const prompt = FraudDetectionPrompts.getImageMetadataAnalysisPrompt();
```

### Fitur

- **Ekstraksi Metadata**: Ekstrak tanggal, device, software, lokasi
- **Validasi Konsistensi**: Validasi konsistensi metadata
- **Deteksi Manipulasi**: Deteksi tanda editing software

## 5. Comprehensive Fraud Scan

### Penggunaan

```typescript
const prompt = FraudDetectionPrompts.getComprehensiveFraudScanPrompt(
    paymentData,        // Data pembayaran
    customerData,       // Data customer
    transactionHistory  // History transaksi
);
```

### Fitur

- **Payment Proof Analysis**: Analisis bukti pembayaran
- **Customer Data Verification**: Verifikasi data customer
- **Transaction Pattern Analysis**: Analisis pola transaksi
- **Cross-Validation**: Validasi silang semua data
- **Risk Aggregation**: Agregasi semua risk indicators

### Output Format

```json
{
  "overallRiskScore": 0-100,
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
  "confidence": 0-100,
  "reasoning": "string",
  "requiredActions": ["string"]
}
```

## 6. Real-time Fraud Monitoring

### Penggunaan

```typescript
const prompt = FraudDetectionPrompts.getRealTimeFraudMonitoringPrompt(
    recentTransactions,  // Array of recent transactions
    systemMetrics       // System metrics
);
```

### Fitur

- **Deteksi Pola Fraud**: Deteksi pola fraud dalam transaksi terakhir
- **Anomali Sistem**: Deteksi anomali dalam sistem
- **Early Warning**: Deteksi early warning indicators

## Integrasi dengan Gemini Service

Prompt-prompt ini sudah terintegrasi dengan `GeminiService`:

```typescript
import { GeminiService } from '../services/payment/GeminiService';

const result = await GeminiService.analyzePaymentProof(
    imageBuffer,
    expectedAmount,
    expectedBank,
    'invoice',
    customerName,      // New parameter
    invoiceNumber      // New parameter
);
```

## Best Practices

1. **Gunakan Comprehensive Scan** untuk transaksi besar atau mencurigakan
2. **Kombinasikan Multiple Prompts** untuk validasi yang lebih kuat
3. **Monitor Real-time** untuk deteksi pola fraud yang berkembang
4. **Update Prompts** secara berkala berdasarkan fraud patterns baru
5. **Log All Results** untuk analisis dan improvement

## Threshold Recommendations

- **Auto Approve**: riskScore < 30, confidence > 80
- **Manual Review**: riskScore 30-60, confidence 50-80
- **Reject**: riskScore > 60, confidence < 50

## Maintenance

- Review dan update prompts setiap bulan
- Analisis fraud cases untuk improvement
- Adjust threshold berdasarkan false positive/negative rate
- Monitor AI model performance

