"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCustomerIP = calculateCustomerIP;
exports.hasCidrNotation = hasCidrNotation;
exports.extractIpPart = extractIpPart;
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
function calculateCustomerIP(cidrAddress) {
    try {
        // Jika tidak ada CIDR notation, return IP as-is
        if (!cidrAddress.includes('/')) {
            return cidrAddress;
        }
        const [ipPart, prefixStr] = cidrAddress.split('/');
        const prefix = prefixStr ? parseInt(prefixStr, 10) : 0;
        // Helper functions untuk konversi IP <-> integer
        const ipToInt = (ip) => {
            return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
        };
        const intToIp = (int) => {
            return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
        };
        // Untuk /30 subnet: network, gateway (.1), customer (.2), broadcast
        // IP yang disimpan di database adalah gateway IP (192.168.1.1/30)
        // IP client yang harus ditampilkan adalah 192.168.1.2
        if (prefix === 30) {
            const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
            const networkInt = ipToInt(ipPart || '0.0.0.0') & mask;
            const firstHost = networkInt + 1; // Gateway (biasanya .1)
            const secondHost = networkInt + 2; // Customer (biasanya .2)
            const ipInt = ipToInt(ipPart || '0.0.0.0');
            // Jika IP yang disimpan adalah gateway (.1), return customer IP (.2)
            if (ipInt === firstHost) {
                return intToIp(secondHost);
            }
            // Jika IP yang disimpan sudah customer IP (.2), return as-is
            else if (ipInt === secondHost) {
                return ipPart || '';
            }
            // Default: return customer IP (.2)
            else {
                return intToIp(secondHost);
            }
        }
        // Untuk subnet lain, return IP tanpa CIDR
        return ipPart || '';
    }
    catch (error) {
        // Jika error, return IP part saja (tanpa CIDR)
        console.warn('Error calculating customer IP from CIDR, using IP part only:', error);
        return cidrAddress.split('/')[0] || '';
    }
}
/**
 * Check if IP address contains CIDR notation
 *
 * @param ipAddress - IP address to check
 * @returns true if contains CIDR notation
 */
function hasCidrNotation(ipAddress) {
    return ipAddress.includes('/');
}
/**
 * Extract IP part from CIDR notation (remove CIDR)
 *
 * @param cidrAddress - IP address dengan atau tanpa CIDR
 * @returns IP address tanpa CIDR
 */
function extractIpPart(cidrAddress) {
    return cidrAddress.split('/')[0] || '';
}
//# sourceMappingURL=ipHelper.js.map