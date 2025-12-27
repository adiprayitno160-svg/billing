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
export declare class MachineLearningService {
    /**
     * Get all ML models
     */
    static getMLModels(): Promise<MLModel[]>;
    /**
     * Get active model by type
     */
    static getActiveModel(modelType: string): Promise<MLModel | undefined>;
    /**
     * Fraud Detection - Enhanced for payment proof verification
     */
    static detectFraud(paymentData: any): Promise<{
        isFraud: boolean;
        confidence: number;
        reasons: string[];
    }>;
    /**
     * Anomaly Detection
     */
    static detectAnomaly(customerId: number, data: any): Promise<{
        isAnomaly: boolean;
        confidence: number;
        anomalyType: string;
    }>;
    /**
     * Sentiment Analysis
     */
    static analyzeSentiment(text: string): Promise<{
        sentiment: string;
        confidence: number;
        emotions: string[];
    }>;
    /**
     * Intent Recognition
     */
    static recognizeIntent(text: string): Promise<{
        intent: string;
        confidence: number;
        entities: any;
    }>;
    /**
     * Save analysis result
     */
    private static saveAnalysisResult;
    /**
     * Get analysis results
     */
    static getAnalysisResults(analysisType?: string, limit?: number): Promise<AIAnalysisResult[]>;
    /**
     * Get ML model statistics
     */
    static getModelStatistics(): Promise<any>;
    /**
     * Get analysis statistics
     */
    static getAnalysisStatistics(days?: number): Promise<any>;
    /**
     * Train model (mock implementation)
     */
    static trainModel(modelType: string, trainingData: any[]): Promise<{
        success: boolean;
        accuracy: number;
    }>;
    /**
     * Update model accuracy
     */
    static updateModelAccuracy(modelId: number, accuracy: number): Promise<void>;
}
//# sourceMappingURL=machineLearningService.d.ts.map