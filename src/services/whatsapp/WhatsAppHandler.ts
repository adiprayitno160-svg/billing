
import { WhatsAppEvents, WhatsAppClient } from './WhatsAppClient';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import { ChatBotService } from '../ai/ChatBotService';
import { WhatsAppSessionService } from './WhatsAppSessionService';
import { PaymentProofVerificationService } from '../payments/PaymentProofVerificationService';
import { FraudLogService } from '../security/FraudLogService'; // Assuming this exists or will be stubbed, if not I'll implement inline logging or skip


export class WhatsAppHandler {
    private static isInitialized = false;

    static initialize() {
        if (this.isInitialized) return;
        console.log('[WhatsAppHandler] Initializing logic handler...');
        this.ensureTables();

        WhatsAppEvents.on('message', async (msg: proto.IWebMessageInfo) => {
            await this.handleIncomingMessage(msg);
        });
        this.isInitialized = true;
    }

    private static async ensureTables() {
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS fraud_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone VARCHAR(20),
                invoice_id INT,
                fraud_score DECIMAL(5,4),
                confidence DECIMAL(5,4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    private static getMessageBody(msg: proto.IWebMessageInfo): string {
        const content = msg.message;
        if (!content) return '';
        return (
            content.conversation ||
            content.extendedTextMessage?.text ||
            content.imageMessage?.caption ||
            content.videoMessage?.caption ||
            ''
        );
    }

    private static async sendMessage(to: string, text: string) {
        try {
            let jid = to;
            if (!jid.includes('@')) {
                jid = jid.replace(/\D/g, '') + '@s.whatsapp.net';
            }
            console.log(`[WhatsAppHandler] Sending reply to: ${jid}`);
            await WhatsAppClient.getInstance().sendMessage(jid, text);
        } catch (error: any) {
            console.error(`[WhatsAppHandler] Failed to send message to ${to}:`, error);
        }
    }

    private static async handleIncomingMessage(msg: proto.IWebMessageInfo) {
        try {
            const senderJid = msg.key.remoteJid;
            if (!senderJid || senderJid === 'status@broadcast' || senderJid.includes('@g.us')) return;
            if (msg.key.fromMe) return;

            // DEBUG LOG
            process.stdout.write(`\n[WhatsAppHandler] MSG FROM: ${senderJid}\n`);

            // === LID FIX START ===
            // @ts-ignore
            const remoteJidAlt = msg.key.remoteJidAlt || msg.key.participant;
            let senderPhone = senderJid.split('@')[0].split(':')[0];
            let isLid = senderJid.includes('@lid');
            let replyToJid = senderJid;

            if (isLid && remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
                process.stdout.write(`\n[WhatsAppHandler] LID Detected (${senderJid}) -> Alt JID: ${remoteJidAlt}\n`);
                senderPhone = remoteJidAlt.split('@')[0].split(':')[0];
                replyToJid = remoteJidAlt;
                isLid = false;
            }
            // === LID FIX END ===

            // 1. Identify User
            let customer = await this.getCustomerByPhone(senderPhone);
            let user = await this.getUserByPhone(senderPhone);
            // Also check LID for identification
            if (isLid && !customer && !user) {
                user = await this.getUserByPhone(senderJid);
                if (!user) {
                    const [custRows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT * FROM customers WHERE whatsapp_lid = ?`, [senderJid]
                    );
                    if (custRows.length > 0) customer = custRows[0];
                }
            }

            // 2. Check Session State (For Multi-step flows)
            let session = await WhatsAppSessionService.getSession(senderPhone);
            const body = this.getMessageBody(msg).trim();
            const lowerBody = body.toLowerCase();
            const isImage = !!msg.message?.imageMessage;

            // === IMAGE HANDLING (Payment Proof / General) ===
            if (isImage) {
                await this.handleImageMessage(msg, replyToJid, senderPhone, session);
                return;
            }

            if (!body) return;

            // === GLOBAL COMMANDS (Session Escape Hatch) ===
            const globalCommands = ['/menu', 'menu', 'batal', 'cancel', 'exit', 'stop', '.menu', '!menu', 'ping', 'tes', 'test', 'halo', 'hi', 'p'];
            if (globalCommands.includes(lowerBody) || lowerBody.startsWith('/menu') || lowerBody.startsWith('!menu')) {
                if (session) {
                    await WhatsAppSessionService.clearSession(senderPhone);
                    session = null; // Prevent entering state machine blocks below
                }
            }

            // === STATE MACHINE LOGIC ===
            // A. Registration Flow (Unregistered Logic)
            if (session?.step === 'REGISTER_NAME') {
                await WhatsAppSessionService.setSession(senderPhone, 'REGISTER_ADDRESS', { name: body });
                await this.sendMessage(replyToJid, `Halo Kak *${body}*. \nSelanjutnya, mohon kirim detail *Alamat Lengkap* pemasangan.`);
                return;
            }
            if (session?.step === 'REGISTER_ADDRESS') {
                const regData = session.data;
                await WhatsAppSessionService.setSession(senderPhone, 'REGISTER_LOCATION', {
                    ...regData,
                    address: body
                });
                await this.sendMessage(replyToJid,
                    `📍 *KIRIM LOKASI GPS*\n\n` +
                    `Untuk mempercepat survei, silakan kirim *Lokasi* Anda:\n\n` +
                    `1️⃣ Klik ikon **+** di bawah\n` +
                    `2️⃣ Pilih **Lokasi**\n` +
                    `3️⃣ Kirim lokasi Anda saat ini\n\n` +
                    `Atau ketik *Lewati* jika tidak ingin kirim lokasi.`
                );
                return;
            }
            if (session?.step === 'REGISTER_LOCATION') {
                const regData = session.data;
                let coordinates: string | null = null;

                // Check if this is a location message
                const locationMsg = msg.message?.locationMessage;
                if (locationMsg) {
                    coordinates = `${locationMsg.degreesLatitude}, ${locationMsg.degreesLongitude}`;
                } else if (lowerBody !== 'lewati' && lowerBody !== 'skip') {
                    // User sent text instead of location, remind them
                    await this.sendMessage(replyToJid,
                        `⚠️ Silakan kirim *Lokasi GPS* menggunakan tombol Share Location di WhatsApp.\n\n` +
                        `Atau ketik *Lewati* untuk lanjut tanpa GPS.`
                    );
                    return;
                }

                // Save to pending_registrations
                const [insertResult]: any = await databasePool.query(
                    `INSERT INTO pending_registrations (name, phone, address, coordinates, status) VALUES (?, ?, ?, ?, 'pending')`,
                    [regData.name, senderPhone, regData.address, coordinates]
                );

                const pendingRegId = insertResult.insertId;

                // Create Installation Job Ticket
                const ticketNumber = `PSB-${Math.floor(10000 + Math.random() * 90000)}`;

                // Get PASANG_BARU job type
                const [jobTypes] = await databasePool.query<RowDataPacket[]>(
                    "SELECT id, base_fee FROM job_types WHERE code = 'PASANG_BARU'"
                );
                const jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                const baseFee = jobTypes.length > 0 ? Number(jobTypes[0].base_fee) : 100000;

                await databasePool.query(
                    `INSERT INTO technician_jobs (ticket_number, title, description, priority, status, coordinates, address, reported_by, job_type_id, total_fee, pending_registration_id)
                     VALUES (?, ?, ?, 'medium', 'pending', ?, ?, 'whatsapp', ?, ?, ?)`,
                    [
                        ticketNumber,
                        `Pemasangan Baru - ${regData.name}`,
                        `Calon pelanggan: ${regData.name}\nHP: ${senderPhone}\nAlamat: ${regData.address}`,
                        coordinates,
                        regData.address,
                        jobTypeId,
                        baseFee,
                        pendingRegId
                    ]
                );

                // Notify All Technicians
                const [techs] = await databasePool.query<RowDataPacket[]>(
                    "SELECT phone FROM users WHERE role = 'teknisi' AND is_active = 1 AND phone IS NOT NULL"
                );

                const mapsLink = coordinates ? `https://maps.google.com/?q=${coordinates.replace(' ', '')}` : null;

                const techNotification = `
*🛠️ JOB PEMASANGAN BARU*

🎫 Tiket: *${ticketNumber}*
📂 Tipe: *Pemasangan Baru*

👤 Nama: *${regData.name}*
📞 HP: ${senderPhone}
📍 Alamat: ${regData.address}
${coordinates ? `🌐 GPS: ${coordinates}` : ''}
${mapsLink ? `📌 Maps: ${mapsLink}` : ''}

Untuk mengambil, balas:
*!ambil ${ticketNumber}*
`.trim();

                const waClient = WhatsAppClient.getInstance();
                for (const tech of techs) {
                    if (tech.phone) {
                        await waClient.sendMessage(tech.phone, techNotification).catch(console.warn);
                    }
                }

                // Send confirmation to customer
                await this.sendMessage(replyToJid,
                    `✅ *PENDAFTARAN DITERIMA*\n\n` +
                    `Nama: *${regData.name}*\n` +
                    `Alamat: ${regData.address}\n` +
                    `No. Tiket: *${ticketNumber}*\n\n` +
                    `Tim teknisi kami akan segera menghubungi Anda untuk survei dan pemasangan.\n\n` +
                    `Terima kasih telah memilih layanan kami! 🙏`
                );

                await WhatsAppSessionService.clearSession(senderPhone);
                return;
            }

            // B. Prepaid Purchase Flow
            if (session?.step === 'PREPAID_SELECT') {
                const selectedPkg = await this.getPrepaidPackageByInput(body);
                if (!selectedPkg) {
                    await this.sendMessage(replyToJid, '❌ Paket tidak ditemukan. Silakan ketik Kode Paket yang benar.');
                    return;
                }

                const customerName = customer ? customer.name : (session.data?.name || senderPhone);
                const customerId = customer ? customer.id : null;

                if (!customerId) {
                    // Guest user trying to buy? Ideally we need a customer ID. 
                    // For now, let's assume registered only or handle guest registration first.
                    // But your flow allowed guests. To support guests properly with PrepaidService, 
                    // we'd need a temp customer or require registration. 
                    // For now, let's keep it simple: If no customer ID, ask to register first or auto-create?
                    // Let's Guide to Register first.
                    await this.sendMessage(replyToJid, '⚠️ Mohon maaf, Anda harus terdaftar untuk membeli paket. Ketik *Daftar* untuk registrasi singkat.');
                    await WhatsAppSessionService.clearSession(senderPhone);
                    return;
                }

                // Use PrepaidService to Generate Request (Official logic)
                try {
                    const { PrepaidService } = await import('../billing/PrepaidService');
                    const reqResult = await PrepaidService.generatePaymentRequest(
                        customerId,
                        selectedPkg.id,
                        selectedPkg.duration_days
                    );

                    if (!reqResult.success || !reqResult.paymentRequest) {
                        throw new Error(reqResult.message || 'Gagal membuat tagihan');
                    }

                    const pr = reqResult.paymentRequest;

                    await WhatsAppSessionService.setSession(senderPhone, 'WAITING_PAYMENT', {
                        pkgCode: selectedPkg.code,
                        amount: Number(pr.total_amount),
                        paymentRequestId: pr.id,
                        customerName: customerName
                    });

                    await this.sendMessage(replyToJid,
                        `🎟️ *KONFIRMASI PEMBELIAN*\n\n` +
                        `Paket: *${selectedPkg.name}*\n` +
                        `Harga: *Rp ${Number(pr.total_amount).toLocaleString('id-ID')}*\n` +
                        `(Mohon transfer TEPAT hingga 3 digit terakhir)\n\n` +
                        `🏦 *ISP BILLING SYSTEM*\n` +
                        `BCA: 1234567890\n\n` +
                        `⚠️ *PENTING:*\n` +
                        `1. Transfer harus SUKSES.\n` +
                        `2. Kirim bukti transfer di sini untuk verifikasi otomatis Ai.`
                    );

                } catch (err: any) {
                    console.error('[WhatsAppHandler] Prepaid generation error:', err);
                    await this.sendMessage(replyToJid, '❌ Terjadi kesalahan saat memproses permintaan paket.');
                }
                return;
            }

            // === GLOBAL COMMANDS ===

            // 1. ADMIN & TECHNICIAN
            if (user) {

                // --- TECHNICIAN FLOW ---
                if (user.role === 'teknisi') {
                    // AMBIL JOB (Auto Check-In)
                    // Support: !ambil JOB-123, ambil #JOB-123
                    if (lowerBody.startsWith('!ambil') || lowerBody.startsWith('ambil #')) {
                        let ticket = '';
                        if (lowerBody.startsWith('!')) {
                            ticket = lowerBody.split(/[\s]+/)[1] || '';
                        } else {
                            ticket = lowerBody.split('#')[1] || '';
                        }

                        ticket = ticket.trim().toUpperCase();

                        if (!ticket) {
                            await this.sendMessage(replyToJid, '⚠️ Mohon sertakan Nomor Tiket. Contoh: *!ambil JOB-12345*');
                            return;
                        }

                        // Find Job ID by Ticket
                        const [jobs] = await databasePool.query<RowDataPacket[]>(
                            "SELECT id, status FROM technician_jobs WHERE ticket_number = ?", [ticket]
                        );

                        if (jobs.length === 0) {
                            await this.sendMessage(replyToJid, `❌ Tiket ${ticket} tidak ditemukan.`);
                            return;
                        }

                        if (jobs[0].status !== 'pending') {
                            await this.sendMessage(replyToJid, `⚠️ Tiket ini sudah diambil atau selesai.`);
                            return;
                        }

                        // Execute ACCEPT Logic
                        try {
                            // 1. Assign Job
                            await databasePool.query(
                                "UPDATE technician_jobs SET status = 'accepted', technician_id = ?, accepted_at = NOW() WHERE id = ?",
                                [user.id, jobs[0].id]
                            );



                            await this.sendMessage(replyToJid, `✅ *JOB ACCEPTED*
Tiket: ${ticket}
Status: *In Progress*

Jika sudah selesai, kirim FOTO bukti dengan caption:
*!selesai ${ticket} <catatan>*`);
                        } catch (err: any) {
                            console.error('WA Accept Job Error:', err);
                            await this.sendMessage(replyToJid, '❌ Terjadi kesalahan sistem.');
                        }
                        return;
                    }

                    // SELESAI JOB (Text only handling - instruct to use image)
                    if (lowerBody.startsWith('!selesai') || lowerBody.startsWith('selesai #')) {
                        // Extract ticket just to be helpful in the reply
                        let ticketRef = '';
                        if (lowerBody.startsWith('!')) ticketRef = lowerBody.split(' ')[1] || '';
                        else ticketRef = lowerBody.split('#')[1] || '';

                        await this.sendMessage(replyToJid, `📸 Untuk menyelesaikan job, silakan **Kirim Foto Bukti** dengan caption:\n\n*!selesai ${ticketRef || 'JOB-XXXXX'} <catatan>*`);
                        return;
                    }
                }
                // --- END TECHNICIAN FLOW ---

                // --- ADMIN / OPERATOR ACTIVATION ---
                if (['admin', 'operator', 'superadmin'].includes(user.role)) {
                    if (lowerBody.startsWith('!aktifkan') || lowerBody.startsWith('!activate')) {
                        const targetRef = lowerBody.split(' ')[1]; // Phone or ID
                        if (!targetRef) {
                            await this.sendMessage(replyToJid, 'ℹ️ Format: *!aktifkan <NoHP/ID_Pending>*');
                            return;
                        }

                        try {
                            const { ActivationService } = await import('../billing/ActivationService');

                            // Try finding Pending Registration
                            const [pendings] = await databasePool.query<RowDataPacket[]>(
                                "SELECT id FROM pending_registrations WHERE phone LIKE ? OR id = ? LIMIT 1",
                                [`%${targetRef}%`, targetRef]
                            );

                            if (pendings.length > 0) {
                                await ActivationService.activate(pendings[0].id);
                                await this.sendMessage(replyToJid, `✅ Aktivasi Berhasil untuk ID Pending #${pendings[0].id}`);
                                return;
                            }

                            await this.sendMessage(replyToJid, `❌ Data registrasi pending tidak ditemukan untuk ${targetRef}`);
                        } catch (err: any) {
                            console.error(err);
                            await this.sendMessage(replyToJid, `❌ Gagal aktivasi: ${err.message}`);
                        }
                        return;
                    }
                }
                // --- END ADMIN FLOW ---

                // ... existing admin logic ...
                if (lowerBody === '/menu' || lowerBody === 'menu') {
                    await this.sendMessage(replyToJid, `🛠️ *MENU ADMIN/TEKNISI*
1. /status
2. /cek <nomor>
3. !ambil <Tiket>
4. !selesai <Tiket> (Caption Foto)`);
                } else if (lowerBody === '/status') {
                    await this.sendMessage(replyToJid, '✅ Server Online');
                } else {
                    // AI Chat
                    const aiResponse = await ChatBotService.ask(body, { role: user.role, user });
                    await this.sendMessage(replyToJid, aiResponse);
                }
                return;
            }

            // 2. REGISTERED CUSTOMER
            if (customer) {
                if (lowerBody === '/menu' || lowerBody === 'menu' || lowerBody === 'halo') {
                    let menu = `👋 Halo *${customer.name}*!\n\n` +
                        `📋 *MENU PELANGGAN*\n` +
                        `1. *Cek Tagihan Terbaru* (Ketik: Tagihan)\n` +
                        `2. *Cek Sisa Kurang/Hutang* (Ketik: Kurang)\n` +
                        `3. *Info WiFi & Password* (Ketik: WiFi)\n` +
                        `4. *Cek Password WiFi* (Ketik: Cek WiFi)\n` +
                        `5. *Ganti Password WiFi* (Ketik: Ganti Password)\n` +
                        `6. *Restart ONT* (Ketik: Restart)\n` +
                        `7. *Status Perangkat* (Ketik: Status)\n`;

                    // Hanya pelanggan prepaid yang boleh akses fitur /beli
                    if (customer.billing_mode === 'prepaid') {
                        menu += `8. *Beli Voucher* (Ketik: Beli)\n`;
                    }
                    menu += `9. *Info Bayar / Beda Nama* (Ketik: 9)\n`;

                    menu += `\n*Bantuan* (Ketik pesan Anda)\n`;
                    await this.sendMessage(replyToJid, menu);
                    return;
                }

                // --- CHANGE WIFI PASSWORD FLOW ---
                // --- GENIEACS DEVICE MANAGEMENT MENU ---
                // Perintah WiFi Management
                if (lowerBody === 'wifi' || lowerBody === 'info wifi') {
                    await WhatsAppSessionService.setSession(senderPhone, 'CHANGE_WIFI_PWD_1');
                    await this.sendMessage(replyToJid, `🔐 *MANAJEMEN WIFI*

Pilih opsi:
1. *Ganti Password* - Ketik password baru
2. *Cek Password* - Ketik: Cek WiFi`);
                    return;
                }

                if (lowerBody === 'ganti password' || lowerBody === 'ubah password') {
                    await WhatsAppSessionService.setSession(senderPhone, 'CHANGE_WIFI_PWD_1');
                    await this.sendMessage(replyToJid, `🔐 *GANTI PASSWORD WIFI*\n\nSilakan ketik **Password Baru** yang Anda inginkan (Min 8 karakter):`);
                    return;
                }

                if (lowerBody === 'cek wifi' || lowerBody === 'password wifi') {
                    await this.sendMessage(replyToJid, `🔍 Sedang mengambil info WiFi...`);

                    const { GenieacsWhatsAppController } = await import('../../controllers/whatsapp/GenieacsWhatsAppController');
                    const result = await GenieacsWhatsAppController.getCurrentWiFiInfo(senderPhone);
                    await this.sendMessage(replyToJid, result.message);
                    return;
                }

                if (lowerBody === 'restart' || lowerBody === 'restart ont') {
                    await this.sendMessage(replyToJid, `🔄 Sedang merestart perangkat Anda...`);

                    const { GenieacsWhatsAppController } = await import('../../controllers/whatsapp/GenieacsWhatsAppController');
                    const result = await GenieacsWhatsAppController.restartONT(senderPhone);
                    await this.sendMessage(replyToJid, result.message);
                    return;
                }

                if (lowerBody === 'status' || lowerBody === 'cek status') {
                    await this.sendMessage(replyToJid, `🔍 Sedang mengambil status perangkat...`);

                    const { GenieacsWhatsAppController } = await import('../../controllers/whatsapp/GenieacsWhatsAppController');
                    const result = await GenieacsWhatsAppController.getDeviceStatus(senderPhone);
                    await this.sendMessage(replyToJid, result.message);
                    return;
                }

                if (session?.step === 'CHANGE_WIFI_PWD_1') {
                    const newPass = body.trim();

                    const { GenieacsWhatsAppController } = await import('../../controllers/whatsapp/GenieacsWhatsAppController');
                    const result = await GenieacsWhatsAppController.changeWiFiPassword(senderPhone, newPass);
                    await this.sendMessage(replyToJid, result.message);

                    await WhatsAppSessionService.clearSession(senderPhone);
                    return;
                }

                // --- MENU 4: INFO BAYAR / BEDA NAMA ---
                if (lowerBody === '4' || lowerBody === 'beda nama' || lowerBody === 'info bayar') {
                    await this.sendMessage(replyToJid,
                        `💳 *INFO PEMBAYARAN TAGIHAN*\n\n` +
                        `Apakah Nama di Rekening Pengirim SAMA dengan Nama Pelanggan (*${customer.name}*)?\n\n` +
                        `Ketik:\n` +
                        `*Y* 👉 Jika Nama SAMA\n` +
                        `*N* 👉 Jika Nama BEDA (Pakai rekening Istri/Suami/Teman)`
                    );
                    await WhatsAppSessionService.setSession(senderPhone, 'CONFIRM_NAME_MATCH');
                    return;
                }

                if (session?.step === 'CONFIRM_NAME_MATCH') {
                    if (lowerBody === 'y' || lowerBody === 'ya' || lowerBody === 'sama') {
                        // Logic SAMA: Instruksi standar
                        await this.sendMessage(replyToJid,
                            `✅ *NAMA SAMA*\n\n` +
                            `Silakan transfer sesuai nominal tagihan.\n` +
                            `Sistem akan otomatis memverifikasi nama *${customer.name}*.\n\n` +
                            `📸 Setelah transfer, kirim BUKTI di sini.`
                        );
                    } else {
                        // Logic BEDA: Generate Kode Unik
                        // Cari tagihan unpaid
                        const [rows] = await databasePool.query<RowDataPacket[]>(
                            `SELECT * FROM invoices WHERE customer_id = ? AND status != 'paid' ORDER BY id DESC LIMIT 1`,
                            [customer.id]
                        );

                        if (rows.length === 0) {
                            await this.sendMessage(replyToJid, `✅ Tidak ada tagihan yang perlu dibayar saat ini.`);
                        } else {
                            const inv = rows[0];
                            const baseAmount = Number(inv.remaining_amount);
                            // Generate Unique Code (1-999)
                            const uniqueCode = Math.floor(Math.random() * 899) + 100;
                            const totalWithCode = baseAmount + uniqueCode;

                            // Simpan/Update Payment Request untuk deteksi
                            // Kita pakai tabel payment_requests atau update logs sementara
                            // Di sini kita update notes invoice sementara atau buat payment_req baru
                            // Simple approach: Create Payment Request Type 'invoice_payment'

                            await databasePool.query(
                                `INSERT INTO payment_requests (customer_id, invoice_id, type, status, base_amount, unique_code, total_amount, method, created_at)
                                VALUES (?, ?, 'bill_payment', 'pending', ?, ?, ?, 'transfer', NOW())`,
                                [customer.id, inv.id, baseAmount, uniqueCode, totalWithCode]
                            );

                            await this.sendMessage(replyToJid,
                                `🔄 *NAMA BEDA - KODE KHUSUS*\n\n` +
                                `Karena nama rekening berbeda, mohon transfer dengan **NOMINAL UNIK** agar terbaca sistem:\n\n` +
                                `💰 Transfer: *Rp ${totalWithCode.toLocaleString('id-ID')}*\n` +
                                `⚠️ (Mohon transfer persis sampai 3 digit terakhir: *${uniqueCode}*)\n\n` +
                                `Sistem akan otomatis mengenali nominal ini walau nama pengirim berbeda.`
                            );
                        }
                    }
                    await WhatsAppSessionService.clearSession(senderPhone);
                    return;
                }
                // --- END MENU 4 ---


                if (lowerBody === 'tagihan' || lowerBody === '/tagihan') {
                    // Fetch Latest Invoice
                    const [rows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT * FROM invoices WHERE customer_id = ? ORDER BY due_date DESC LIMIT 1`,
                        [customer.id]
                    );

                    if (rows.length === 0) {
                        await this.sendMessage(replyToJid, `✅ Anda belum memiliki riwayat tagihan.`);
                    } else {
                        const inv = rows[0];
                        let statusText = inv.status;
                        if (inv.status === 'paid') statusText = 'LUNAS ✅';
                        else if (inv.status === 'overdue') statusText = 'TERTUNGGAK ⚠️';
                        else if (inv.status === 'partial') statusText = 'DIBAYAR SEBAGIAN 🔸';

                        await this.sendMessage(replyToJid,
                            `📄 *TAGIHAN TERBARU*\n\n` +
                            `No: ${inv.invoice_number}\n` +
                            `Periode: ${inv.period}\n` +
                            `Jatuh Tempo: ${new Date(inv.due_date).toLocaleDateString('id-ID')}\n` +
                            `Total: Rp ${Number(inv.total_amount).toLocaleString('id-ID')}\n` +
                            `Sisa: Rp ${Number(inv.remaining_amount).toLocaleString('id-ID')}\n` +
                            `Status: *${statusText}*`
                        );
                    }
                    return;
                }

                if (lowerBody === 'kurang' || lowerBody === '/kurang' || lowerBody === 'hutang') {
                    // Fetch All Unpaid/Partial Invoices
                    const [rows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT * FROM invoices WHERE customer_id = ? AND status IN ('sent', 'overdue', 'partial') AND remaining_amount > 0 ORDER BY due_date ASC`,
                        [customer.id]
                    );

                    if (rows.length === 0) {
                        await this.sendMessage(replyToJid, `✅ Alhamdulillah, Anda tidak memiliki tunggakan/kurang bayar.`);
                    } else {
                        let msg = `💰 *DAFTAR TUNGGAKAN/KURANG*\n\n`;
                        let totalDebt = 0;
                        rows.forEach((inv, i) => {
                            msg += `${i + 1}. ${inv.period} - Sisa: *Rp ${Number(inv.remaining_amount).toLocaleString('id-ID')}*\n`;
                            totalDebt += Number(inv.remaining_amount);
                        });
                        msg += `\n━━━━━━━━━━━━━━━\n*TOTAL HUTANG: Rp ${totalDebt.toLocaleString('id-ID')}*`;
                        await this.sendMessage(replyToJid, msg);
                    }
                    return;
                }

                if (lowerBody === 'beli' || lowerBody === '/beli' || lowerBody === 'voucher') {
                    // Hanya pelanggan prepaid yang boleh akses fitur /beli
                    if (customer.billing_mode === 'prepaid') {
                        await this.showPrepaidMenu(replyToJid, senderPhone);
                    } else {
                        await this.sendMessage(replyToJid, `⚠️ Maaf, fitur pembelian paket hanya tersedia untuk Pelanggan Prepaid. Akun Anda saat ini adalah ${customer.billing_mode === 'postpaid' ? 'Postpaid' : 'Hybrid'}.

Untuk informasi lebih lanjut, silakan hubungi admin.`);
                    }
                    return;
                }

                // --- AI DIAGNOSTICS TRIGGER ---
                const problemKeywords = ['lemot', 'lambat', 'mati', 'internet', 'gangguan', 'bermasalah', 'tidak bisa', 'error', 'rto', 'merah', 'los'];
                if (problemKeywords.some(kw => lowerBody.includes(kw))) {
                    await this.sendMessage(replyToJid, '🤖 *AI Network Doctor:* Sedang menganalisa koneksi Kakak, mohon tunggu sebentar ya...');
                    try {
                        const { AIDiagnosticsService } = await import('../ai/AIDiagnosticsService');
                        const diag = await AIDiagnosticsService.diagnoseAndFix(customer.id, body);
                        await this.sendMessage(replyToJid, diag.aiAdvice || diag.details);
                    } catch (error) {
                        console.error('[WhatsAppHandler] AI Diagnostics Error:', error);
                        await this.sendMessage(replyToJid, '⚠️ Mohon maaf, fitur diagnosa otomatis sedang gangguan. Tim admin kami akan segera mengecek keluhan Kakak.');
                    }
                    return;
                }

                // AI Chat Fallback
                const aiResponse = await ChatBotService.ask(body, customer);
                await this.sendMessage(replyToJid, aiResponse);
                return;
            }

            // 3. UNREGISTERED (NEW NUMBER)
            if (!customer && !user) {
                if (lowerBody === 'daftar' || lowerBody === '1') {
                    await WhatsAppSessionService.setSession(senderPhone, 'REGISTER_NAME');
                    await this.sendMessage(replyToJid, `📝 *PENDAFTARAN BARU*\n\nSilakan ketik *Nama Lengkap* Anda:`);
                    return;
                }
                if (lowerBody === 'beli' || lowerBody === '2' || lowerBody === 'voucher') {
                    await this.sendMessage(replyToJid, `⚠️ Maaf, fitur pembelian paket hanya tersedia untuk Pelanggan Terdaftar dengan akun Prepaid.

Silakan daftar terlebih dahulu dengan mengetik *Daftar*.`);
                    return;
                }
                if (lowerBody === '/menu' || lowerBody === 'menu' || lowerBody === 'halo') {
                    await this.sendMessage(replyToJid,
                        `👋 Selamat Datang di *ISP Billing*!\n` +
                        `Nomor Anda belum terdaftar.\n\n` +
                        `Silakan pilih menu:\n` +
                        `1️⃣ *Pasang Baru (Postpaid)*\n` +
                        `   (Ketik: *Daftar*)\n` +
                        `2️⃣ *Bantuan CS*\n` +
                        `   (Balas pesan ini)`
                    );
                    return;
                }

                // AI Chat Fallback for Guest
                const aiResponse = await ChatBotService.ask(body, { status: 'guest' });
                await this.sendMessage(replyToJid, aiResponse);
            }

        } catch (error: any) {
            console.error('[WhatsAppHandler] FATAL ERROR:', error);
            // SILENT ERROR: User request to remove "terjadi kesalahan" message.
            // Do nothing to user, just log it.
        }
    }

    private static async handleImageMessage(msg: proto.IWebMessageInfo, replyTo: string, senderPhone: string, session: any) {
        try {
            await this.sendMessage(replyTo, '📸 *AI Auditor:* Memverifikasi integritas bukti transfer...');

            const buffer = await downloadMediaMessage(
                msg as any,
                'buffer',
                {},
                { logger: console as any, reuploadRequest: (msg as any).reuploadRequest }
            ) as Buffer;

            // 1. TECHNICIAN JOB FLOW
            // 1. TECHNICIAN JOB FLOW
            const caption = msg.message?.imageMessage?.caption || '';
            const lowerCaption = caption.toLowerCase().trim();

            // Detect !selesai or !lapor (or old 'selesai #')
            if (lowerCaption.startsWith('!selesai') || lowerCaption.startsWith('!lapor') || lowerCaption.startsWith('selesai #')) {
                // Parse Ticket
                let ticket = '';
                if (lowerCaption.startsWith('!')) {
                    // Format: !selesai JOB-123 or !selesai <space> JOB-123
                    const parts = lowerCaption.split(/[\s]+/);
                    ticket = parts[1] || '';
                } else {
                    // Old Format: selesai #JOB-123
                    ticket = lowerCaption.split('#')[1] || '';
                }

                ticket = ticket.trim().toUpperCase();

                if (!ticket) {
                    await this.sendMessage(replyTo, '⚠️ Mohon sertakan Nomor Tiket. Contoh: *!selesai JOB-12345*');
                    return;
                }

                const user = await this.getUserByPhone(senderPhone);
                if (!user || user.role !== 'teknisi') {
                    await this.sendMessage(replyTo, '❌ Anda tidak memiliki akses teknisi.');
                    return;
                }

                // Check Job Status
                const [jobs] = await databasePool.query<RowDataPacket[]>(
                    "SELECT id, status, technician_id FROM technician_jobs WHERE ticket_number = ?",
                    [ticket]
                );

                if (jobs.length === 0) {
                    await this.sendMessage(replyTo, `❌ Tiket ${ticket} tidak ditemukan.`);
                    return;
                }

                const job = jobs[0];
                if (job.status !== 'accepted') {
                    await this.sendMessage(replyTo, `⚠️ Job ini statusnya '${job.status}'. Hanya status 'accepted' yang bisa diselesaikan.`);
                    return;
                }
                if (job.technician_id !== user.id) {
                    await this.sendMessage(replyTo, `⚠️ Job ini bukan milik Anda.`);
                    return;
                }

                // SAVE IMAGE & COMPLETE JOB
                const uploadDir = path.join(__dirname, '../../../public/uploads/technician');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filename = `job-${ticket}-${Date.now()}.jpg`;
                const filepath = path.join(uploadDir, filename);
                fs.writeFileSync(filepath, buffer);
                const proofUrl = `/uploads/technician/${filename}`;

                // Notes: Remove the command part from caption
                // e.g. "!selesai JOB-123 Kabel putus digigit tikus" -> "Kabel putus digigit tikus"
                let notes = caption.replace(new RegExp(`^!selesai\\s+${ticket}|!lapor\\s+${ticket}|selesai\\s+#${ticket}`, 'i'), '').trim();
                // If the regex didn't catch the exact format because of messy input, try a simpler slice
                if (lowerCaption.startsWith('!selesai')) notes = caption.substring(caption.indexOf(ticket) + ticket.length).trim();

                if (!notes) notes = 'Selesai via WhatsApp';
                // Clean up leading hyphen/punctuation if user typed "!selesai JOB-123 - Note"
                notes = notes.replace(/^[-:\s]+/, '');

                // Check if this job has a linked pending registration with UNPAID request (Activation Fee)
                // If so, assume Technician collected it.
                let collectedAmount = 0;
                let fundNote = '';

                if (job.pending_registration_id) {
                    const [reqRows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT id, total_amount FROM payment_requests 
                         WHERE pending_registration_id = ? AND status != 'paid' AND type = 'activation'`,
                        [job.pending_registration_id]
                    );

                    if (reqRows.length > 0) {
                        collectedAmount = Number(reqRows[0].total_amount);
                        // Auto-mark as paid via Technician
                        await databasePool.query(
                            "UPDATE payment_requests SET status = 'paid', verification_status = 'verified', proof_image = 'collected_by_tech', notes = 'Cash to Technician' WHERE id = ?",
                            [reqRows[0].id]
                        );
                        fundNote = `\n💰 *Dana Titipan:* Rp ${collectedAmount.toLocaleString('id-ID')}`;

                        // Try to Activate Service immediately since payment is "received" by tech
                        try {
                            const { ActivationService } = await import('../billing/ActivationService');
                            await ActivationService.activate(job.pending_registration_id);
                            fundNote += `\n🚀 *Layanan Diaktifkan*`;
                        } catch (e) {
                            fundNote += `\n⚠️ Gagal auto-aktivasi`;
                        }
                    }
                }

                await databasePool.query(
                    "UPDATE technician_jobs SET status = 'completed', completed_at = NOW(), completion_proof = ?, completion_notes = ?, collected_funds = ? WHERE id = ?",
                    [proofUrl, notes, collectedAmount, job.id]
                );

                await this.sendMessage(replyTo, `✅ *JOB COMPLETED*

Tiket: ${ticket}
Status: **Selesai**
Catatan: ${notes}${fundNote}

Terima kasih atas kerja keras Anda! 💪`);
                return;
            }


            // 2. PAYMENT VERIFICATION
            let customerName = session?.data?.customerName || senderPhone;
            let customerPhone = senderPhone;

            console.log('[WA Payment] Starting verification. Session Data:', session?.data);

            // Try to fetch real customer if not in session
            if (!session?.data?.customerName) {
                const customer = await this.getCustomerByPhone(senderPhone);
                if (customer) {
                    customerName = customer.name;
                }
            }

            // Save proof locally first
            const uploadDir = path.join(__dirname, '../../../public/uploads/payments');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const filename = `proof-${senderPhone}-${Date.now()}.jpg`;
            fs.writeFileSync(path.join(uploadDir, filename), buffer);
            const proofUrl = `/uploads/payments/${filename}`;

            console.log('[WA Payment] Session:', session?.data);
            const verification = await PaymentProofVerificationService.verify(
                buffer,
                session?.data?.amount || 0,
                customerName,
                customerPhone
            );
            console.log('[WA Payment] Verify Result:', verification);

            // AUTO UPDATE IF PREPAID AND VALID
            const { PrepaidService } = await import('../billing/PrepaidService');

            // Handle REJECTED
            if (verification.status === 'rejected') {
                console.log('[WA Payment] Rejected:', verification.message);
                await this.sendMessage(replyTo, `❌ *Ditolak Sistem:* ${verification.message}\n\n(Bukti tetap tersimpan untuk audit manual)`);

                // Update payment request if exists
                if (session?.data?.paymentRequestId) {
                    await databasePool.query(
                        "UPDATE payment_requests SET status = 'rejected', proof_image = ?, verification_status = 'rejected' WHERE id = ?",
                        [proofUrl, session.data.paymentRequestId]
                    );
                    await WhatsAppSessionService.clearSession(senderPhone);
                }

                // ALSO SAVE TO MANUAL VERIFICATIONS FOR AUDIT
                let custId = null;
                const cust = await this.getCustomerByPhone(senderPhone);
                if (cust) custId = cust.id;

                await databasePool.query(
                    `INSERT INTO manual_payment_verifications 
                    (customer_id, proof_image, amount, status, notes, proof_hash, created_at)
                    VALUES (?, ?, ?, 'rejected', ?, ?, NOW())`,
                    [custId, proofUrl, session?.data?.amount || 0, `[AUTO-REJECT] ${verification.message}`, verification.proofHash]
                );

                return;
            }

            // Handle MANUAL REVIEW
            if (verification.status === 'manual_review') {
                await this.sendMessage(replyTo, `⚠️ *Sedang Diverifikasi Admin*\n${verification.message}\n\nBukti Anda sudah tersimpan di sistem dan akan dicek manual.`);

                // Save proof to Payment Request so Admin can see it
                if (session?.data?.paymentRequestId) {
                    await databasePool.query(
                        "UPDATE payment_requests SET proof_image = ?, verification_status = 'pending' WHERE id = ?",
                        [proofUrl, session.data.paymentRequestId]
                    );
                    await WhatsAppSessionService.clearSession(senderPhone);
                } else {
                    // GENERIC / POSTPAID Manual Verification
                    let custId = null;
                    const cust = await this.getCustomerByPhone(senderPhone);
                    if (cust) custId = cust.id;

                    await databasePool.query(
                        `INSERT INTO manual_payment_verifications 
                        (customer_id, proof_image, amount, status, notes, proof_hash, created_at)
                        VALUES (?, ?, ?, 'pending', ?, ?, NOW())`,
                        [custId, proofUrl, session?.data?.amount || verification.extractedData?.amount || 0, verification.message, verification.proofHash]
                    );
                    await WhatsAppSessionService.clearSession(senderPhone);
                }
                return;
            }

            // Handle AUTO APPROVED
            if (verification.status === 'auto_approved') {
                const amount = verification.extractedData?.amount || session?.data?.amount;
                let requestId = session?.data?.paymentRequestId;

                // If no session, try find by unique amount in recent pending requests
                if (!requestId && amount) {
                    const [reqRows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT id, type, pending_registration_id FROM payment_requests 
                         WHERE total_amount = ? AND status = 'pending' AND expires_at > NOW() 
                         LIMIT 1`,
                        [amount]
                    );
                    if (reqRows.length > 0) {
                        requestId = reqRows[0].id;
                        // Determine type from DB if not in session
                        if (!session) {
                            if (reqRows[0].type === 'activation') {
                                try {
                                    const { ActivationService } = await import('../billing/ActivationService');
                                    await databasePool.query("UPDATE payment_requests SET status = 'paid', proof_image = ? WHERE id = ?", [proofUrl, requestId]);
                                    await ActivationService.activate(reqRows[0].pending_registration_id);
                                    return;
                                } catch (actErr) {
                                    console.error('Auto Activation Error:', actErr);
                                }
                            }
                        }
                    }
                }

                // A. PREPAID / ACTIVATION (Session Based or Found ID)
                if (requestId) {
                    try {
                        // Check if it's activation
                        const [reqInfo] = await databasePool.query<RowDataPacket[]>(
                            "SELECT * FROM payment_requests WHERE id = ?", [requestId]
                        );

                        if (reqInfo.length > 0 && reqInfo[0].type === 'activation') {
                            const { ActivationService } = await import('../billing/ActivationService');
                            await databasePool.query("UPDATE payment_requests SET status = 'paid', proof_image = ? WHERE id = ?", [proofUrl, requestId]);
                            await ActivationService.activate(reqInfo[0].pending_registration_id);
                            await WhatsAppSessionService.clearSession(senderPhone);
                            return;
                        }

                        // Normal Prepaid Renewal
                        const result = await PrepaidService.confirmPayment(
                            requestId,
                            null, // verified by system
                            'transfer_auto_ai'
                        );

                        await databasePool.query(
                            "UPDATE payment_requests SET proof_image = ?, verification_status = 'verified' WHERE id = ?",
                            [proofUrl, requestId]
                        );

                        await databasePool.query(`
                            UPDATE prepaid_transactions 
                            SET proof_image = ? 
                            WHERE payment_request_id = ?`,
                            [proofUrl, requestId]
                        );

                        await this.sendMessage(replyTo, `✅ *Pembayaran Berhasil!* (Auto-Verify)\n\nLayanan internet Anda telah diperpanjang hingga: *${new Date(result.newExpiryDate || Date.now()).toLocaleDateString('id-ID')}*`);
                        await WhatsAppSessionService.clearSession(senderPhone);

                    } catch (err: any) {
                        console.error('Auto-approve payment error:', err);
                        await this.sendMessage(replyTo, `⚠️ Pembayaran valid tapi gagal memproses aktivasi otomatis. Admin akan mengeceknya.`);
                    }
                    return;
                }

                // B. POSTPAID (Invoice match)
                // ... (Similar simplified logic for postpaid invoices)
                if (verification.extractedData) {
                    // Try find unpaid invoice
                    const [invRows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT id, invoice_number FROM invoices WHERE customer_id = (SELECT id FROM customers WHERE phone = ? LIMIT 1) AND status != 'paid' AND remaining_amount <= ? LIMIT 1`,
                        [senderPhone, amount + 5000] // simple range check
                    );

                    if (invRows.length > 0) {
                        const inv = invRows[0];
                        await databasePool.query(
                            `UPDATE invoices SET status = 'paid', paid_amount = ?, remaining_amount = 0, proof_image_hash = ?, paid_at = NOW() WHERE id = ?`,
                            [amount, verification.proofHash, inv.id]
                        );
                        await this.sendMessage(replyTo, `✅ *Pembayaran Tagihan Diterima*\nInvoice: ${inv.invoice_number}\nStatus: LUNAS (Auto-Verify)`);
                        return;
                    }
                }

                // Fallback: Valid amount/proof but no matching invoice found automatically
                let custId = null;
                const cust = await this.getCustomerByPhone(senderPhone);
                if (cust) custId = cust.id;

                await databasePool.query(
                    `INSERT INTO manual_payment_verifications 
                    (customer_id, proof_image, amount, status, notes, proof_hash, created_at)
                    VALUES (?, ?, ?, 'pending', ?, ?, NOW())`,
                    [custId, proofUrl, amount, 'Valid but no invoice matched', verification.proofHash]
                );

                await this.sendMessage(replyTo, `✅ Pembayaran Rp ${amount.toLocaleString()} valid, tapi tidak ditemukan tagihan yang cocok. Admin akan memproses manual.`);
            }

        } catch (error) {
            console.error('[WhatsAppHandler] Error processing image:', error);
            await this.sendMessage(replyTo, '❗ Terjadi kesalahan saat memproses bukti pembayaran.');
        }
    }

    private static async showPrepaidMenu(to: string, senderPhone: string) {
        const [rows] = await databasePool.query<RowDataPacket[]>('SELECT * FROM prepaid_packages WHERE is_active = 1');
        let msg = `🛒 *TOKO PAKET INTERNET*\nSilakan pilih paket:\n\n`;

        rows.forEach((pkg: any, idx: number) => {
            msg += `${idx + 1}. *${pkg.name}*
   Speed: ${pkg.speed_mbps}Mbps | ${pkg.duration_days}Hr
   Harga: Rp ${pkg.price.toLocaleString('id-ID')}
   Ketik: *${pkg.code}*

`;
        });

        msg += `_Ketik Kode Paket (misal: DAILY5) untuk membeli._`;

        await WhatsAppSessionService.setSession(senderPhone, 'PREPAID_SELECT');
        await this.sendMessage(to, msg);
    }

    private static async getPrepaidPackageByInput(input: string): Promise<any> {
        // Try by CODE first
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT * FROM prepaid_packages WHERE code = ?`, [input.toUpperCase()]
        );
        if (rows.length > 0) return rows[0];

        return null; // Todo: Implement select by index number
    }

    private static generateVoucherCode() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Helpers
    private static async getCustomerByPhone(phone: string): Promise<any | null> {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT * FROM customers WHERE phone = ? OR phone = ? LIMIT 1`,
            [phone, phone.replace(/^62/, '0')]
        );
        return rows[0] || null;
    }

    private static async getUserByPhone(phone: string): Promise<any | null> {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT * FROM users WHERE phone = ? OR phone = ? OR whatsapp_lid = ? LIMIT 1`,
            [phone, phone.replace(/^62/, '0'), phone]
        );
        return rows[0] || null;
    }
}
