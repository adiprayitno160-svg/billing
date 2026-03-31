export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type LogType = 'system' | 'auth' | 'billing' | 'payment' | 'network' | 'customer' | 'mikrotik' | 'technician' | 'invoice' | 'api' | 'olt' | 'genieacs' | 'ftth' | 'whatsapp';
export interface LogEntry {
    level: LogLevel;
    type: LogType;
    service: string;
    message: string;
    context?: any;
    userId?: number;
    customerId?: number;
    invoiceId?: number;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    error?: Error;
    isInternal?: boolean;
}
export declare class BillingLogService {
    private static logDir;
    private static anomalyDetector;
    static initialize(): Promise<void>;
    static log(entry: LogEntry): Promise<void>;
    private static writeToFile;
    private static writeToDatabase;
    private static updateLogAnomaly;
    static getLogs(filters: any): Promise<any[]>;
    static resolveAnomaly(id: number, userId: number, resolution: string): Promise<void>;
    static info(type: LogType, service: string, message: string, context?: any): Promise<void>;
    static warning(type: LogType, service: string, message: string, context?: any): Promise<void>;
    static error(type: LogType, service: string, message: string, error?: Error, context?: any): Promise<void>;
    static critical(type: LogType, service: string, message: string, error?: Error, context?: any): Promise<void>;
}
//# sourceMappingURL=BillingLogService.d.ts.map