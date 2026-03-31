"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikService = void 0;
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
const MikroTikConnectionPool_1 = require("../MikroTikConnectionPool");
class MikrotikService {
    constructor(config) {
        this.config = config;
    }
    /**
     * Get singleton instance of MikrotikService
     * Loads config from database automatically
     */
    static async getInstance() {
        const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
        if (!config) {
            throw new Error('MikroTik configuration not found. Please configure in Settings > MikroTik.');
        }
        return new MikrotikService({
            host: config.host,
            username: config.username,
            password: config.password,
            port: config.port || config.api_port || 8728
        });
    }
    getPoolConfig() {
        return {
            host: this.config.host,
            port: this.config.port || 8728,
            username: this.config.username,
            password: this.config.password
        };
    }
    /**
     * Test koneksi ke Mikrotik
     */
    async testConnection() {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/system/identity/print', [], 'identity', 10000);
            return true;
        }
        catch (error) {
            console.error('Mikrotik connection test failed:', error);
            return false;
        }
    }
    /**
     * Buat PPPoE user baru
     */
    async createPPPoEUser(userData) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/add', [
                `=name=${userData.name}`,
                `=password=${userData.password}`,
                `=profile=${userData.profile}`,
                `=comment=${userData.comment || `Customer: ${userData.name}`}`
            ]);
            return true;
        }
        catch (error) {
            console.error('Failed to create PPPoE user:', error);
            return false;
        }
    }
    /**
     * Update PPPoE user by ID
     */
    async updatePPPoEUser(userId, userData) {
        try {
            const updateData = {};
            if (userData.password)
                updateData.password = userData.password;
            if (userData.profile)
                updateData.profile = userData.profile;
            if (userData.comment)
                updateData.comment = userData.comment;
            const updateParams = Object.entries(updateData).map(([key, value]) => `=${key}=${value}`);
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), `/ppp/secret/set`, [`.id=${userId}`, ...updateParams]);
            return true;
        }
        catch (error) {
            console.error('Failed to update PPPoE user:', error);
            return false;
        }
    }
    /**
     * Update PPPoE user by username
     */
    async updatePPPoEUserByUsername(username, userData) {
        try {
            // Find user by username
            const users = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/print', [`?name=${username}`]);
            if (!Array.isArray(users) || users.length === 0) {
                console.error(`PPPoE user ${username} not found`);
                return false;
            }
            const userId = users[0]['.id'];
            // Build update params
            const updateParams = [`=.id=${userId}`];
            if (userData.password !== undefined)
                updateParams.push(`=password=${userData.password}`);
            if (userData.profile !== undefined)
                updateParams.push(`=profile=${userData.profile}`);
            if (userData.comment !== undefined)
                updateParams.push(`=comment=${userData.comment}`);
            if (userData.disabled !== undefined)
                updateParams.push(`=disabled=${userData.disabled ? 'yes' : 'no'}`);
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/set', updateParams);
            console.log(`✅ Updated PPPoE user: ${username} (profile: ${userData.profile || 'unchanged'})`);
            return true;
        }
        catch (error) {
            console.error(`Failed to update PPPoE user ${username}:`, error);
            return false;
        }
    }
    /**
     * Disconnect active PPPoE user (force reconnect)
     */
    async disconnectPPPoEUser(username) {
        try {
            // Find active connection
            const connections = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/print', [`?name=${username}`]);
            if (!Array.isArray(connections) || connections.length === 0) {
                console.log(`⚠️  PPPoE user ${username} not currently connected`);
                return true;
            }
            // Disconnect all active connections for this user
            for (const conn of connections) {
                const connId = conn['.id'];
                if (connId) {
                    await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/remove', [`=.id=${connId}`]);
                    console.log(`✅ Disconnected PPPoE user: ${username}`);
                }
            }
            return true;
        }
        catch (error) {
            console.error(`Failed to disconnect PPPoE user ${username}:`, error);
            return false;
        }
    }
    /**
     * Get PPPoE user by username
     */
    async getPPPoEUserByUsername(username) {
        try {
            const users = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/print', [`?name=${username}`]);
            if (Array.isArray(users) && users.length > 0) {
                return users[0];
            }
            return null;
        }
        catch (error) {
            console.error(`Failed to get PPPoE user ${username}:`, error);
            return null;
        }
    }
    /**
     * Hapus PPPoE user
     */
    async deletePPPoEUser(userId) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/remove', [`.id=${userId}`]);
            return true;
        }
        catch (error) {
            console.error('Failed to delete PPPoE user:', error);
            return false;
        }
    }
    /**
     * Toggle status PPPoE user
     */
    async togglePPPoEUser(userId, disabled) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/set', [
                `.id=${userId}`,
                `=disabled=${disabled ? 'yes' : 'no'}`
            ]);
            return true;
        }
        catch (error) {
            console.error('Failed to toggle PPPoE user:', error);
            return false;
        }
    }
    /**
     * Dapatkan semua PPPoE users
     */
    async getPPPoEUsers() {
        try {
            const result = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/print', [], 'pppoe_users', 60000);
            return Array.isArray(result) ? result.map((user) => ({
                id: user['.id'],
                name: user.name || '',
                password: user.password || '',
                profile: user.profile || '',
                comment: user.comment || ''
            })) : [];
        }
        catch (error) {
            console.error('Failed to get PPPoE users:', error);
            return [];
        }
    }
    /**
     * Buat PPPoE profile baru
     */
    async createPPPoEProfile(profileData) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/profile/add', [
                `=name=${profileData.name}`,
                `=local-address=${profileData.localAddress || ''}`,
                `=remote-address=${profileData.remoteAddress || ''}`,
                `=rate-limit=${profileData.rateLimit || ''}`,
                `=comment=${profileData.comment || `Profile: ${profileData.name}`}`
            ]);
            return true;
        }
        catch (error) {
            console.error('Failed to create PPPoE profile:', error);
            return false;
        }
    }
    /**
     * Dapatkan semua PPPoE profiles
     */
    async getPPPoEProfiles() {
        try {
            const result = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/profile/print', [], 'pppoe_profiles', 60000);
            return Array.isArray(result) ? result.map((profile) => ({
                id: profile['.id'],
                name: profile.name,
                localAddress: profile['local-address'],
                remoteAddress: profile['remote-address'],
                rateLimit: profile['rate-limit'],
                comment: profile.comment
            })) : [];
        }
        catch (error) {
            console.error('Failed to get PPPoE profiles:', error);
            return [];
        }
    }
    /**
     * Tambah IP ke address list
     */
    async addToAddressList(addressData) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/add', [
                `=address=${addressData.address}`,
                `=list=${addressData.list}`,
                `=comment=${addressData.comment || `Customer IP: ${addressData.address}`}`
            ]);
            return true;
        }
        catch (error) {
            console.error('Failed to add to address list:', error);
            return false;
        }
    }
    /**
     * Hapus IP dari address list
     */
    async removeFromAddressList(addressId) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/remove', [`.id=${addressId}`]);
            return true;
        }
        catch (error) {
            console.error('Failed to remove from address list:', error);
            return false;
        }
    }
    /**
     * Dapatkan semua address list entries
     */
    async getAddressList() {
        try {
            const result = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [], 'address_list', 60000);
            return Array.isArray(result) ? result.map((addr) => ({
                id: addr['.id'],
                address: addr.address,
                list: addr.list,
                comment: addr.comment
            })) : [];
        }
        catch (error) {
            console.error('Failed to get address list:', error);
            throw error;
        }
    }
    /**
     * Dapatkan active PPPoE sessions
     */
    async getActivePPPoESessions() {
        try {
            const result = await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/print', [], 'active_sessions', 30000);
            return Array.isArray(result) ? result : [];
        }
        catch (error) {
            console.error('Failed to get active PPPoE sessions:', error);
            return [];
        }
    }
    /**
     * Disconnect PPPoE session
     */
    async disconnectPPPoESession(sessionId) {
        try {
            await MikroTikConnectionPool_1.mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/remove', [`.id=${sessionId}`]);
            return true;
        }
        catch (error) {
            console.error('Failed to disconnect PPPoE session:', error);
            return false;
        }
    }
    /**
     * Bulk create PPPoE users
     */
    async bulkCreatePPPoEUsers(users) {
        let success = 0;
        let failed = 0;
        const errors = [];
        for (const user of users) {
            try {
                const result = await this.createPPPoEUser(user);
                if (result) {
                    success++;
                }
                else {
                    failed++;
                    errors.push(`Failed to create user: ${user.name}`);
                }
            }
            catch (error) {
                failed++;
                errors.push(`Error creating user ${user.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return { success, failed, errors };
    }
    /**
     * Bulk add to address list
     */
    async bulkAddToAddressList(addresses) {
        let success = 0;
        let failed = 0;
        const errors = [];
        for (const addr of addresses) {
            try {
                const result = await this.addToAddressList(addr);
                if (result) {
                    success++;
                }
                else {
                    failed++;
                    errors.push(`Failed to add address: ${addr.address}`);
                }
            }
            catch (error) {
                failed++;
                errors.push(`Error adding address ${addr.address}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return { success, failed, errors };
    }
}
exports.MikrotikService = MikrotikService;
MikrotikService.instance = null;
