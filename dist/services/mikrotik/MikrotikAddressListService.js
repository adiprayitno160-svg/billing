"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikAddressListService = void 0;
const node_routeros_1 = require("node-routeros");
const MikrotikCacheService_1 = __importDefault(require("./MikrotikCacheService"));
class MikrotikAddressListService {
    constructor(config) {
        this.config = config;
    }
    /**
     * Add IP address to address list
     * @param listName - Name of address list (e.g., 'isolated', 'active-customers')
     * @param ipAddress - IP address to add
     * @param comment - Optional comment
     */
    async addToAddressList(listName, ipAddress, comment) {
        console.log(`\n[AddressList] ========== ADD TO ADDRESS LIST ==========`);
        console.log(`[AddressList] IP to add: ${ipAddress}`);
        console.log(`[AddressList] List name: ${listName}`);
        console.log(`[AddressList] Comment: ${comment || 'N/A'}`);
        console.log(`[AddressList] ---`);
        console.log(`[AddressList] Mikrotik Config received:`);
        console.log(`[AddressList]   Host: ${this.config.host}`);
        console.log(`[AddressList]   Port: ${this.config.port}`);
        console.log(`[AddressList]   Username: ${this.config.username}`);
        console.log(`[AddressList]   Has Password: ${!!this.config.password}`);
        console.log(`[AddressList] ==========================================\n`);
        const api = new node_routeros_1.RouterOSAPI({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            timeout: 10000 // 10 seconds timeout - more reliable
        });
        let apiConnected = false;
        try {
            console.log(`[AddressList] Connecting to Mikrotik at ${this.config.host}:${this.config.port}...`);
            console.log(`[AddressList] Full config:`, {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                hasPassword: !!this.config.password
            });
            // Enforce strict timeout with Promise.race to fail fast on connection issues
            // Increase timeout to 10 seconds for better reliability
            const CONNECTION_TIMEOUT = 10000; // 10 seconds
            const connectPromise = api.connect();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Connection timeout: Cannot connect to Mikrotik ${this.config.host}:${this.config.port} within ${CONNECTION_TIMEOUT}ms. Check network connectivity and Mikrotik API status.`));
                }, CONNECTION_TIMEOUT);
            });
            await Promise.race([connectPromise, timeoutPromise]);
            apiConnected = true;
            console.log(`[AddressList] ✅ Connected successfully to ${this.config.host}:${this.config.port}`);
            // First, check if IP already exists in the list to avoid duplicates
            console.log(`[AddressList] Checking if IP ${ipAddress} already exists in list '${listName}'...`);
            try {
                const checkEntries = await api.write('/ip/firewall/address-list/print', [
                    `?list=${listName}`,
                    `?address=${ipAddress}`
                ]);
                const checkArray = Array.isArray(checkEntries) ? checkEntries : [];
                if (checkArray.length > 0) {
                    console.log(`✅ IP ${ipAddress} already exists in list ${listName}`);
                    console.log(`[AddressList] Existing entry:`, checkArray[0]);
                    return true; // Already exists, this is success
                }
                console.log(`[AddressList] IP ${ipAddress} not found in list, will add it`);
                // Also check total entries in list for info
                const allEntries = await api.write('/ip/firewall/address-list/print', [
                    `?list=${listName}`
                ]);
                const allEntriesArray = Array.isArray(allEntries) ? allEntries : [];
                console.log(`[AddressList] List '${listName}' currently has ${allEntriesArray.length} entries`);
            }
            catch (listError) {
                const errorMsg = listError?.message || String(listError);
                // If list doesn't exist, that's OK - it will be auto-created
                if (errorMsg.includes('no such') || errorMsg.includes('not found')) {
                    console.log(`[AddressList] List '${listName}' doesn't exist yet - will be auto-created on first add`);
                }
                else {
                    console.warn(`[AddressList] ⚠️ Error checking list (will continue anyway):`, errorMsg);
                }
                // Continue, list will be auto-created when we add first IP
            }
            // Normalize IP address - strip CIDR if present
            let normalizedIP = ipAddress.trim();
            if (normalizedIP.includes('/')) {
                normalizedIP = normalizedIP.split('/')[0].trim();
                console.log(`[AddressList] Stripped CIDR from IP: ${ipAddress} -> ${normalizedIP}`);
            }
            // Validate IP format after normalization
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(normalizedIP)) {
                throw new Error(`Invalid IP address format: ${ipAddress}. Must be in format X.X.X.X or X.X.X.X/CIDR`);
            }
            // Validate each octet is 0-255
            const octets = normalizedIP.split('.');
            for (const octet of octets) {
                const num = parseInt(octet, 10);
                if (isNaN(num) || num < 0 || num > 255) {
                    throw new Error(`Invalid IP address: ${ipAddress}. Octet ${octet} is out of range (0-255)`);
                }
            }
            // Use normalized IP for all operations
            ipAddress = normalizedIP;
            // Add to address list
            const finalComment = comment || `Added by billing system at ${new Date().toISOString()}`;
            const params = [
                `=list=${listName}`,
                `=address=${ipAddress}`,
                `=comment=${finalComment}`
            ];
            console.log(`[AddressList] Adding IP with params:`, params);
            console.log(`[AddressList] List: ${listName}, IP: ${ipAddress}, Comment: ${finalComment}`);
            // Retry mechanism for transient errors
            let retries = 2; // Try up to 3 times total
            let lastError = null;
            let attemptNumber = 0;
            while (retries >= 0) {
                attemptNumber++;
                try {
                    console.log(`[AddressList] Attempt ${attemptNumber}/3: Adding IP to address list...`);
                    // Try to add IP to address list
                    const result = await api.write('/ip/firewall/address-list/add', params);
                    console.log(`[AddressList] ✅ API write completed`);
                    console.log(`[AddressList] API response type:`, typeof result);
                    console.log(`[AddressList] API response:`, result);
                    // Mikrotik API returns empty on success for add commands
                    // If we get here without exception, it's a success
                    console.log(`✅ Successfully added ${ipAddress} to address-list: ${listName}`);
                    // Clear cache for this list
                    MikrotikCacheService_1.default.clearByPattern(`addresslist:${listName}`);
                    // Wait a bit then verify it was added
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // Verify by checking if IP exists in list
                    try {
                        const verifyResult = await api.write('/ip/firewall/address-list/print', [
                            `?list=${listName}`,
                            `?address=${ipAddress}`
                        ]);
                        const verifyArray = Array.isArray(verifyResult) ? verifyResult : [];
                        if (verifyArray.length > 0) {
                            console.log(`[AddressList] ✅ Verification: IP ${ipAddress} confirmed in list ${listName}`);
                            return true;
                        }
                        else {
                            console.warn(`[AddressList] ⚠️ Warning: IP added but not found in verification (might be timing issue)`);
                            // Still return true - Mikrotik might need a moment to update
                            return true;
                        }
                    }
                    catch (verifyError) {
                        console.warn(`[AddressList] ⚠️ Verification failed but assuming success:`, verifyError);
                        // Still return true - add command succeeded even if verification fails
                        return true;
                    }
                }
                catch (addError) {
                    lastError = addError;
                    const errorMsg = addError?.message || addError?.toString() || 'Unknown error';
                    const errno = (addError && typeof addError === 'object' && 'errno' in addError) ? addError.errno : null;
                    console.error(`[AddressList] ❌ Error on attempt ${attemptNumber}:`, errorMsg);
                    console.error(`[AddressList] Error details:`, {
                        message: errorMsg,
                        errno: errno,
                        code: addError?.code,
                        type: addError?.name || typeof addError
                    });
                    // Check if IP already exists - this is actually success
                    if (errorMsg.includes('already') ||
                        errorMsg.toLowerCase().includes('duplicate') ||
                        errorMsg.includes('already have') ||
                        errorMsg.toLowerCase().includes('entry already')) {
                        console.log(`[AddressList] ℹ️ IP already exists in list (this is success)`);
                        return true;
                    }
                    // Permission errors - don't retry
                    if (errorMsg.includes('permission') ||
                        errorMsg.includes('denied') ||
                        errorMsg.includes('policy') ||
                        errorMsg.includes('not allowed')) {
                        console.error(`[AddressList] ❌ Permission denied: User ${this.config.username} needs write permission for firewall/address-list`);
                        throw new Error(`Permission denied: User ${this.config.username} needs write permission for firewall/address-list`);
                    }
                    // Check if this is a connection error that might benefit from retry
                    const isConnectionError = errno === -4039 ||
                        errorMsg.includes('ECONNREFUSED') ||
                        errorMsg.includes('connection') ||
                        errorMsg.includes('timeout') ||
                        errorMsg.includes('ECONNRESET') ||
                        (errorMsg.includes('RosException') && errno);
                    // Retry connection errors up to 2 more times with delay
                    if (isConnectionError && retries > 0) {
                        const delayMs = 1000 * (3 - retries); // 1s, 2s delays
                        console.warn(`[AddressList] ⚠️ Connection error, retrying in ${delayMs}ms... (${retries} retries left)`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                        retries--;
                        continue;
                    }
                    // Non-connection errors or last retry - throw immediately
                    if (retries === 0) {
                        console.error(`[AddressList] ❌ All retry attempts exhausted`);
                        throw addError;
                    }
                    // For other errors, try once more
                    if (!isConnectionError) {
                        console.warn(`[AddressList] ⚠️ Non-connection error, retrying once more... (${retries} retries left)`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        retries--;
                        continue;
                    }
                    retries--;
                }
            }
            // Should never reach here, but just in case
            throw lastError || new Error('Failed to add IP after retries');
        }
        catch (error) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            const errno = (error && typeof error === 'object' && 'errno' in error) ? error.errno : null;
            console.error(`[AddressList] ❌ CRITICAL ERROR adding ${ipAddress} to address-list ${listName}`);
            console.error(`[AddressList] Error type:`, error?.name || typeof error);
            console.error(`[AddressList] Error message:`, errorMsg);
            console.error(`[AddressList] Error code:`, error?.code);
            console.error(`[AddressList] Error errno:`, errno);
            console.error(`[AddressList] Error stack:`, error?.stack);
            // Create user-friendly error message
            let userFriendlyError = 'Gagal menambahkan IP ke address list';
            if (error?.message) {
                // Connection errors (most common issue)
                if (error.message.includes('Connection timeout') || error.message.includes('timeout') ||
                    error.message.includes('ECONNREFUSED') || errno === -4039 ||
                    error.message.includes('connection') || error.message.includes('ECONNRESET')) {
                    userFriendlyError = `❌ KONEKSI GAGAL: Tidak bisa terhubung ke Mikrotik ${this.config.host}:${this.config.port}\n\n` +
                        `🔍 CHECKLIST:\n` +
                        `1. ✅ Pastikan Mikrotik API aktif (Services > API > Enabled)\n` +
                        `2. ✅ Pastikan port API ${this.config.port} tidak terblokir firewall\n` +
                        `3. ✅ Pastikan server bisa ping ke ${this.config.host}\n` +
                        `4. ✅ Pastikan IP Mikrotik di Settings benar\n` +
                        `5. ✅ Cek apakah Mikrotik API user '${this.config.username}' ada dan aktif`;
                    console.error(`[AddressList] ⚠️ Connection issue: Check network connectivity to ${this.config.host}:${this.config.port}`);
                    console.error(`[AddressList] ⚠️ Troubleshooting steps:`);
                    console.error(`[AddressList]    1. Test ping: ping ${this.config.host}`);
                    console.error(`[AddressList]    2. Test port: telnet ${this.config.host} ${this.config.port}`);
                    console.error(`[AddressList]    3. Check Mikrotik: Services > API > Should be enabled`);
                    console.error(`[AddressList]    4. Check firewall rules on Mikrotik`);
                }
                else if (error.message.includes('login') || error.message.includes('password') || error.message.includes('authentication')) {
                    userFriendlyError = '❌ AUTENTIKASI GAGAL: Periksa username dan password Mikrotik.';
                    console.error(`[AddressList] ⚠️ Authentication issue: Check username/password for user ${this.config.username}`);
                }
                else if (error.message.includes('permission') || error.message.includes('denied') || error.message.includes('policy')) {
                    userFriendlyError = `❌ PERMISSION DENIED: User ${this.config.username} tidak punya permission write untuk firewall/address-list.\n\n` +
                        `💡 SOLUTION: Add user to 'full' group or give write permission for firewall`;
                    console.error(`[AddressList] ⚠️ Permission issue: User ${this.config.username} needs write permission for firewall/address-list`);
                    console.error(`[AddressList] ⚠️ Solution: Add user to 'full' group or give write permission for firewall`);
                }
                else if (error.message.includes('Invalid IP')) {
                    userFriendlyError = error.message;
                }
                else if (error.message.includes('already') || error.message.toLowerCase().includes('duplicate')) {
                    // IP already exists - this is actually success
                    console.log(`[AddressList] ℹ️ IP already exists (treating as success)`);
                    return true;
                }
                else {
                    userFriendlyError = `❌ Error: ${error.message}`;
                }
            }
            // Log detailed troubleshooting info
            console.error(`[AddressList] ⚠️ TROUBLESHOOTING INFO:`);
            console.error(`[AddressList]   1. Mikrotik Host: ${this.config.host}:${this.config.port}`);
            console.error(`[AddressList]   2. Username: ${this.config.username}`);
            console.error(`[AddressList]   3. IP Address: ${ipAddress}`);
            console.error(`[AddressList]   4. Address List: ${listName}`);
            console.error(`[AddressList]   5. Error: ${errorMsg}`);
            // Store error for better error reporting
            error.userFriendlyMessage = userFriendlyError;
            // Throw error with user-friendly message so controller can catch it
            const enhancedError = new Error(userFriendlyError);
            enhancedError.userFriendlyMessage = userFriendlyError;
            enhancedError.originalError = error;
            throw enhancedError;
        }
        finally {
            if (apiConnected) {
                try {
                    api.close();
                    console.log(`[AddressList] Connection closed`);
                }
                catch (closeError) {
                    console.warn(`[AddressList] Error closing connection:`, closeError);
                }
            }
        }
    }
    /**
     * Remove IP address from address list
     * @param listName - Name of address list
     * @param ipAddress - IP address to remove
     */
    async removeFromAddressList(listName, ipAddress) {
        const api = new node_routeros_1.RouterOSAPI({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            timeout: MikrotikAddressListService.TIMEOUT
        });
        try {
            await api.connect();
            // Get all entries from the list first, then filter
            const allEntries = await api.write('/ip/firewall/address-list/print', [
                `?list=${listName}`
            ]);
            const allEntriesArray = Array.isArray(allEntries) ? allEntries : [];
            // Filter entries matching the IP address
            const entries = allEntriesArray.filter((entry) => entry.address === ipAddress);
            if (entries.length === 0) {
                console.log(`⚠️  IP ${ipAddress} not found in list ${listName}`);
                return true; // Already not in list
            }
            // Remove all matching entries
            for (const entry of entries) {
                const id = entry['.id'];
                if (id) {
                    await api.write('/ip/firewall/address-list/remove', [`=.id=${id}`]);
                    console.log(`✅ Removed ${ipAddress} from address-list: ${listName}`);
                }
            }
            // Clear cache for this list
            MikrotikCacheService_1.default.clearByPattern(`addresslist:${listName}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to remove ${ipAddress} from address-list ${listName}:`, error);
            return false;
        }
        finally {
            api.close();
        }
    }
    /**
     * Move IP from one address list to another
     * @param ipAddress - IP address to move
     * @param fromList - Source list name
     * @param toList - Destination list name
     * @param comment - Optional comment
     */
    async moveToAddressList(ipAddress, fromList, toList, comment) {
        try {
            // Remove from old list
            await this.removeFromAddressList(fromList, ipAddress);
            // Add to new list
            await this.addToAddressList(toList, ipAddress, comment);
            console.log(`✅ Moved ${ipAddress} from ${fromList} to ${toList}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to move ${ipAddress} from ${fromList} to ${toList}:`, error);
            return false;
        }
    }
    /**
     * Check if IP exists in address list
     * @param listName - Name of address list
     * @param ipAddress - IP address to check
     */
    async isInAddressList(listName, ipAddress) {
        const api = new node_routeros_1.RouterOSAPI({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            timeout: MikrotikAddressListService.TIMEOUT
        });
        try {
            await api.connect();
            // Get all entries from the list first, then filter
            const allEntries = await api.write('/ip/firewall/address-list/print', [
                `?list=${listName}`
            ]);
            const allEntriesArray = Array.isArray(allEntries) ? allEntries : [];
            // Check if IP exists
            const entries = allEntriesArray.filter((entry) => entry.address === ipAddress);
            return entries.length > 0;
        }
        catch (error) {
            console.error(`❌ Failed to check ${ipAddress} in address-list ${listName}:`, error);
            return false;
        }
        finally {
            api.close();
        }
    }
    /**
     * Get all IPs in address list (WITH AGGRESSIVE CACHING!)
     * @param listName - Name of address list
     */
    async getAddressListEntries(listName) {
        // Check cache first (INSTANT!)
        const cacheKey = `addresslist:${listName}`;
        const cached = MikrotikCacheService_1.default.get(cacheKey);
        if (cached) {
            console.log(`[AddressList] Cache HIT for ${listName}`);
            return cached;
        }
        console.log(`[AddressList] Cache MISS for ${listName}, fetching from Mikrotik...`);
        const api = new node_routeros_1.RouterOSAPI({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            timeout: MikrotikAddressListService.TIMEOUT
        });
        try {
            await api.connect();
            const entries = await api.write('/ip/firewall/address-list/print', [
                `?list=${listName}`
            ]);
            const result = Array.isArray(entries) ? entries : [];
            // Cache the result for 3 minutes
            MikrotikCacheService_1.default.set(cacheKey, result, 180000); // 3 minutes
            console.log(`[AddressList] Cached ${result.length} entries for ${listName}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Failed to get entries from address-list ${listName}:`, error);
            return [];
        }
        finally {
            api.close();
        }
    }
    /**
     * Clear all entries from address list
     * @param listName - Name of address list
     */
    async clearAddressList(listName) {
        const api = new node_routeros_1.RouterOSAPI({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            timeout: MikrotikAddressListService.TIMEOUT
        });
        try {
            await api.connect();
            const entries = await api.write('/ip/firewall/address-list/print', [
                `?list=${listName}`
            ]);
            if (!Array.isArray(entries) || entries.length === 0) {
                console.log(`✅ Address-list ${listName} already empty`);
                return true;
            }
            for (const entry of entries) {
                const id = entry['.id'];
                if (id) {
                    await api.write('/ip/firewall/address-list/remove', [`=.id=${id}`]);
                }
            }
            // Clear cache for this list
            MikrotikCacheService_1.default.clearByPattern(`addresslist:${listName}`);
            console.log(`✅ Cleared all entries from address-list: ${listName}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to clear address-list ${listName}:`, error);
            return false;
        }
        finally {
            api.close();
        }
    }
}
exports.MikrotikAddressListService = MikrotikAddressListService;
MikrotikAddressListService.TIMEOUT = 3000; // 3 seconds (faster!)
exports.default = MikrotikAddressListService;
//# sourceMappingURL=MikrotikAddressListService.js.map