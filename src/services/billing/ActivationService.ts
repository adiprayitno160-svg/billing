
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { whatsappService } from '../whatsapp/WhatsAppService';

export class ActivationService {

    /**
     * Finalize activation after payment is confirmed
     */
    static async activate(pendingRegistrationId: number): Promise<{ success: boolean; message: string; customerId?: number }> {
        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Get Pending Registration Info
            const [regs] = await conn.query<RowDataPacket[]>(
                "SELECT * FROM pending_registrations WHERE id = ?", [pendingRegistrationId]
            );
            if (regs.length === 0) throw new Error('Registrasi tidak ditemukan');
            const reg = regs[0];

            if (reg.status === 'approved') {
                await conn.rollback();
                return { success: true, message: 'Sudah aktif' };
            }

            // 2. Create Customer
            const customerCode = `C${Date.now().toString().slice(-8)}`;
            const [custResult]: any = await conn.query(
                `INSERT INTO customers (customer_code, name, phone, address, coordinates, billing_mode, status, created_at)
                 VALUES (?, ?, ?, ?, ?, 'postpaid', 'active', NOW())`,
                [customerCode, reg.name, reg.phone, reg.address, reg.coordinates]
            );
            const customerId = custResult.insertId;

            // 3. Setup PPPoE Account
            let pppoeUser = '';
            let pppoePass = '';
            if (reg.package_id) {
                const [pkgs] = await conn.query<RowDataPacket[]>(
                    "SELECT pp.*, ppr.id as profile_id, ppr.name as profile_name FROM pppoe_packages pp LEFT JOIN pppoe_profiles ppr ON pp.profile_id = ppr.id WHERE pp.id = ?",
                    [reg.package_id]
                );

                if (pkgs.length > 0) {
                    const pkg = pkgs[0];
                    pppoeUser = `${customerCode.toLowerCase()}@isp`;
                    pppoePass = Math.random().toString(36).slice(-8);

                    await conn.query(
                        `UPDATE customers SET pppoe_username = ?, pppoe_password = ?, pppoe_profile_id = ? WHERE id = ?`,
                        [pppoeUser, pppoePass, pkg.profile_id, customerId]
                    );

                    // Create in MikroTik
                    try {
                        const { MikrotikService } = await import('../mikrotik/MikrotikService');
                        const mt = await MikrotikService.getInstance();
                        await mt.createPPPoEUser({
                            name: pppoeUser,
                            password: pppoePass,
                            profile: pkg.profile_name || 'default',
                            comment: reg.name
                        });
                    } catch (mtErr) {
                        console.error('Mikrotik creation error:', mtErr);
                    }
                }
            }

            // 4. Update Pending Registration Status
            await conn.query(
                `UPDATE pending_registrations SET status = 'approved', approved_at = NOW() WHERE id = ?`,
                [pendingRegistrationId]
            );

            // 5. Update Job Customer ID
            await conn.query(
                `UPDATE technician_jobs SET customer_id = ? WHERE pending_registration_id = ?`,
                [customerId, pendingRegistrationId]
            );

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

            const wa = whatsappService;
            await wa.sendMessage(reg.phone, waMessage);

            return { success: true, message: 'Aktivasi berhasil', customerId };

        } catch (error: any) {
            await conn.rollback();
            console.error('Activation error:', error);
            return { success: false, message: error.message };
        } finally {
            conn.release();
        }
    }
}
