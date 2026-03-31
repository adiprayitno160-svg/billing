"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaticIpPackageList = getStaticIpPackageList;
exports.getStaticIpPackageAdd = getStaticIpPackageAdd;
exports.getStaticIpPackageEdit = getStaticIpPackageEdit;
exports.postStaticIpPackageCreate = postStaticIpPackageCreate;
exports.postStaticIpPackageUpdate = postStaticIpPackageUpdate;
exports.postStaticIpPackageCreateQueues = postStaticIpPackageCreateQueues;
exports.postStaticIpPackageDelete = postStaticIpPackageDelete;
exports.postStaticIpPackageDeleteQueues = postStaticIpPackageDeleteQueues;
exports.apiDeletePackage = apiDeletePackage;
exports.postStaticIpPackageSyncAll = postStaticIpPackageSyncAll;
exports.postStaticIpPackageCopy = postStaticIpPackageCopy;
const staticIpPackageService_1 = require("../services/staticIpPackageService");
const mikrotikInterfaceService_1 = require("../services/mikrotikInterfaceService");
async function getStaticIpPackageList(req, res, next) {
    try {
        const packages = await (0, staticIpPackageService_1.listStaticIpPackages)();
        res.render('packages/static_ip_packages', {
            title: 'Paket IP Static',
            packages,
            success: req.flash('success'),
            error: req.flash('error')
        });
    }
    catch (err) {
        next(err);
    }
}
async function getStaticIpPackageAdd(req, res, next) {
    try {
        const interfaces = await (0, mikrotikInterfaceService_1.getMikrotikInterfaces)();
        res.render('packages/static_ip_add', {
            title: 'Tambah Paket IP Static',
            error: req.flash('error'),
            interfaces
        });
    }
    catch (err) {
        next(err);
    }
}
async function getStaticIpPackageEdit(req, res, next) {
    try {
        const id = Number(req.params.id);
        const packageData = await (0, staticIpPackageService_1.getStaticIpPackageById)(id);
        const interfaces = await (0, mikrotikInterfaceService_1.getMikrotikInterfaces)();
        if (!packageData) {
            req.flash('error', 'Paket tidak ditemukan');
            return res.redirect('/packages/static-ip');
        }
        res.render('packages/static_ip_edit', {
            title: 'Edit Paket IP Static',
            package: packageData,
            error: req.flash('error'),
            interfaces
        });
    }
    catch (err) {
        next(err);
    }
}
async function postStaticIpPackageCreate(req, res, next) {
    try {
        const { name, parent_upload_name, parent_download_name, max_limit_upload, limit_at_upload, max_limit_download, limit_at_download, max_clients, child_upload_name, child_download_name, child_upload_limit, child_download_limit, child_limit_at_upload, child_limit_at_download, child_burst_upload, child_burst_download, child_queue_type_download, child_queue_type_upload, child_priority_download, child_priority_upload, child_burst_threshold_download, child_burst_threshold_upload, child_burst_time_download, child_burst_time_upload, price, price_7_days, price_30_days, duration_days, status, description, enable_burst } = req.body;
        if (!name)
            throw new Error('Nama paket wajib diisi');
        // REF ACTOR: Relaxed validation for Simple Queue mode
        // if (!parent_upload_name) throw new Error('Parent upload wajib diisi');
        // if (!parent_download_name) throw new Error('Parent download wajib diisi');
        if (!max_limit_upload)
            throw new Error('Max limit upload wajib diisi');
        if (!max_limit_download)
            throw new Error('Max limit download wajib diisi');
        if (!max_clients || Number(max_clients) < 1)
            throw new Error('Max clients harus minimal 1');
        // if (!child_upload_name) throw new Error('Child upload name wajib diisi');
        // if (!child_download_name) throw new Error('Child download name wajib diisi');
        // ... (previous checks)
        // if (!child_download_name) throw new Error('Child download name wajib diisi');
        if (!price || Number(price) < 0)
            throw new Error('Harga harus lebih dari 0');
        // Removed mandatory duration check, defaulted to 30
        await (0, staticIpPackageService_1.createStaticIpPackage)({
            name,
            // Default values for DB compatibility
            parent_upload_name: parent_upload_name || 'SIMPLE_QUEUE_PARENT',
            parent_download_name: parent_download_name || 'SIMPLE_QUEUE_PARENT',
            max_limit_upload,
            max_limit_download,
            max_clients: Number(max_clients),
            child_upload_name: child_upload_name || `${name}_UPLOAD`,
            child_download_name: child_download_name || `${name}_DOWNLOAD`,
            child_upload_limit: child_upload_limit || undefined,
            child_download_limit: child_download_limit || undefined,
            child_limit_at_upload: child_limit_at_upload || undefined,
            child_limit_at_download: child_limit_at_download || undefined,
            child_burst_upload: enable_burst === 'on' ? (child_burst_upload || undefined) : null,
            child_burst_download: enable_burst === 'on' ? (child_burst_download || undefined) : null,
            child_queue_type_download: child_queue_type_download || undefined,
            child_queue_type_upload: child_queue_type_upload || undefined,
            child_priority_download: child_priority_download || undefined,
            child_priority_upload: child_priority_upload || undefined,
            child_burst_threshold_download: enable_burst === 'on' ? (child_burst_threshold_download || undefined) : null,
            child_burst_threshold_upload: enable_burst === 'on' ? (child_burst_threshold_upload || undefined) : null,
            child_burst_time_download: enable_burst === 'on' ? (child_burst_time_download || undefined) : null,
            child_burst_time_upload: enable_burst === 'on' ? (child_burst_time_upload || undefined) : null,
            price: Number(price),
            price_7_days: price_7_days ? Number(price_7_days) : undefined,
            price_30_days: price_30_days ? Number(price_30_days) : undefined,
            duration_days: duration_days ? Number(duration_days) : 30, // Default 30 days
            status: status,
            description: description || undefined
        });
        req.flash('success', 'Paket IP Static berhasil dibuat');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal membuat paket IP Static');
        res.redirect('/packages/static-ip');
    }
}
async function postStaticIpPackageUpdate(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { name, parent_upload_name, parent_download_name, max_limit_upload, limit_at_upload, max_limit_download, limit_at_download, max_clients, child_upload_name, child_download_name, child_upload_limit, child_download_limit, child_limit_at_upload, child_limit_at_download, child_burst_upload, child_burst_download, child_queue_type_download, child_queue_type_upload, child_priority_download, child_priority_upload, child_burst_threshold_download, child_burst_threshold_upload, child_burst_time_download, child_burst_time_upload, price, duration_days, status, description, enable_burst } = req.body;
        if (!name)
            throw new Error('Nama paket wajib diisi');
        // if (!parent_upload_name) throw new Error('Parent upload wajib diisi');
        // if (!parent_download_name) throw new Error('Parent download wajib diisi');
        if (!max_limit_upload)
            throw new Error('Max limit upload wajib diisi');
        if (!max_limit_download)
            throw new Error('Max limit download wajib diisi');
        if (max_clients && Number(max_clients) < 1)
            throw new Error('Max clients harus minimal 1');
        // if (child_upload_name && !child_upload_name.trim()) throw new Error('Child upload name tidak boleh kosong');
        // if (child_download_name && !child_download_name.trim()) throw new Error('Child download name tidak boleh kosong');
        if (price && Number(price) < 0)
            throw new Error('Harga harus lebih dari 0');
        // field removed
        await (0, staticIpPackageService_1.updateStaticIpPackage)(id, {
            name,
            parent_upload_name,
            parent_download_name,
            max_limit_upload,
            limit_at_upload,
            max_limit_download,
            limit_at_download,
            max_clients: max_clients ? Number(max_clients) : undefined,
            child_upload_name: child_upload_name || undefined,
            child_download_name: child_download_name || undefined,
            child_upload_limit: child_upload_limit || undefined,
            child_download_limit: child_download_limit || undefined,
            child_limit_at_upload: child_limit_at_upload || undefined,
            child_limit_at_download: child_limit_at_download || undefined,
            child_burst_upload: enable_burst === 'on' ? (child_burst_upload || undefined) : null,
            child_burst_download: enable_burst === 'on' ? (child_burst_download || undefined) : null,
            child_queue_type_download: child_queue_type_download || undefined,
            child_queue_type_upload: child_queue_type_upload || undefined,
            child_priority_download: child_priority_download || undefined,
            child_priority_upload: child_priority_upload || undefined,
            child_burst_threshold_download: enable_burst === 'on' ? (child_burst_threshold_download || undefined) : null,
            child_burst_threshold_upload: enable_burst === 'on' ? (child_burst_threshold_upload || undefined) : null,
            child_burst_time_download: enable_burst === 'on' ? (child_burst_time_download || undefined) : null,
            child_burst_time_upload: enable_burst === 'on' ? (child_burst_time_upload || undefined) : null,
            price: price ? Number(price) : undefined,
            duration_days: duration_days ? Number(duration_days) : undefined,
            status: status,
            description: description || undefined
        });
        req.flash('success', 'Paket IP Static berhasil diupdate');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal mengupdate paket IP Static');
        res.redirect('/packages/static-ip');
    }
}
async function postStaticIpPackageCreateQueues(req, res, next) {
    try {
        const id = Number(req.params.id);
        await (0, staticIpPackageService_1.createMikrotikQueues)(id);
        req.flash('success', 'Queue MikroTik berhasil dibuat');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal membuat queue MikroTik');
        res.redirect('/packages/static-ip');
    }
}
async function postStaticIpPackageDelete(req, res, next) {
    try {
        const id = Number(req.params.id);
        await (0, staticIpPackageService_1.deleteStaticIpPackage)(id);
        req.flash('success', 'Paket IP Static berhasil dihapus');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus paket IP Static');
        res.redirect('/packages/static-ip');
    }
}
async function postStaticIpPackageDeleteQueues(req, res, next) {
    try {
        const id = Number(req.params.id);
        await (0, staticIpPackageService_1.deleteMikrotikQueuesOnly)(id);
        req.flash('success', 'Queue MikroTik untuk paket ini telah dihapus');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus queue MikroTik');
        res.redirect('/packages/static-ip');
    }
}
// API: Delete package with option to delete queues
async function apiDeletePackage(req, res) {
    try {
        const id = Number(req.params.id);
        const deleteQueues = req.body.deleteQueues === 'true' || req.body.deleteQueues === true;
        // Jika opsi hapus queue dicentang, hapus queue dulu
        if (deleteQueues) {
            try {
                await (0, staticIpPackageService_1.deleteMikrotikQueuesOnly)(id);
                console.log(`[Delete Package] Queue MikroTik untuk paket ${id} berhasil dihapus`);
            }
            catch (queueErr) {
                console.error(`[Delete Package] Gagal hapus queue: ${queueErr}`);
                // Lanjutkan hapus paket meskipun queue gagal dihapus
            }
        }
        // Hapus paket dari database
        await (0, staticIpPackageService_1.deleteStaticIpPackage)(id);
        res.json({ success: true, message: 'Paket berhasil dihapus' + (deleteQueues ? ' beserta Queue MikroTik' : '') });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : 'Gagal menghapus paket'
        });
    }
}
async function postStaticIpPackageSyncAll(req, res, next) {
    try {
        await (0, staticIpPackageService_1.syncAllMikrotikQueues)();
        if (req.method === 'GET') {
            res.send('Sync All Queues Success');
            return;
        }
        req.flash('success', 'Semua Queue Paket berhasil disinkronkan ke MikroTik');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        if (req.method === 'GET') {
            // res.status(500).send('Error');
            res.send('Error: ' + (err instanceof Error ? err.message : String(err)));
            return;
        }
        req.flash('error', err instanceof Error ? err.message : 'Gagal sinkronisasi global');
        res.redirect('/packages/static-ip');
    }
}
async function postStaticIpPackageCopy(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { copyStaticIpPackage } = await Promise.resolve().then(() => __importStar(require('../services/staticIpPackageService')));
        await copyStaticIpPackage(id);
        req.flash('success', 'Paket IP Static berhasil diduplikasi');
        res.redirect('/packages/static-ip');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal duplikasi paket');
        res.redirect('/packages/static-ip');
    }
}
//# sourceMappingURL=staticIpPackageController.js.map