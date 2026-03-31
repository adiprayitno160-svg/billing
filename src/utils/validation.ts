/**
 * Utility functions for validation
 */

/**
 * Validate invoice ID
 */
export function validateInvoiceId(id: string | undefined): { valid: boolean; invoiceId?: number; error?: string } {
    if (!id) {
        return { valid: false, error: 'ID Invoice tidak boleh kosong' };
    }
    
    const invoiceId = parseInt(id);
    
    if (isNaN(invoiceId)) {
        return { valid: false, error: 'ID Invoice harus berupa angka' };
    }
    
    if (invoiceId <= 0) {
        return { valid: false, error: 'ID Invoice harus lebih dari 0' };
    }
    
    return { valid: true, invoiceId };
}

/**
 * Validate customer ID
 */
export function validateCustomerId(id: string | undefined): { valid: boolean; customerId?: number; error?: string } {
    if (!id) {
        return { valid: false, error: 'ID Customer tidak boleh kosong' };
    }
    
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
        return { valid: false, error: 'ID Customer harus berupa angka' };
    }
    
    if (customerId <= 0) {
        return { valid: false, error: 'ID Customer harus lebih dari 0' };
    }
    
    return { valid: true, customerId };
}

/**
 * Validate array of IDs
 */
export function validateIdArray(ids: any[]): { valid: boolean; validIds?: number[]; error?: string } {
    if (!Array.isArray(ids)) {
        return { valid: false, error: 'Data harus berupa array' };
    }
    
    if (ids.length === 0) {
        return { valid: false, error: 'Tidak ada ID yang dipilih' };
    }
    
    const validIds = ids
        .map(id => parseInt(String(id)))
        .filter(id => !isNaN(id) && id > 0);
    
    if (validIds.length === 0) {
        return { valid: false, error: 'Tidak ada ID yang valid' };
    }
    
    return { valid: true, validIds };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string | undefined): string {
    if (!input) return '';
    return String(input).trim();
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number (Indonesian format)
 */
export function validatePhone(phone: string): boolean {
    const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}



