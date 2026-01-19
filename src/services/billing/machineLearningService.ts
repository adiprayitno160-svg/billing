import { databasePool } from '../../db/pool';

export interface MLModel {
    id: number;
    model_name: string;
    model_type: 'fraud_detection' | 'anomaly_detection' | 'sentiment_analysis' | 'intent_recognition';
    model_version: string;
    model_path: string;
    is_active: boolean;
    accuracy_score: number;
    created_at: Date;
    updated_at: Date;
}

export interface AIAnalysisResult {
    id: number;
    analysis_type: 'transfer_proof' | 'sentiment' | 'intent' | 'fraud_detection';
    input_data: any;
    analysis_result: any;
    confidence_score: number;
    status: 'pending' | 'completed' | 'failed';
    created_at: Date;
}

export class MachineLearningService {
    /**
     * Get all ML models
     */
    static async getMLModels(): Promise<MLModel[]> {
        const query = `
            SELECT * FROM ml_models 
            WHERE is_active = TRUE 
            ORDER BY model_type, model_version DESC
        `;

        const [result] = await databasePool.query(query);
        return result as MLModel[];
    }

    /**
     * Get active model by type
     */
    static async getActiveModel(modelType: string): Promise<MLModel | undefined> {
        const query = `
            SELECT * FROM ml_models 
            WHERE model_type = ? AND is_active = TRUE 
            ORDER BY accuracy_score DESC, updated_at DESC 
            LIMIT 1
        `;

        const [result] = await databasePool.query(query, [modelType]);
        const models = result as MLModel[];

        return models.length > 0 ? models[0] : undefined;
    }

    /**
     * Fraud Detection - Enhanced for payment proof verification
     */
    static async detectFraud(paymentData: any): Promise<{ isFraud: boolean, confidence: number, reasons: string[] }> {
        try {
            // Get fraud detection model (if available)
            let model;
            try {
                model = await this.getActiveModel('fraud_detection');
            } catch (e) {
                // Model table might not exist, continue with rule-based detection
            }

            // Enhanced fraud detection logic for payment proofs
            const fraudIndicators: string[] = [];
            let fraudScore = 0;
            const now = new Date();

            // 1. Amount validation (0-15 points)
            if (paymentData.amount) {
                const amount = parseFloat(paymentData.amount);
                if (amount <= 0) {
                    fraudScore += 15;
                    fraudIndicators.push('Nominal tidak valid (0 atau negatif)');
                } else if (amount > 50000000) { // Very large amount (>50M)
                    fraudScore += 10;
                    fraudIndicators.push('Nominal sangat besar (dicurigai)');
                }
            } else {
                fraudScore += 5;
                fraudIndicators.push('Nominal tidak terdeteksi dari bukti');
            }

            // 2. OCR Confidence check (0-20 points)
            if (paymentData.ocr_confidence !== undefined) {
                const ocrConf = parseFloat(paymentData.ocr_confidence);
                if (ocrConf < 30) {
                    fraudScore += 20;
                    fraudIndicators.push('Kualitas OCR sangat rendah - bukti mungkin tidak jelas');
                } else if (ocrConf < 50) {
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
                } else if (matchConf < 50) {
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
                } else if (paymentDate > now) {
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
                const [customerResult] = await databasePool.query(customerQuery, [paymentData.customer_id]);
                const customer = (customerResult as any[])[0];

                if (customer && customer.customer_age_days < 7) {
                    fraudScore += 15;
                    fraudIndicators.push('Pelanggan sangat baru (<7 hari)');
                } else if (customer && customer.payment_count === 0) {
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

                const [duplicateResult] = await databasePool.query(duplicateQuery, [
                    paymentData.customer_id,
                    paymentData.amount
                ]);
                const duplicateCount = (duplicateResult as any[])[0].count;

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
            } catch (e) {
                // Table might not exist, continue
            }

            return {
                isFraud,
                confidence: fraudPercentage,
                reasons: fraudIndicators
            };

        } catch (error) {
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
    static async detectAnomaly(customerId: number, data: any): Promise<{ isAnomaly: boolean, confidence: number, anomalyType: string }> {
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

            const [historicalResult] = await databasePool.query(historicalQuery, [customerId]);
            const historical = (historicalResult as any[])[0];

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
            } else if (data.payment_time && historical.avg_interval) {
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

        } catch (error) {
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
    static async analyzeSentiment(text: string): Promise<{ sentiment: string, confidence: number, emotions: string[] }> {
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
            } else if (negativeScore > positiveScore && negativeScore > 0) {
                sentiment = 'negative';
                confidence = Math.min(negativeScore / 3, 1.0);
                emotions.push('dissatisfied', 'frustrated');
            } else {
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

        } catch (error) {
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
    static async recognizeIntent(text: string): Promise<{ intent: string, confidence: number, entities: any }> {
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
                    (entities as any).matched_patterns = matchedPatterns;
                }
            }

            // Extract entities (amounts, dates, etc.)
            const amountMatch = text.match(/Rp\s*(\d+(?:\.\d{3})*(?:,\d{2})?)/);
            if (amountMatch) {
                (entities as any).amount = parseFloat(amountMatch![1]!.replace(/\./g, '').replace(',', '.'));
            }

            const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dateMatch) {
                (entities as any).date = `${dateMatch![3]!}-${dateMatch![2]!.padStart(2, '0')}-${dateMatch![1]!.padStart(2, '0')}`;
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

        } catch (error) {
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
    private static async saveAnalysisResult(
        analysisType: string,
        inputData: any,
        analysisResult: any
    ): Promise<number> {
        const query = `
            INSERT INTO ai_analysis_results (analysis_type, input_data, analysis_result, confidence_score, status)
            VALUES (?, ?, ?, ?, 'completed')
        `;

        const confidence = analysisResult.confidence || 0;

        const [result] = await databasePool.query(query, [
            analysisType,
            JSON.stringify(inputData),
            JSON.stringify(analysisResult),
            confidence
        ]);

        return (result as any).insertId;
    }

    /**
     * Get analysis results
     */
    static async getAnalysisResults(
        analysisType?: string,
        limit: number = 50
    ): Promise<AIAnalysisResult[]> {
        let query = `
            SELECT * FROM ai_analysis_results 
            WHERE 1=1
        `;

        const params: any[] = [];

        if (analysisType) {
            query += ` AND analysis_type = ?`;
            params.push(analysisType);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const [result] = await databasePool.query(query, params);
        return result as AIAnalysisResult[];
    }

    /**
     * Get ML model statistics
     */
    static async getModelStatistics(): Promise<any> {
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

        const [result] = await databasePool.query(query);
        return result;
    }

    /**
     * Get analysis statistics
     */
    static async getAnalysisStatistics(days: number = 30): Promise<any> {
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

        const [result] = await databasePool.query(query, [days]);
        return result;
    }

    /**
     * Train model (mock implementation)
     */
    static async trainModel(modelType: string, trainingData: any[]): Promise<{ success: boolean, accuracy: number }> {
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
    static async updateModelAccuracy(modelId: number, accuracy: number): Promise<void> {
        const query = `
            UPDATE ml_models 
            SET accuracy_score = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;

        await databasePool.query(query, [accuracy, modelId]);
    }

    /**
     * AI Revenue Risk Prediction
     * Predict the probability of a customer paying their invoice on time.
     */
    static async predictPaymentProbability(customerId: number): Promise<{
        probability: number,
        riskLevel: 'low' | 'medium' | 'high',
        reasons: string[]
    }> {
        try {
            // 1. Fetch historical payment patterns
            const [history] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN DATEDIFF(last_payment_date, due_date) > 0 THEN 1 ELSE 0 END) as late_count,
                    AVG(DATEDIFF(last_payment_date, due_date)) as avg_delay_days
                FROM invoices 
                WHERE customer_id = ? AND status != 'draft'
            `, [customerId]);

            const stats = history[0];
            const totalInvoices = Number(stats.total_invoices) || 0;
            const paidCount = Number(stats.paid_count) || 0;
            const lateCount = Number(stats.late_count) || 0;
            const avgDelay = Number(stats.avg_delay_days) || 0;

            // 2. Fetch credit score
            const [credit] = await databasePool.query<RowDataPacket[]>(
                "SELECT score FROM customer_credit_scores WHERE customer_id = ?", [customerId]
            );
            const score = credit.length > 0 ? Number(credit[0].score) : 600;

            // 3. Simple Heuristic/ML Model logic
            let baseProb = 0.5; // Neutral
            const reasons: string[] = [];

            // Pattern 1: Historical Consistency
            if (totalInvoices > 0) {
                const onTimeRate = (paidCount - lateCount) / totalInvoices;
                baseProb += (onTimeRate * 0.4);
                if (onTimeRate < 0.5) reasons.push('Riwayat pembayaran sering terlambat.');
            } else {
                reasons.push('Pelanggan baru, belum ada riwayat pembayaran.');
            }

            // Pattern 2: Credit Score Influence
            const scoreIncr = (score - 600) / 400 * 0.3; // -0.3 to +0.3
            baseProb += scoreIncr;
            if (score > 800) reasons.push('Skor kredit sangat baik.');
            if (score < 500) reasons.push('Skor kredit rendah.');

            // Pattern 3: Recent Behavior (Average Delay)
            if (avgDelay > 7) {
                baseProb -= 0.15;
                reasons.push(`Trend keterlambatan rata-rata ${Math.round(avgDelay)} hari.`);
            }

            // Clamp probability
            const probability = Math.max(0.05, Math.min(0.95, baseProb));

            let riskLevel: 'low' | 'medium' | 'high' = 'medium';
            if (probability > 0.8) riskLevel = 'low';
            else if (probability < 0.4) riskLevel = 'high';

            return { probability, riskLevel, reasons };

        } catch (error) {
            console.error('[MLService] Revenue Risk Prediction Error:', error);
            return { probability: 0.5, riskLevel: 'medium', reasons: ['Gagal melakukan analisa data.'] };
        }
    }
}
