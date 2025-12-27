"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikService = void 0;
const routeros_api_1 = require("routeros-api");
class MikrotikService {
    constructor(config) {
        this.config = config;
    }
    /**
     * Test koneksi ke Mikrotik
     */
    async testConnection() {
        try {
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/system/identity/print');
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/ppp/secret/add', [
                `=name=${userData.name}`,
                `=password=${userData.password}`,
                `=profile=${userData.profile}`,
                `=comment=${userData.comment || `Customer: ${userData.name}`}`
            ]);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            const updateData = {};
            if (userData.password)
                updateData.password = userData.password;
            if (userData.profile)
                updateData.profile = userData.profile;
            if (userData.comment)
                updateData.comment = userData.comment;
            const updateParams = Object.entries(updateData).map(([key, value]) => `=${key}=${value}`);
            await api.write(`/ppp/secret/set`, [`.id=${userId}`, ...updateParams]);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 10000
            });
            await api.connect();
            // Find user by username
            const users = await api.write('/ppp/secret/print', [`?name=${username}`]);
            if (!Array.isArray(users) || users.length === 0) {
                console.error(`PPPoE user ${username} not found`);
                api.close();
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
            await api.write('/ppp/secret/set', updateParams);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 10000
            });
            await api.connect();
            // Find active connection
            const connections = await api.write('/ppp/active/print', [`?name=${username}`]);
            if (!Array.isArray(connections) || connections.length === 0) {
                console.log(`⚠️  PPPoE user ${username} not currently connected`);
                api.close();
                return true; // Not an error, just not connected
            }
            // Disconnect all active connections for this user
            for (const conn of connections) {
                const connId = conn['.id'];
                if (connId) {
                    await api.write('/ppp/active/remove', [`=.id=${connId}`]);
                    console.log(`✅ Disconnected PPPoE user: ${username}`);
                }
            }
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 10000
            });
            await api.connect();
            const users = await api.write('/ppp/secret/print', [`?name=${username}`]);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/ppp/secret/remove', [`.id=${userId}`]);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/ppp/secret/set', [
                `.id=${userId}`,
                `=disabled=${disabled ? 'yes' : 'no'}`
            ]);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            const result = await api.write('/ppp/secret/print');
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/ppp/profile/add', [
                `=name=${profileData.name}`,
                `=local-address=${profileData.localAddress || ''}`,
                `=remote-address=${profileData.remoteAddress || ''}`,
                `=rate-limit=${profileData.rateLimit || ''}`,
                `=comment=${profileData.comment || `Profile: ${profileData.name}`}`
            ]);
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            const result = await api.write('/ppp/profile/print');
            api.close();
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
            console.log('=== DEBUG: addToAddressList ===');
            console.log('Address data:', addressData);
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            console.log('Connected to Mikrotik');
            const params = [
                `=address=${addressData.address}`,
                `=list=${addressData.list}`,
                `=comment=${addressData.comment || `Customer IP: ${addressData.address}`}`
            ];
            console.log('Sending parameters:', params);
            await api.write('/ip/firewall/address-list/add', params);
            console.log('Successfully added to address list');
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/ip/firewall/address-list/remove', [`.id=${addressId}`]);
            api.close();
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
            console.log('=== DEBUG: MikrotikService.getAddressList ===');
            console.log('Config:', {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                password: '***hidden***'
            });
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 10000 // Increase timeout
            });
            console.log('Connecting to Mikrotik...');
            await api.connect();
            console.log('Connected successfully');
            console.log('Executing command: /ip/firewall/address-list/print');
            const result = await api.write('/ip/firewall/address-list/print');
            console.log('Raw result from Mikrotik:', result);
            api.close();
            console.log('Connection closed');
            const mappedResult = Array.isArray(result) ? result.map((addr) => ({
                id: addr['.id'],
                address: addr.address,
                list: addr.list,
                comment: addr.comment
            })) : [];
            console.log('Mapped result:', mappedResult);
            return mappedResult;
        }
        catch (error) {
            console.error('=== ERROR in MikrotikService.getAddressList ===');
            console.error('Error details:', error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            throw error; // Re-throw to let controller handle it
        }
    }
    /**
     * Dapatkan active PPPoE sessions
     */
    async getActivePPPoESessions() {
        try {
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            const result = await api.write('/ppp/active/print');
            api.close();
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
            const api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port || 8728,
                user: this.config.username,
                password: this.config.password,
                timeout: 5000
            });
            await api.connect();
            await api.write('/ppp/active/remove', [`.id=${sessionId}`]);
            api.close();
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
//# sourceMappingURL=MikrotikService.js.map