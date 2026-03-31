/**
 * Helper to validate Mikrotik Queue Types
 * Prevents "input does not match any value of queue" error
 */
export declare const validTypes: string[];
export declare function validateQueueType(queueName: string): Promise<string>;
export declare function sanitizeLimit(value: any): string | undefined;
export declare function sanitizeTime(value: any): string | undefined;
export declare function preValidateQueueCreation(data: any): Promise<{
    valid: boolean;
    errors: string[];
    sanitizedData: any;
}>;
export declare function getAvailableQueueTypes(): Promise<string[]>;
//# sourceMappingURL=queueValidationHelper.d.ts.map