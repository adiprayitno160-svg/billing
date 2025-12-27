"use strict";
/**
 * Utility functions for validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInvoiceId = validateInvoiceId;
exports.validateCustomerId = validateCustomerId;
exports.validateIdArray = validateIdArray;
exports.sanitizeString = sanitizeString;
exports.validateEmail = validateEmail;
exports.validatePhone = validatePhone;
/**
 * Validate invoice ID
 */
function validateInvoiceId(id) {
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
function validateCustomerId(id) {
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
function validateIdArray(ids) {
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
function sanitizeString(input) {
    if (!input)
        return '';
    return String(input).trim();
}
/**
 * Validate email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Validate phone number (Indonesian format)
 */
function validatePhone(phone) {
    const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}
//# sourceMappingURL=validation.js.map