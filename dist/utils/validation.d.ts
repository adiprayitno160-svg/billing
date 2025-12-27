/**
 * Utility functions for validation
 */
/**
 * Validate invoice ID
 */
export declare function validateInvoiceId(id: string | undefined): {
    valid: boolean;
    invoiceId?: number;
    error?: string;
};
/**
 * Validate customer ID
 */
export declare function validateCustomerId(id: string | undefined): {
    valid: boolean;
    customerId?: number;
    error?: string;
};
/**
 * Validate array of IDs
 */
export declare function validateIdArray(ids: any[]): {
    valid: boolean;
    validIds?: number[];
    error?: string;
};
/**
 * Sanitize string input
 */
export declare function sanitizeString(input: string | undefined): string;
/**
 * Validate email format
 */
export declare function validateEmail(email: string): boolean;
/**
 * Validate phone number (Indonesian format)
 */
export declare function validatePhone(phone: string): boolean;
//# sourceMappingURL=validation.d.ts.map