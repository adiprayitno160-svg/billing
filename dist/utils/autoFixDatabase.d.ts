/**
 * AUTO FIX DATABASE - Add missing columns
 * This will run automatically on server start
 */
/**
 * Auto-fix invoices and payments tables
 * Create tables if not exists - CRITICAL for bookkeeping functionality
 */
export declare function autoFixInvoicesAndPaymentsTables(): Promise<void>;
/**
 * Auto-fix WhatsApp and Registration tables
 */
export declare function autoFixWhatsAppTables(): Promise<void>;
/**
 * Auto-fix Customer columns
 */
export declare function autoFixCustomerColumns(): Promise<void>;
/**
 * Auto-fix PPPoE Activation related tables and columns
 */
export declare function autoFixPPPoEActivationTables(): Promise<void>;
//# sourceMappingURL=autoFixDatabase.d.ts.map