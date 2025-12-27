"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MachineLearningService = void 0;
const pool_1 = require("../../db/pool");
class MachineLearningService {
    /**
     * Get all ML models
     */
    static async getMLModels() {
        const query = `
            SELECT * FROM ml_models 
            WHERE is_active = TRUE 
            ORDER BY model_type, model_version DESC
        `;
        const [result] = await pool_1.databasePool.query(query);
        return result;
    }
    /**
     * Get active model by type
     */
    static async getActiveModel(modelType) {
        const query = `
            SELECT * FROM ml_models 
            WHERE model_type = ? AND is_active = TRUE 
            ORDER BY accuracy_score DESC, updated_at DESC 
            LIMIT 1
        `;
        const [result] = await pool_1.databasePool.query(query, [modelType]);
        const models = result;
        return models.length > 0 ? models[0] : undefined;
    }
    /**
     * Fraud Detection - Enhanced for payment proof verification
     */
    static async detectFraud(paymentData) {
        try {
            // Get fraud detection model (if available)
            let model;
            try {
                model = await this.getActiveModel('fraud_detection');
            }
            catch (e) {
                // Model table might not exist, continue with rule-based detection
            }
            // Enhanced fraud detection logic for payment proofs
            const fraudIndicators = [];
            let fraudScore = 0;
            const now = new Date();
            // 1. Amount validation (0-15 points)
            if (paymentData.amount) {
                const amount = parseFloat(paymentData.amount);
                if (amount <= 0) {
                    fraudScore += 15;
                    fraudIndicators.push('Nominal tidak valid (0 atau negatif)');
                }
                else if (amount > 50000000) { // Very large amount (>50M)
                    fraudScore += 10;
                    fraudIndicators.push('Nominal sangat besar (dicurigai)');
                }
            }
            else {
                fraudScore += 5;
                fraudIndicators.push('Nominal tidak terdeteksi dari bukti');
            }
            // 2. OCR Confidence check (0-20 points)
            if (paymentData.ocr_confidence !== undefined) {
                const ocrConf = parseFloat(paymentData.ocr_confidence);
                if (ocrConf < 30) {
                    fraudScore += 20;
                    fraudIndicators.push('Kualitas OCR sangat rendah - bukti mungkin tidak jelas');
                }
                else if (ocrConf < 50) {
                    fraudScore += 10;
                    fraudIndicators.push('Kualitas OCR rendah');
                }
            }
            // 3. Matching confidence check (0-15 points)
            if (paymentData.matching_confidence !== undefined) {
                const matchConf = parseFloat(paymentData.matching_confidence);
                if (matchConf < 30) {
                    fraudScore += 15;
                    fraudIndicators.push('Tidak ada invoice yang cocok');
                }
                else if (matchConf < 50) {
                    fraudScore += 8;
                    fraudIndicators.push('Invoice match kurang akurat');
                }
            }
            // 4. Date validation (0-10 points)
            if (paymentData.date) {
                const paymentDate = new Date(paymentData.date);
                const daysFromNow = Math.abs((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysFromNow > 30) {
                    fraudScore += 10;
                    fraudIndicators.push('Tanggal pembayaran terlalu lama (lebih dari 30 hari)');
                }
                else if (paymentDate > now) {
                    fraudScore += 15;
                    fraudIndicators.push('Tanggal pembayaran di masa depan (sangat mencurigakan)');
                }
            }
            // 5. Customer history check (0-15 points)
            if (paymentData.customer_id) {
                const customerQuery = `
                    SELECT 
                        COUNT(*) as payment_count,
                        DATEDIFF(NOW(), created_at) as customer_age_days
                    FROM customers
                    WHERE id = ?
                `;
                const [customerResult] = await pool_1.databasePool.query(customerQuery, [paymentData.customer_id]);
                const customer = customerResult[0];
                if (customer && customer.customer_age_days < 7) {
                    fraudScore += 15;
                    fraudIndicators.push('Pelanggan sangat baru (<7 hari)');
                }
                else if (customer && customer.payment_count === 0) {
                    fraudScore += 10;
                    fraudIndicators.push('Pelanggan belum pernah melakukan pembayaran sebelumnya');
                }
            }
            // 6. Duplicate payment check (0-20 points)
            if (paymentData.amount && paymentData.customer_id) {
                const duplicateQuery = `
                    SELECT COUNT(*) as count 
                    FROM payments p
                    JOIN invoices i ON p.invoice_id = i.id
                    WHERE i.customer_id = ?
                    AND p.amount = ?
                    AND p.payment_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                `;
                const [duplicateResult] = await pool_1.databasePool.query(duplicateQuery, [
                    paymentData.customer_id,
                    paymentData.amount
                ]);
                const duplicateCount = duplicateResult[0].count;
                if (duplicateCount > 0) {
                    fraudScore += 20;
                    fraudIndicators.push(`Pembayaran duplikat terdeteksi (${duplicateCount}x dalam 24 jam)`);
                }
            }
            // 7. Time-based check (0-5 points)
            const hour = now.getHours();
            if (hour >= 2 && hour < 6) {
                fraudScore += 5;
                fraudIndicators.push('Pembayaran di jam tidak biasa (2-6 pagi)');
            }
            // Convert fraudScore to percentage (0-100)
            // Higher fraudScore = higher fraud percentage
            const fraudPercentage = Math.min(fraudScore, 100);
            const isFraud = fraudPercentage > 50;
            // Save analysis result (if table exists)
            try {
                await this.saveAnalysisResult('fraud_detection', paymentData, {
                    isFraud,
                    confidence: fraudPercentage,
                    fraudScore: fraudPercentage,
                    indicators: fraudIndicators
                });
            }
            catch (e) {
                // Table might not exist, continue
            }
            return {
                isFraud,
                confidence: fraudPercentage,
                reasons: fraudIndicators
            };
        }
        catch (error) {
            console.error('Error in fraud detection:', error);
            // Return safe default (medium fraud to trigger manual review)
            return {
                isFraud: false,
                confidence: 45, // Medium fraud to trigger manual review
                reasons: ['Error in fraud detection - requiring manual review']
            };
        }
    }
    /**
     * Anomaly Detection
     */
    static async detectAnomaly(customerId, data) {
        try {
            // Get customer's historical data
            const historicalQuery = `
                SELECT 
                    AVG(amount) as avg_amount,
                    STDDEV(amount) as std_amount,
                    COUNT(*) as payment_count,
                    AVG(TIMESTAMPDIFF(HOUR, LAG(payment_date) OVER (ORDER BY payment_date), payment_date)) as avg_interval
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE i.customer_id = ?
                AND p.payment_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            `;
            const [historicalResult] = await pool_1.databasePool.query(historicalQuery, [customerId]);
            const historical = historicalResult[0];
            if (!historical || historical.payment_count < 3) {
                // Not enough data for anomaly detection
                return {
                    isAnomaly: false,
                    confidence: 0,
                    anomalyType: 'insufficient_data'
                };
            }
            const avgAmount = parseFloat(historical.avg_amount);
            const stdAmount = parseFloat(historical.std_amount);
            const currentAmount = parseFloat(data.amount);
            // Calculate z-score
            const zScore = Math.abs((currentAmount - avgAmount) / stdAmount);
            let isAnomaly = false;
            let anomalyType = 'normal';
            let confidence = 0;
            if (zScore > 3) {
                isAnomaly = true;
                confidence = Math.min(zScore / 5, 1.0);
                anomalyType = 'amount_anomaly';
            }
            else if (data.payment_time && historical.avg_interval) {
                const timeDiff = Math.abs(data.payment_time - historical.avg_interval);
                if (timeDiff > historical.avg_interval * 2) {
                    isAnomaly = true;
                    confidence = 0.7;
                    anomalyType = 'timing_anomaly';
                }
            }
            // Save analysis result
            await this.saveAnalysisResult('anomaly_detection', {
                customer_id: customerId,
                ...data
            }, {
                isAnomaly,
                confidence,
                anomalyType,
                zScore,
                historicalData: historical
            });
            return {
                isAnomaly,
                confidence,
                anomalyType
            };
        }
        catch (error) {
            console.error('Error in anomaly detection:', error);
            return {
                isAnomaly: false,
                confidence: 0,
                anomalyType: 'error'
            };
        }
    }
    /**
     * Sentiment Analysis
     */
    static async analyzeSentiment(text) {
        try {
            // Simple keyword-based sentiment analysis
            // In production, this would use a trained NLP model
            const positiveWords = ['bagus', 'baik', 'puas', 'senang', 'terima kasih', 'mantap', 'keren'];
            const negativeWords = ['buruk', 'jelek', 'tidak puas', 'kecewa', 'marah', 'masalah', 'error'];
            const neutralWords = ['ok', 'biasa', 'normal', 'standar'];
            const lowerText = text.toLowerCase();
            let positiveScore = 0;
            let negativeScore = 0;
            let neutralScore = 0;
            // Count sentiment words
            for (const word of positiveWords) {
                if (lowerText.includes(word)) {
                    positiveScore++;
                }
            }
            for (const word of negativeWords) {
                if (lowerText.includes(word)) {
                    negativeScore++;
                }
            }
            for (const word of neutralWords) {
                if (lowerText.includes(word)) {
                    neutralScore++;
                }
            }
            // Determine sentiment
            let sentiment = 'neutral';
            let confidence = 0.5;
            const emotions = [];
            if (positiveScore > negativeScore && positiveScore > 0) {
                sentiment = 'positive';
                confidence = Math.min(positiveScore / 3, 1.0);
                emotions.push('satisfied', 'happy');
            }
            else if (negativeScore > positiveScore && negativeScore > 0) {
                sentiment = 'negative';
                confidence = Math.min(negativeScore / 3, 1.0);
                emotions.push('dissatisfied', 'frustrated');
            }
            else {
                sentiment = 'neutral';
                confidence = 0.5;
                emotions.push('neutral');
            }
            // Save analysis result
            await this.saveAnalysisResult('sentiment', { text }, {
                sentiment,
                confidence,
                emotions,
                scores: {
                    positive: positiveScore,
                    negative: negativeScore,
                    neutral: neutralScore
                }
            });
            return {
                sentiment,
                confidence,
                emotions
            };
        }
        catch (error) {
            console.error('Error in sentiment analysis:', error);
            return {
                sentiment: 'neutral',
                confidence: 0,
                emotions: ['error']
            };
        }
    }
    /**
     * Intent Recognition
     */
    static async recognizeIntent(text) {
        try {
            const lowerText = text.toLowerCase();
            // Define intent patterns
            const intentPatterns = {
                'payment_inquiry': ['bayar', 'pembayaran', 'payment', 'tagihan', 'invoice'],
                'check_status': ['status', 'cek', 'check', 'riwayat', 'history'],
                'upload_proof': ['bukti', 'proof', 'transfer', 'upload', 'kirim'],
                'complaint': ['komplain', 'masalah', 'error', 'bug', 'tidak bisa'],
                'greeting': ['halo', 'hai', 'selamat', 'hello', 'hi'],
                'help': ['bantuan', 'help', 'menu', 'panduan', 'cara'],
                'cancel_service': ['berhenti', 'cancel', 'stop', 'nonaktif'],
                'upgrade_service': ['upgrade', 'naik', 'tambah', 'lebih cepat']
            };
            let bestIntent = 'unknown';
            let bestConfidence = 0;
            const entities = {};
            // Check each intent pattern
            for (const [intent, patterns] of Object.entries(intentPatterns)) {
                let matchCount = 0;
                const matchedPatterns = [];
                for (const pattern of patterns) {
                    if (lowerText.includes(pattern)) {
                        matchCount++;
                        matchedPatterns.push(pattern);
                    }
                }
                const confidence = matchCount / patterns.length;
                if (confidence > bestConfidence) {
                    bestIntent = intent;
                    bestConfidence = confidence;
                    entities.matched_patterns = matchedPatterns;
                }
            }
            // Extract entities (amounts, dates, etc.)
            const amountMatch = text.match(/Rp\s*(\d+(?:\.\d{3})*(?:,\d{2})?)/);
            if (amountMatch) {
                entities.amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
            }
            const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dateMatch) {
                entities.date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
            }
            // Save analysis result
            await this.saveAnalysisResult('intent', { text }, {
                intent: bestIntent,
                confidence: bestConfidence,
                entities
            });
            return {
                intent: bestIntent,
                confidence: bestConfidence,
                entities
            };
        }
        catch (error) {
            console.error('Error in intent recognition:', error);
            return {
                intent: 'unknown',
                confidence: 0,
                entities: {}
            };
        }
    }
    /**
     * Save analysis result
     */
    static async saveAnalysisResult(analysisType, inputData, analysisResult) {
        const query = `
            INSERT INTO ai_analysis_results (analysis_type, input_data, analysis_result, confidence_score, status)
            VALUES (?, ?, ?, ?, 'completed')
        `;
        const confidence = analysisResult.confidence || 0;
        const [result] = await pool_1.databasePool.query(query, [
            analysisType,
            JSON.stringify(inputData),
            JSON.stringify(analysisResult),
            confidence
        ]);
        return result.insertId;
    }
    /**
     * Get analysis results
     */
    static async getAnalysisResults(analysisType, limit = 50) {
        let query = `
            SELECT * FROM ai_analysis_results 
            WHERE 1=1
        `;
        const params = [];
        if (analysisType) {
            query += ` AND analysis_type = ?`;
            params.push(analysisType);
        }
        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        const [result] = await pool_1.databasePool.query(query, params);
        return result;
    }
    /**
     * Get ML model statistics
     */
    static async getModelStatistics() {
        const query = `
            SELECT 
                model_type,
                COUNT(*) as total_models,
                AVG(accuracy_score) as avg_accuracy,
                MAX(accuracy_score) as best_accuracy,
                COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_models
            FROM ml_models 
            GROUP BY model_type
        `;
        const [result] = await pool_1.databasePool.query(query);
        return result;
    }
    /**
     * Get analysis statistics
     */
    static async getAnalysisStatistics(days = 30) {
        const query = `
            SELECT 
                analysis_type,
                COUNT(*) as total_analyses,
                AVG(confidence_score) as avg_confidence,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_analyses,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_analyses
            FROM ai_analysis_results 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY analysis_type
        `;
        const [result] = await pool_1.databasePool.query(query, [days]);
        return result;
    }
    /**
     * Train model (mock implementation)
     */
    static async trainModel(modelType, trainingData) {
        // Mock training process
        // In production, this would use actual ML training
        console.log(`Training ${modelType} model with ${trainingData.length} samples`);
        // Simulate training time
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Mock accuracy calculation
        const accuracy = 0.85 + Math.random() * 0.1; // 85-95% accuracy
        return {
            success: true,
            accuracy
        };
    }
    /**
     * Update model accuracy
     */
    static async updateModelAccuracy(modelId, accuracy) {
        const query = `
            UPDATE ml_models 
            SET accuracy_score = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        await pool_1.databasePool.query(query, [accuracy, modelId]);
    }
}
exports.MachineLearningService = MachineLearningService;
//# sourceMappingURL=machineLearningService.js.map