"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MikrotikAddressListService_1 = __importDefault(require("../../services/mikrotik/MikrotikAddressListService"));
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
/**
 * Controller untuk Address List Management
 * Versi baru - sederhana dan bersih
 */
class PrepaidAddressListController {
    /**
     * Show address list management page
     */
    async index(req, res) {
        // FORCE: Remove any query error related to database config
        const urlError = req.query.error;
        if (urlError && typeof urlError === 'string') {
            const errLower = urlError.toLowerCase();
            if (errLower.includes('konfigurasi') || errLower.includes('mendapatkan')) {
                return res.redirect(302, '/prepaid/address-list');
            }
        }
        try {
            // Get Mikrotik config (safe helper)
            let config = null;
            try {
                config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            }
            catch (configError) {
                config = null;
            }
            if (!config) {
                return res.render('prepaid/address-list', {
                    title: 'Address List Management',
                    currentPath: '/prepaid/address-list',
                    error: null, // No error - just show empty state
                    noPackageList: [],
                    activeList: [],
                    mikrotikConfigured: false,
                    info: 'Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik'
                });
            }
            // Create service instance
            const addressListService = new MikrotikAddressListService_1.default({
                host: config.host,
                username: config.username,
                password: config.password,
                port: config.api_port || config.port || 8728
            });
            // Fetch address lists (with error handling)
            let noPackageList = [];
            let activeList = [];
            let connectionError = null;
            try {
                noPackageList = await addressListService.getAddressListEntries('prepaid-no-package');
            }
            catch (error) {
                connectionError = error instanceof Error ? error.message : 'Gagal mengambil data dari Mikrotik';
            }
            try {
                activeList = await addressListService.getAddressListEntries('prepaid-active');
            }
            catch (error) {
                if (!connectionError) {
                    connectionError = error instanceof Error ? error.message : 'Gagal mengambil data dari Mikrotik';
                }
            }
            // Render page
            res.render('prepaid/address-list', {
                title: 'Address List Management',
                currentPath: '/prepaid/address-list',
                noPackageList: noPackageList || [],
                activeList: activeList || [],
                mikrotikConfigured: true,
                mikrotikHost: config.host,
                mikrotikPort: config.api_port || config.port || 8728,
                success: req.query.success || null,
                error: connectionError ? `Koneksi Mikrotik error: ${connectionError}` : null
            });
        }
        catch (error) {
            // Catch any unexpected errors
            const errorMsg = error instanceof Error ? error.message : '';
            console.error('[AddressList] Unexpected error:', error);
            // Never show database config error - replace with friendly message
            let displayError = 'Terjadi kesalahan saat memuat halaman';
            if (errorMsg.includes('konfigurasi Mikrotik') || errorMsg.includes('database')) {
                displayError = 'Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik';
            }
            res.render('prepaid/address-list', {
                title: 'Address List Management',
                currentPath: '/prepaid/address-list',
                error: displayError,
                noPackageList: [],
                activeList: [],
                mikrotikConfigured: false
            });
        }
    }
    /**
     * Add IP to address list
     */
    async addToList(req, res) {
        try {
            const { list_name, ip_address, comment } = req.body;
            // Validation
            if (!list_name || !ip_address) {
                return res.redirect('/prepaid/address-list?error=List name dan IP address harus diisi');
            }
            // Normalize IP (remove CIDR if present)
            let normalizedIP = ip_address.trim();
            if (normalizedIP.includes('/')) {
                normalizedIP = normalizedIP.split('/')[0].trim();
            }
            // Validate IP format
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(normalizedIP)) {
                return res.redirect('/prepaid/address-list?error=Format IP address tidak valid');
            }
            // Validate octets
            const octets = normalizedIP.split('.');
            for (const octet of octets) {
                const num = parseInt(octet, 10);
                if (isNaN(num) || num < 0 || num > 255) {
                    return res.redirect(`/prepaid/address-list?error=IP address tidak valid: ${normalizedIP}`);
                }
            }
            // Get Mikrotik config (safe - will never throw error)
            let config = null;
            try {
                config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            }
            catch (e) {
                config = null;
            }
            if (!config) {
                return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik');
            }
            // Create service and add IP
            const addressListService = new MikrotikAddressListService_1.default({
                host: config.host,
                username: config.username,
                password: config.password,
                port: config.api_port || config.port || 8728
            });
            await addressListService.addToAddressList(list_name, normalizedIP, comment || `Manual add by admin at ${new Date().toISOString()}`);
            res.redirect(`/prepaid/address-list?success=IP ${normalizedIP} berhasil ditambahkan ke ${list_name}`);
        }
        catch (error) {
            const errorMsg = (error && typeof error === 'object' && 'userFriendlyMessage' in error
                ? String(error.userFriendlyMessage)
                : error instanceof Error ? error.message : 'Gagal menambahkan IP') || 'Gagal menambahkan IP';
            console.error('[AddressList] Add error:', error);
            res.redirect(`/prepaid/address-list?error=${encodeURIComponent(errorMsg)}`);
        }
    }
    /**
     * Remove IP from address list
     */
    async removeFromList(req, res) {
        try {
            const { list_name, ip_address } = req.body;
            if (!list_name || !ip_address) {
                return res.redirect('/prepaid/address-list?error=List name dan IP address harus diisi');
            }
            // Get Mikrotik config (safe - will never throw error)
            let config = null;
            try {
                config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            }
            catch (e) {
                config = null;
            }
            if (!config) {
                return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik');
            }
            // Create service and remove IP
            const addressListService = new MikrotikAddressListService_1.default({
                host: config.host,
                username: config.username,
                password: config.password,
                port: config.api_port || config.port || 8728
            });
            await addressListService.removeFromAddressList(list_name, ip_address);
            res.redirect(`/prepaid/address-list?success=IP ${ip_address} berhasil dihapus dari ${list_name}`);
        }
        catch (error) {
            const errorMsg = (error && typeof error === 'object' && 'userFriendlyMessage' in error
                ? String(error.userFriendlyMessage)
                : error instanceof Error ? error.message : 'Gagal menghapus IP') || 'Gagal menghapus IP';
            console.error('[AddressList] Remove error:', error);
            res.redirect(`/prepaid/address-list?error=${encodeURIComponent(errorMsg)}`);
        }
    }
    /**
     * Move IP between lists
     */
    async moveToList(req, res) {
        try {
            const { ip_address, from_list, to_list, comment } = req.body;
            if (!ip_address || !from_list || !to_list) {
                return res.redirect('/prepaid/address-list?error=Semua field harus diisi');
            }
            // Get Mikrotik config (safe - will never throw error)
            let config = null;
            try {
                config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            }
            catch (e) {
                config = null;
            }
            if (!config) {
                return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik');
            }
            // Create service and move IP
            const addressListService = new MikrotikAddressListService_1.default({
                host: config.host,
                username: config.username,
                password: config.password,
                port: config.api_port || config.port || 8728
            });
            await addressListService.moveToAddressList(ip_address, from_list, to_list, comment || `Moved by admin at ${new Date().toISOString()}`);
            res.redirect(`/prepaid/address-list?success=IP ${ip_address} berhasil dipindah dari ${from_list} ke ${to_list}`);
        }
        catch (error) {
            const errorMsg = (error && typeof error === 'object' && 'userFriendlyMessage' in error
                ? String(error.userFriendlyMessage)
                : error instanceof Error ? error.message : 'Gagal memindahkan IP') || 'Gagal memindahkan IP';
            console.error('[AddressList] Move error:', error);
            res.redirect(`/prepaid/address-list?error=${encodeURIComponent(errorMsg)}`);
        }
    }
    /**
     * Clear all entries from a list
     */
    async clearList(req, res) {
        try {
            const { list_name } = req.body;
            if (!list_name) {
                return res.redirect('/prepaid/address-list?error=List name harus diisi');
            }
            // Get Mikrotik config (safe - will never throw error)
            let config = null;
            try {
                config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            }
            catch (e) {
                config = null;
            }
            if (!config) {
                return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik');
            }
            // Create service and clear list
            const addressListService = new MikrotikAddressListService_1.default({
                host: config.host,
                username: config.username,
                password: config.password,
                port: config.api_port || config.port || 8728
            });
            await addressListService.clearAddressList(list_name);
            res.redirect(`/prepaid/address-list?success=Address list ${list_name} berhasil dibersihkan`);
        }
        catch (error) {
            const errorMsg = (error && typeof error === 'object' && 'userFriendlyMessage' in error
                ? String(error.userFriendlyMessage)
                : error instanceof Error ? error.message : 'Gagal membersihkan address list') || 'Gagal membersihkan address list';
            console.error('[AddressList] Clear error:', error);
            res.redirect(`/prepaid/address-list?error=${encodeURIComponent(errorMsg)}`);
        }
    }
}
exports.default = new PrepaidAddressListController();
//# sourceMappingURL=PrepaidAddressListController.js.map