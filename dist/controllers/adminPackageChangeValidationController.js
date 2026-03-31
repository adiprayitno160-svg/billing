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
exports.getPackageChangeValidationPage = getPackageChangeValidationPage;
exports.forcePackageChange = forcePackageChange;
exports.sendReminderNotification = sendReminderNotification;
exports.getPendingCustomers = getPendingCustomers;
const PackageChangeValidationService_1 = require("../services/billing/PackageChangeValidationService");
const pool_1 = require("../db/pool");
async function getPackageChangeValidationPage(req, res, next) {
    try {
        // Ambil semua pelanggan postpaid
        const [customers] = await pool_1.databasePool.query(`SELECT c.id, c.name, c.phone, c.billing_mode, c.connection_type, 
              COALESCE(s.package_name, sp.name) as package_name
       FROM customers c
       LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
       LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
       LEFT JOIN static_ip_packages sp ON sic.package_id = sp.id
       WHERE c.billing_mode = 'postpaid'
       ORDER BY c.name ASC`);
        // Periksa status validasi untuk setiap pelanggan
        const customersWithStatus = [];
        for (const customer of customers) {
            const validation = await PackageChangeValidationService_1.PackageChangeValidationService.validateCustomerPaymentStatus(customer.id);
            customersWithStatus.push({
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                billing_mode: customer.billing_mode,
                connection_type: customer.connection_type,
                package_name: customer.package_name,
                isValid: validation.isValid,
                message: validation.message,
                totalOutstandingAmount: validation.totalOutstandingAmount,
                outstandingInvoiceCount: validation.outstandingInvoices?.length
            });
        }
        res.render('admin/package-change-validation', {
            title: 'Validasi Perubahan Paket',
            customers: customersWithStatus,
            success: req.flash('success'),
            error: req.flash('error')
        });
    }
    catch (error) {
        console.error('Error getting package change validation page:', error);
        req.flash('error', 'Gagal memuat halaman validasi perubahan paket');
        res.redirect('/dashboard');
    }
}
async function forcePackageChange(req, res, next) {
    try {
        const { customerId, newPackageId, packageType, reason } = req.body;
        const adminId = req.session.userId || 0;
        // Import service secara dinamis untuk menghindari circular dependency
        const { PackageChangeService } = await Promise.resolve().then(() => __importStar(require('../services/billing/PackageChangeService')));
        const result = await PackageChangeService.forceChangePackage(parseInt(customerId), parseInt(newPackageId), packageType, adminId, reason);
        if (result.success) {
            req.flash('success', result.message);
        }
        else {
            req.flash('error', result.message);
        }
        res.redirect('/admin/package-change-validation');
    }
    catch (error) {
        console.error('Error forcing package change:', error);
        req.flash('error', 'Gagal memaksa perubahan paket');
        res.redirect('/admin/package-change-validation');
    }
}
async function sendReminderNotification(req, res, next) {
    try {
        const customerId = parseInt(req.params.customerId);
        // Import service secara dinamis
        const { PackageChangeNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/PackageChangeNotificationService')));
        const result = await PackageChangeNotificationService.sendOutstandingInvoiceNotification(customerId);
        if (result.success) {
            req.flash('success', `Notifikasi berhasil dikirim ke pelanggan`);
        }
        else {
            req.flash('error', `Gagal mengirim notifikasi: ${result.message}`);
        }
        res.redirect('/admin/package-change-validation');
    }
    catch (error) {
        console.error('Error sending reminder notification:', error);
        req.flash('error', 'Gagal mengirim notifikasi pengingat');
        res.redirect('/admin/package-change-validation');
    }
}
async function getPendingCustomers(req, res, next) {
    try {
        // Ambil pelanggan dengan tagihan tertunggak
        const [customers] = await pool_1.databasePool.query(`SELECT DISTINCT c.id, c.name, c.phone, c.billing_mode, 
              COALESCE(s.package_name, sp.name) as package_name,
              SUM(i.remaining_amount) as total_outstanding
       FROM customers c
       LEFT JOIN invoices i ON c.id = i.customer_id 
           AND i.status IN ('sent', 'partial', 'overdue')
           AND i.remaining_amount > 0
       LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
       LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
       LEFT JOIN static_ip_packages sp ON sic.package_id = sp.id
       WHERE c.billing_mode = 'postpaid'
       GROUP BY c.id, c.name, c.phone, c.billing_mode, s.package_name, sp.name
       HAVING total_outstanding > 0
       ORDER BY total_outstanding DESC`);
        res.json({
            success: true,
            customers: customers
        });
    }
    catch (error) {
        console.error('Error getting pending customers:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data pelanggan dengan tagihan tertunggak'
        });
    }
}
//# sourceMappingURL=adminPackageChangeValidationController.js.map