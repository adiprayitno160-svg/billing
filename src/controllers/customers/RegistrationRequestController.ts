import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { WhatsAppService } from '../../services/whatsapp/WhatsAppService'; // Adjust path if needed

export class RegistrationRequestController {

    static async index(req: Request, res: Response) {
        try {
            const [requests] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM registration_requests ORDER BY created_at DESC`
            );

            res.render('customers/registration_requests/index', {
                layout: 'layouts/main',
                title: 'Permintaan Registrasi',
                requests,
                currentPath: '/customers/registration-requests'
            });
        } catch (error) {
            console.error('Error fetching registration requests:', error);
            req.flash('error', 'Gagal memuat data registrasi.');
            res.redirect('/customers/list');
        }
    }

    static async approve(req: Request, res: Response) {
        const { id } = req.params;
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Get Request Data
            const [rows] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM registration_requests WHERE id = ? FOR UPDATE',
                [id]
            );

            if (rows.length === 0) {
                await connection.rollback();
                req.flash('error', 'Data tidak ditemukan.');
                return res.redirect('/customers/registration-requests');
            }

            const request = rows[0];

            if (request.status !== 'pending') {
                await connection.rollback();
                req.flash('error', 'Permintaan ini sudah diproses sebelumnya.');
                return res.redirect('/customers/registration-requests');
            }

            // 2. Generate Customer Code (Auto Increment Logic Simulation or UUID)
            // Simplified: "CUS-" + Timestamp or similar. Better: Get max ID from customers.
            const [maxIdRows] = await connection.query<RowDataPacket[]>('SELECT MAX(id) as maxId FROM customers');
            const nextId = (maxIdRows[0].maxId || 0) + 1;
            const customerCode = `CUS-${String(nextId).padStart(5, '0')}`;

            // 3. Insert into Customers
            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO customers (
                    customer_code, name, address, phone, 
                    status, created_at, updated_at,
                    latitude, longitude
                ) VALUES (?, ?, ?, ?, 'inactive', NOW(), NOW(), ?, ?)`,
                [customerCode, request.name, request.address, request.phone, request.latitude, request.longitude]
            );

            const newCustomerId = result.insertId;

            // 4. Update Request Status
            await connection.query(
                'UPDATE registration_requests SET status = ?, updated_at = NOW() WHERE id = ?',
                ['approved', id]
            );

            await connection.commit();

            // 5. Notify User via WhatsApp
            try {
                const whatsappService = WhatsAppService.getInstance();
                await whatsappService.sendMessage(request.phone,
                    `🎉 *Selamat!*\n\nRegistrasi Anda a.n *${request.name}* telah diterima.\nID Pelanggan Anda: *${customerCode}*.\n\nAdmin kami akan segera menghubungi Anda untuk pemasangan/aktivasi paket.`
                );
            } catch (waError) {
                console.error('Failed to send WhatsApp approval notification:', waError);
            }

            req.flash('success', 'Registrasi disetujui. Silakan lengkapi data pelanggan.');
            res.redirect(`/customers/edit/${newCustomerId}`);

        } catch (error) {
            await connection.rollback();
            console.error('Error approving registration:', error);
            req.flash('error', 'Terjadi kesalahan saat menyetujui registrasi.');
            res.redirect('/customers/registration-requests');
        } finally {
            connection.release();
        }
    }

    static async reject(req: Request, res: Response) {
        const { id } = req.params;
        const { reason } = req.body; // Reason from form

        try {
            // 1. Get Request Data first
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM registration_requests WHERE id = ?',
                [id]
            );

            if (rows.length === 0) {
                req.flash('error', 'Data tidak ditemukan.');
                return res.redirect('/customers/registration-requests');
            }
            const request = rows[0];


            // 2. Update Status
            await databasePool.query(
                'UPDATE registration_requests SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?',
                ['rejected', reason || 'Tidak memenuhi syarat', id]
            );

            // 3. Notify User via WhatsApp
            try {
                const whatsappService = WhatsAppService.getInstance();
                await whatsappService.sendMessage(request.phone,
                    `⚠️ *Maaf*\n\nRegistrasi Anda a.n *${request.name}* belum dapat kami terima.\nAlasan: ${reason || 'Data tidak valid/lengkap'}.\n\nSilakan hubungi admin untuk info lebih lanjut.`
                );
            } catch (waError) {
                console.error('Failed to send WhatsApp rejection notification:', waError);
            }

            req.flash('success', 'Permintaan registrasi ditolak.');
            res.redirect('/customers/registration-requests');
        } catch (error) {
            console.error('Error rejecting registration:', error);
            req.flash('error', 'Gagal menolak registrasi.');
            res.redirect('/customers/registration-requests');
        }
    }
}
