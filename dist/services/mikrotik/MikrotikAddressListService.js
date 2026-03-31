"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikAddressListService = void 0;
const MikroTikConnectionPool_1 = require("../MikroTikConnectionPool");
class MikrotikAddressListService {
    constructor(config) {
        this.config = config;
    }
    getPoolConfig() {
        return {
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            password: this.config.password
        };
    }
    /**
     * Add IP address to address list
     */
    async addToAddressList(listName, ipAddress, comment) {
        try {
            console.log(`[AddressList] Adding ${ipAddress} to ${listName} via pool`);
            // Normalize IP address
            let normalizedIP = ipAddress.trim();
            if (normalizedIP.includes('/')) {
                normalizedIP = normalizedIP.split('/')[0].trim();
            }
            // Check if already exists (using cache if possible)
            const existing = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
                `?list=${listName}`,
                `?address=${normalizedIP}`
            ]);
            if (Array.isArray(existing) && existing.length > 0) {
                console.log(`[AddressList] IP ${normalizedIP} already exists in ${listName}`);
                return true;
            }
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/add', [
                `=list=${listName}`,
                `=address=${normalizedIP}`,
                `=comment=${comment || `Added by billing at ${new Date().toISOString()}`}`
            ]);
            console.log(`✅ Successfully added ${normalizedIP} to address-list: ${listName}`);
            return true;
        }
        catch (error) {
            console.error(`[AddressList] Error adding to list:`, error.message);
            return false;
        }
    }
    /**
     * Remove IP address from address list
     */
    async removeFromAddressList(listName, ipAddress) {
        try {
            // Normalize IP
            let normalizedIP = ipAddress.trim();
            if (normalizedIP.includes('/')) {
                normalizedIP = normalizedIP.split('/')[0].trim();
            }
            const entries = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
                `?list=${listName}`,
                `?address=${normalizedIP}`
            ]);
            if (!Array.isArray(entries) || entries.length === 0) {
                return true;
            }
            for (const entry of entries) {
                await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`]);
            }
            return true;
        }
        catch (error) {
            console.error(`[AddressList] Error removing from list:`, error.message);
            return false;
        }
    }
    /**
     * Move IP from one address list to another
     */
    async moveToAddressList(ipAddress, fromList, toList, comment) {
        await this.removeFromAddressList(fromList, ipAddress);
        return await this.addToAddressList(toList, ipAddress, comment);
    }
    /**
     * Check if IP exists in address list
     */
    async isInAddressList(listName, ipAddress) {
        try {
            let normalizedIP = ipAddress.trim();
            if (normalizedIP.includes('/'))
                normalizedIP = normalizedIP.split('/')[0].trim();
            const entries = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
                `?list=${listName}`,
                `?address=${normalizedIP}`
            ], `addresslist:${listName}:${normalizedIP}`, 60000);
            return Array.isArray(entries) && entries.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get all IPs in address list
     */
    async getAddressListEntries(listName) {
        try {
            const result = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
                `?list=${listName}`
            ], `addresslist:${listName}`, 30000);
            return Array.isArray(result) ? result : [];
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Clear all entries from address list
     */
    async clearAddressList(listName) {
        try {
            const entries = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
                `?list=${listName}`
            ]);
            if (Array.isArray(entries)) {
                for (const entry of entries) {
                    await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`]);
                }
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
exports.MikrotikAddressListService = MikrotikAddressListService;
exports.default = MikrotikAddressListService;
//# sourceMappingURL=MikrotikAddressListService.js.map