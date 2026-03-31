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
exports.ActivationService = void 0;
const pool_1 = require("../../db/pool");
const WhatsAppService_1 = require("../whatsapp/WhatsAppService");
class ActivationService {
    /**
     * Finalize activation after payment is confirmed
     */
    static async activate(pendingRegistrationId) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            // 1. Get Pending Registration Info
            const [regs] = await conn.query("SELECT * FROM pending_registrations WHERE id = ?", [pendingRegistrationId]);
            if (regs.length === 0)
                throw new Error('Registrasi tidak ditemukan');
            const reg = regs[0];
            if (reg.status === 'approved') {
                await conn.rollback();
                return { success: true, message: 'Sudah aktif' };
            }
            // 2. Create Customer
            const customerCode = `C${Date.now().toString().slice(-8)}`;
            const [custResult] = await conn.query(`INSERT INTO customers (customer_code, name, phone, address, coordinates, billing_mode, status, created_at)
                 VALUES (?, ?, ?, ?, ?, 'postpaid', 'active', NOW())`, [customerCode, reg.name, reg.phone, reg.address, reg.coordinates]);
            const customerId = custResult.insertId;
            // 3. Setup PPPoE Account
            let pppoeUser = '';
            let pppoePass = '';
            if (reg.package_id) {
                const [pkgs] = await conn.query("SELECT pp.*, ppr.id as profile_id, ppr.name as profile_name FROM pppoe_packages pp LEFT JOIN pppoe_profiles ppr ON pp.profile_id = ppr.id WHERE pp.id = ?", [reg.package_id]);
                if (pkgs.length > 0) {
                    const pkg = pkgs[0];
                    pppoeUser = `${customerCode.toLowerCase()}@isp`;
                    pppoePass = Math.random().toString(36).slice(-8);
                    await conn.query(`UPDATE customers SET pppoe_username = ?, pppoe_password = ?, pppoe_profile_id = ? WHERE id = ?`, [pppoeUser, pppoePass, pkg.profile_id, customerId]);
                    // Create in MikroTik
                    try {
                        const { MikrotikService } = await Promise.resolve().then(() => __importStar(require('../mikrotik/MikrotikService')));
                        const mt = await MikrotikService.getInstance();
                        await mt.createPPPoEUser({
                            name: pppoeUser,
                            password: pppoePass,
                            profile: pkg.profile_name || 'default',
                            comment: reg.name
                        });
                    }
                    catch (mtErr) {
                        console.error('Mikrotik creation error:', mtErr);
                    }
                }
            }
            // 4. Update Pending Registration Status
            await conn.query(`UPDATE pending_registrations SET status = 'approved', approved_at = NOW() WHERE id = ?`, [pendingRegistrationId]);
            // 5. Update Job Customer ID
            await conn.query(`UPDATE technician_jobs SET customer_id = ? WHERE pending_registration_id = ?`, [customerId, pendingRegistrationId]);
            await conn.commit();
            // 6. Send Success Notification with Invoice REF
            const receiptRef = `RCP-ACT-${Date.now().toString().slice(-6)}`;
            const waMessage = `
✅ *AKTIVASI LAYANAN BERHASIL*

Selamat! Pembayaran aktivasi Anda telah kami terima dan diverifikasi. Layanan internet Anda kini telah AKTIF.

📋 *DATA AKUN:*
👤 Nama: ${reg.name}
🆔 Kode Pelanggan: *${customerCode}*
🌐 PPPoE User: *${pppoeUser}*
🔑 PPPoE Pass: *${pppoePass}*

📝 *BUKTI PEMBAYARAN:*
🧾 NO. REF: *${receiptRef}*
💰 Status: *LUNAS*

Silakan masukkan data akun tersebut ke dalam router Anda. Jika membutuhkan bantuan, hubungi teknisi kami. Terima kasih telah berlangganan! 🙏
`.trim();
            const wa = WhatsAppService_1.whatsappService;
            await wa.sendMessage(reg.phone, waMessage);
            return { success: true, message: 'Aktivasi berhasil', customerId };
        }
        catch (error) {
            await conn.rollback();
            console.error('Activation error:', error);
            return { success: false, message: error.message };
        }
        finally {
            conn.release();
        }
    }
}
exports.ActivationService = ActivationService;
//# sourceMappingURL=ActivationService.js.map