/**
 * IP Helper Utility
 *
 * Utility functions untuk menghitung IP client dari CIDR notation
 *
 * Logika:
 * - IP dengan CIDR (contoh: 192.168.1.1/30) adalah IP gateway MikroTik
 * - IP client yang sebenarnya adalah 192.168.1.2 (untuk subnet /30)
 * - Notifikasi ke pelanggan harus menampilkan IP client, bukan IP gateway dengan CIDR
 */
/**
 * Calculate customer/client IP from CIDR notation
 *
 * @param cidrAddress - IP address dengan CIDR notation (contoh: 192.168.1.1/30)
 * @returns IP client tanpa CIDR (contoh: 192.168.1.2 untuk /30 subnet)
 *
 * @example
 * calculateCustomerIP('192.168.1.1/30') // returns '192.168.1.2'
 * calculateCustomerIP('192.168.1.2/30') // returns '192.168.1.2'
 * calculateCustomerIP('192.168.1.1') // returns '192.168.1.1'
 */
export declare function calculateCustomerIP(cidrAddress: string): string;
/**
 * Check if IP address contains CIDR notation
 *
 * @param ipAddress - IP address to check
 * @returns true if contains CIDR notation
 */
export declare function hasCidrNotation(ipAddress: string): boolean;
/**
 * Extract IP part from CIDR notation (remove CIDR)
 *
 * @param cidrAddress - IP address dengan atau tanpa CIDR
 * @returns IP address tanpa CIDR
 */
export declare function extractIpPart(cidrAddress: string): string;
//# sourceMappingURL=ipHelper.d.ts.map