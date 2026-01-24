
import { WAMessage, proto } from '@whiskeysockets/baileys';
import { WhatsAppService } from './WhatsAppService';
import { databasePool } from '../../db/pool';
import { WhatsAppSessionService } from './WhatsAppSessionService';
import { RowDataPacket } from 'mysql2';
import { GenieacsWhatsAppController } from '../../controllers/whatsapp/GenieacsWhatsAppController';
import { ChatBotService } from '../ai/ChatBotService';
import path from 'path';

export class WhatsAppHandler {

    static async handleIncomingMessage(msg: proto.IWebMessageInfo, service: WhatsAppService) {
        try {
            if (!msg.key.remoteJid) return;
            const senderJid = msg.key.remoteJid;

            // Extract phone number from JID (handle @s.whatsapp.net)
            // Note: If using LID (@lid), this might be a long ID, not a phone number.
            // We strip non-digits to be safe.
            const senderPhone = senderJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/\D/g, '');

            // Determine if using LID
            const isLid = senderJid.includes('@lid');

            // Get content safest way
            const messageContent =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
                msg.message?.ephemeralMessage?.message?.conversation ||
                '';

            if (!messageContent) return;

            const cleanText = messageContent.toLowerCase().trim();
            const keyword = cleanText.replace(/[^a-z0-9]/g, '');

            // Handle location message specifically
            const isLocation = !!(msg.message?.locationMessage || msg.message?.ephemeralMessage?.message?.locationMessage);
            const locationData = isLocation ? (msg.message?.locationMessage || msg.message?.ephemeralMessage?.message?.locationMessage) : null;

            // Allow processing if it's a location message OR has text content
            if (!messageContent && !isLocation) return;

            console.log(`📩 [WhatsAppHandler] From: ${senderPhone} (LID: ${isLid}) | Text: "${cleanText}" | Location: ${isLocation}`);

            // Self ignore
            if (msg.key.fromMe) return;

            // 1. Identify User
            // Note: If sender is LID and we don't have mapping, this might return null.
            let customer = await this.getCustomerByPhone(senderPhone);

            // If customer failed by phone, generic logic might fail.
            // But we should still reply to the senderJid provided.

            // 2. Session Handling
            let session = await WhatsAppSessionService.getSession(senderPhone);

            // Special handling for session with Location
            if (session && isLocation) {
                await this.handleRegistration(service, senderJid, senderPhone, '', session, locationData);
                return;
            }

            // 3. Advanced Keyword Matching (Menu / Greetings)
            const isGreeting = /^(halo|hallo|hai|hi|p|tes|test|ping|assalamualaikum|selamat|pagi|siang|sore|malam)/.test(cleanText);
            const isMenu = /^(menu|info|help|bantuan|\/menu|\.menu|batal|cancel|exit)/.test(cleanText);

            if (isGreeting || isMenu) {
                await WhatsAppSessionService.clearSession(senderPhone);
                await this.sendMenu(service, senderJid, customer); // Reply to the JID that sent the message
                return;
            }

            // 4. Registration Flow
            if (!customer) {
                // Check if it's registration keyword
                if (/^(daftar|reg|registrasi)/.test(keyword)) {
                    await this.handleRegistration(service, senderJid, senderPhone, cleanText, null, null);
                    return;
                }

                // If in session
                if (session) {
                    await this.handleRegistration(service, senderJid, senderPhone, messageContent, session, null);
                    return;
                }

                // If unknown user and not greeting/menu -> AI or Menu
                // Fallback to menu currently for safety
                // await this.sendMenu(service, senderJid, null);
                // return;
            }

            // 5. Customer Logic
            if (keyword === 'tagihan' || keyword === 'cek' || keyword === 'cektagihan') {
                await this.handleCheckBill(service, senderJid, customer);
                return;
            }

            // 5. Customer Logic
            if (keyword === 'tagihan' || keyword === 'cek' || keyword === 'cektagihan') {
                await this.handleCheckBill(service, senderJid, customer);
                return;
            }

            // AUTO TICKET CREATION (Lapor/Gangguan)
            if (/^(lapor|aduan|gangguan|kendala|rusak|mati)/.test(keyword)) {
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar. Silakan hubungi admin.');
                    return;
                }

                // CHECK FOR MASS OUTAGE (GANGGUAN MASSAL)
                try {
                    const [moRows] = await databasePool.query<RowDataPacket[]>(
                        "SELECT `value` FROM settings WHERE `key` = 'mass_outage_active' LIMIT 1"
                    ).catch(() => [[], []]);

                    if (moRows && moRows.length > 0 && (moRows[0].value === '1' || moRows[0].value === 'true')) {
                        const [msgRows] = await databasePool.query<RowDataPacket[]>(
                            "SELECT `value` FROM settings WHERE `key` = 'mass_outage_message' LIMIT 1"
                        ).catch(() => [[], []]);

                        const outageMsg = (msgRows && msgRows.length > 0) ? msgRows[0].value : 'Saat ini sedang terjadi gangguan teknis pada infrastruktur pusat (Gangguan Massal). Tim kami sedang bekerja melakukan perbaikan secepatnya.\n\nMohon maaf atas ketidaknyamanannya.';

                        await service.sendMessage(senderJid, `📢 *INFO GANGGUAN PUSAT*\n\n${outageMsg}\n\n_Tiket tidak dibuat karena tim sudah menangani masalah ini._`);
                        return;
                    }
                } catch (ignore) { }

                // Check if already has pending ticket? (Optional optimization, skipping for now to allow multiple reports if needed, or maybe check limits)

                // Extract description
                let description = cleanText.replace(/^(lapor|aduan|gangguan|kendala|rusak|mati)\s*/, '').trim();
                if (!description) description = "Laporan gangguan via WhatsApp (Tanpa detail)";

                try {
                    // Dynamic import to avoid circular dependency
                    const { TechnicianController } = await import('../../controllers/technician/TechnicianController');

                    const ticketNumber = await TechnicianController.createJob({
                        title: `Laporan Gangguan WA`,
                        description: `Dari WA: ${description}`,
                        customer_id: customer.id,
                        priority: 'high',
                        address: customer.address || 'Alamat belum diset',
                        reported_by: 'customer_wa',
                        coordinates: customer.coordinates // if available
                    });

                    if (ticketNumber) {
                        await service.sendMessage(senderJid, `✅ *TIKET BERHASIL DIBUAT*\n\nNomor Tiket: *${ticketNumber}*\n\nLaporan Anda telah diteruskan ke tim teknisi kami. Mohon tunggu, teknisi akan segera menghubungi Anda saat tiket diproses.\n\nTerima kasih.`);
                    } else {
                        await service.sendMessage(senderJid, 'Maaf, gagal membuat tiket. Silakan coba lagi nanti atau hubungi Admin.');
                    }
                } catch (err) {
                    console.error('[WA AutoTicket] Error:', err);
                    await service.sendMessage(senderJid, 'Terjadi kesalahan sistem saat membuat tiket.');
                }
                return;
            }

            // QRIS Feature
            if (keyword === 'qris' || keyword === 'bayar' || cleanText.includes('qr code')) {
                const qrisPath = path.join(process.cwd(), 'public', 'images', 'payments', 'qris.png');
                if (require('fs').existsSync(qrisPath)) {
                    await service.sendMessage(senderJid, 'Tunggu sebentar, sedang mengambil kode QRIS...');
                    await service.sendImage(senderJid, qrisPath, 'Scan QRIS ini untuk melakukan pembayaran.\n\n*Otomatis Terverifikasi* ✅');
                } else {
                    await service.sendMessage(senderJid, 'Maaf, gambar QRIS belum tersedia. Silakan hubungi admin.');
                }
                return;
            }

            // RESET CONNECTION Feature (with AI Guidance)
            if (keyword === 'reset' || cleanText === '/reset') {
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar sebagai pelanggan.');
                    return;
                }

                await WhatsAppSessionService.setSession(senderPhone, {
                    step: 'reset_confirm',
                    data: { customerId: customer.id, connType: customer.connection_type, pppoeUser: customer.pppoe_username }
                });

                const greeting = `🛠️ *Panduan Reset Koneksi (AI Assistant)*\n\nHalo ${customer.name}, saya mendeteksi Anda ingin mereset koneksi internet.\n\n*Apa yang akan terjadi?*\n1. Sistem akan memutus koneksi Anda dari server pusat.\n2. Modem/Router Anda akan dipaksa menyambung ulang (reconnect).\n3. IP Address Anda mungkin akan diperbarui.\n\n_Biasanya ini ampuh mengatasi internet lemot atau bengong._\n\nApakah Anda yakin ingin melanjutkan?\nKetik *YA* untuk konfirmasi.`;

                await service.sendMessage(senderJid, greeting);
                return;
            }

            // Handle Reset Confirmation
            if (session && session.step === 'reset_confirm') {
                if (cleanText === 'ya' || cleanText === 'ok' || cleanText === 'lanjut') {
                    await service.sendMessage(senderJid, '🔄 *Memproses Reset...*\nMohon tunggu dalam 10-30 detik sistem sedang me-refresh sesi Anda...');

                    try {
                        // Dynamic Import Mikrotik Service to avoid circular deps if any
                        const { getMikrotikConfig } = await import('../../utils/mikrotikConfigHelper');
                        const { RouterOSAPI } = await import('node-routeros');

                        const config = await getMikrotikConfig();
                        const configWithTls = config ? { ...config, use_tls: config.use_tls || false } : null;

                        if (configWithTls) {
                            const api = new RouterOSAPI({
                                host: configWithTls.host,
                                port: configWithTls.port,
                                user: configWithTls.username,
                                password: configWithTls.password,
                                timeout: 10000
                            });

                            await api.connect();

                            let resetSuccess = false;
                            const customerData = session.data;

                            if (customerData.connType === 'pppoe' && customerData.pppoeUser) {
                                // PPPoE Kick
                                const active = await api.write('/ppp/active/print', [`?name=${customerData.pppoeUser}`]);
                                if (active && active.length > 0) {
                                    for (const act of active) {
                                        await api.write('/ppp/active/remove', [`=.id=${act['.id']}`]);
                                    }
                                    resetSuccess = true;
                                    console.log(`[WhatsApp Reset] Kicked PPPoE user: ${customerData.pppoeUser}`);
                                } else {
                                    // User not active, maybe that's the problem? try simple response
                                    console.log(`[WhatsApp Reset] PPPoE user not active: ${customerData.pppoeUser}`);
                                }
                            } else if (customerData.connType === 'static_ip') {
                                // Static IP Reset (Disable then Enable Queue)
                                // We need to find the queue by client name. Assuming customer name usually used in queue or DB lookup?
                                // Better approach: Check static_ip_clients table
                                const [rows] = await databasePool.query<RowDataPacket[]>('SELECT client_name FROM static_ip_clients WHERE customer_id = ?', [customerData.customerId]);
                                if (rows.length > 0 && rows[0].client_name) {
                                    const clientName = rows[0].client_name;
                                    const { findQueueTreeIdByName, updateQueueTree } = await import('../../services/mikrotikService');

                                    // Toggle Down
                                    const dlId = await findQueueTreeIdByName(configWithTls, clientName);
                                    if (dlId) {
                                        await updateQueueTree(configWithTls, dlId, { disabled: 'yes' });
                                        await new Promise(r => setTimeout(r, 1000)); // wait 1s
                                        await updateQueueTree(configWithTls, dlId, { disabled: 'no' });
                                        resetSuccess = true;
                                    }

                                    // Toggle Up
                                    const upId = await findQueueTreeIdByName(configWithTls, `UP-${clientName}`);
                                    if (upId) {
                                        await updateQueueTree(configWithTls, upId, { disabled: 'yes' });
                                        await new Promise(r => setTimeout(r, 500));
                                        await updateQueueTree(configWithTls, upId, { disabled: 'no' });
                                    }
                                }
                            }

                            await api.close();

                            if (resetSuccess) {
                                await service.sendMessage(senderJid, '✅ *Reset Berhasil!*\nKoneksi Anda telah diputus dan disambung ulang. Silakan coba akses internet kembali.\n\n_Jika masih berkendala, segera hubungi admin._');
                            } else {
                                await service.sendMessage(senderJid, '⚠️ *Reset Selesai (Soft)*\nTidak ditemukan sesi aktif yang nyangkut, namun sistem telah direfresh. Coba matikan dan nyalakan modem Anda secara manual jika masih gangguan.');
                            }

                        } else {
                            await service.sendMessage(senderJid, '❌ Gagal terhubung ke Router Pusat. Hubungi Admin.');
                        }
                    } catch (err: any) {
                        console.error('Reset Error:', err);
                        await service.sendMessage(senderJid, '❌ Terjadi kesalahan saat mereset. Silakan coba lagi nanti.');
                    }

                    await WhatsAppSessionService.clearSession(senderPhone);
                    return;
                } else if (cleanText === 'batal' || cleanText === 'tidak' || cleanText === 'no') {
                    await WhatsAppSessionService.clearSession(senderPhone);
                    await service.sendMessage(senderJid, 'Reset dibatalkan. Koneksi Anda tetap berjalan seperti biasa.');
                    return;
                } else {
                    await service.sendMessage(senderJid, 'Ketik *YA* untuk konfirmasi Reset, atau *Batal* untuk membatalkan.');
                    return; // Stay in session
                }
            }

            if (/^(beli|paket|internet)/.test(keyword)) {
                const { PrepaidBotHandler } = await import('./PrepaidBotHandler');
                const resp = await PrepaidBotHandler.handleBuyCommand(senderJid, customer); // Pass JID handling to predefined
                if (resp) await service.sendMessage(senderJid, resp);
                return;
            }

            // Prepaid Selection (1, 2, 3)
            if (['1', '2', '3'].includes(cleanText)) {
                const { PrepaidBotHandler } = await import('./PrepaidBotHandler');
                const resp = await PrepaidBotHandler.handlePackageSelection(senderJid, customer, cleanText);
                if (resp) {
                    await service.sendMessage(senderJid, resp);
                    return;
                }
            }

            // 5.5 Self-Service Name Update (One-Time Only)
            if (/^(edit|ganti|ubah)\s+nama/.test(cleanText)) {
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar.');
                    return;
                }

                if (customer.name_edited_at) {
                    await service.sendMessage(senderJid, '⚠️ Maaf, Anda sudah pernah mengubah nama pelanggan satu kali. Untuk perubahan data lebih lanjut, silakan hubungi Admin.');
                    return;
                }

                // Extract name safely (preserving case for the name part)
                // "edit nama " is 10 chars, but regex handles variations.
                // easier to split by space and join rest
                const parts = messageContent.split(/\s+/);
                const newName = parts.slice(2).join(' ').trim();

                if (newName.length < 3) {
                    await service.sendMessage(senderJid, '⚠️ Nama terlalu pendek. Mohon masukkan nama lengkap yang valid.\nContoh: *Ganti Nama Budi Santoso*');
                    return;
                }

                try {
                    await databasePool.query(
                        'UPDATE customers SET name = ?, name_edited_at = NOW() WHERE id = ?',
                        [newName, customer.id]
                    );
                    await service.sendMessage(senderJid, `✅ *Sukses!* Nama pelanggan berhasil diubah menjadi:\n\n*${newName}*\n\n_Catatan: Fitur ubah nama mandiri ini hanya dapat digunakan satu kali._`);
                } catch (err) {
                    console.error('Error updating customer name via WA:', err);
                    await service.sendMessage(senderJid, 'Maaf, terjadi kesalahan sistem saat memproses permintaan Anda.');
                }
                return;
            }

            // 6. WiFi Commands (Strict & Loose Matching)
            if (cleanText.includes('wifi') || cleanText.includes('password') || cleanText.includes('sandi')) {
                if (customer) {
                    if (/^(info|cek)\s*wifi/.test(cleanText) || cleanText === 'wifi') {
                        const res = await GenieacsWhatsAppController.getCurrentWiFiInfo(senderPhone); // Use senderPhone for lookup
                        await service.sendMessage(senderJid, res.message);
                        return;
                    }
                    if (cleanText === 'ganti password' || cleanText === 'ganti sandi') {
                        await service.sendMessage(senderJid, 'Untuk mengganti password WiFi, ketik: Ganti Password [PasswordBaru]\nContoh: Ganti Password rahasia123');
                        return;
                    }
                    if (cleanText.startsWith('ganti password ') || cleanText.startsWith('ganti sandi ')) {
                        const newPass = messageContent.split(/\s+/).slice(2).join(' ').trim();
                        if (!newPass) {
                            await service.sendMessage(senderJid, 'Password tidak boleh kosong.');
                            return;
                        }
                        const res = await GenieacsWhatsAppController.changeWiFiPassword(senderPhone, newPass);
                        await service.sendMessage(senderJid, res.message);
                        return;
                    }
                }
            }

            // 6.2 Reboot ONT Command
            if (keyword === 'reboot' || cleanText === 'restart modem' || cleanText === '/reboot') {
                if (customer) {
                    await service.sendMessage(senderJid, '🔄 Memproses perintah restart modem...');
                    const res = await GenieacsWhatsAppController.restartONT(senderPhone);
                    await service.sendMessage(senderJid, res.message);
                } else {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar.');
                }
                return;
            }

            // 6.5 Admin/Operator Request
            if (keyword === 'admin' || keyword === 'operator' || cleanText.includes('hubungi admin')) {
                await service.sendMessage(senderJid, `👨‍💼 *Kontak Admin/Operator*\n\nSilakan hubungi kami di:\nwa.me/628123456789 (Admin Utama)\n\n_Jam Operasional: 08:00 - 17:00_`);
                return;
            }

            // 7. AI ChatBot Fallback
            try {
                // If customer is null, treat as guest. AI will handle generic Q&A.
                const aiResponse = await ChatBotService.ask(messageContent, customer || { status: 'guest' });
                await service.sendMessage(senderJid, aiResponse);
            } catch (error) {
                // Fallback to menu if AI fails
                console.error('[Handler] AI Error:', error);
                await this.sendMenu(service, senderJid, customer);
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    private static async getCustomerByPhone(phone: string): Promise<any> {
        // Normalize phone number - strip all non-digits first
        const cleanPhone = phone.replace(/\D/g, '');

        // If phone is too short or too long (LID), skip
        if (cleanPhone.length < 9 || cleanPhone.length > 15) {
            console.log(`[WhatsAppHandler] Phone ${phone} invalid length, skipping lookup`);
            return null;
        }

        // Generate all possible formats
        const formats: string[] = [];

        // Original
        formats.push(cleanPhone);

        // If starts with 62, try without it (convert to 0xxx)
        if (cleanPhone.startsWith('62')) {
            formats.push('0' + cleanPhone.substring(2));
            formats.push(cleanPhone.substring(2)); // raw without prefix
        }

        // If starts with 0, try with 62
        if (cleanPhone.startsWith('0')) {
            formats.push('62' + cleanPhone.substring(1));
            formats.push(cleanPhone.substring(1)); // raw without 0
        }

        // If starts with 8 (raw), try 08 and 628
        if (cleanPhone.startsWith('8')) {
            formats.push('0' + cleanPhone);
            formats.push('62' + cleanPhone);
        }

        // Remove duplicates
        const uniqueFormats = [...new Set(formats)];

        console.log(`[WhatsAppHandler] Looking up phone: ${phone} -> formats:`, uniqueFormats);

        for (const fmt of uniqueFormats) {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone = ? LIMIT 1',
                [fmt]
            );
            if (rows.length > 0) {
                console.log(`[WhatsAppHandler] ✅ Found customer: ${rows[0].name} (phone: ${rows[0].phone})`);
                return rows[0];
            }
        }

        // Fallback: Try partial LIKE match (last 9 digits)
        if (cleanPhone.length >= 9) {
            const last9 = cleanPhone.slice(-9);
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone LIKE ? LIMIT 1',
                [`%${last9}`]
            );
            if (rows.length > 0) {
                console.log(`[WhatsAppHandler] ✅ Found customer via partial match: ${rows[0].name}`);
                return rows[0];
            }
        }

        console.log(`[WhatsAppHandler] ❌ No customer found for phone: ${phone}`);
        return null;
    }

    private static async sendMenu(service: WhatsAppService, jid: string, customer: any) {
        let text = '';
        if (customer) {
            text = `👋 Halo *${customer.name}*\n\n` +
                `🤖 *Menu Otomatis*\n` +
                `• Ketik *Tagihan* untuk cek tagihan\n` +
                `• Ketik *Beli* untuk paket (Prabayar)\n` +
                `• Ketik *WiFi* untuk info WiFi\n` +
                `• Ketik *Menu* untuk lihat ini lagi\n\n` +
                `🛠️ *Fitur Teknis*\n` +
                `• Ketik *Reset* untuk refresh koneksi\n` +
                `• Ketik *Reboot* untuk restart Modem\n\n` +
                `_Butuh bantuan lain? Tulis pertanyaan Anda, AI kami akan membantu!_`;
        } else {
            text = `👋 Selamat datang di Billing System.\n\n` +
                `Nomor Anda belum terdaftar di sistem kami.\n` +
                `Ketik *Daftar* untuk registrasi pelanggan baru.\n\n` +
                `_Atau silakan tulis pertanyaan Anda._`;
        }
        await service.sendMessage(jid, text);
    }

    private static async handleCheckBill(service: WhatsAppService, jid: string, customer: any) {
        if (!customer) {
            await service.sendMessage(jid, 'Maaf, nomor Anda belum terdaftar.');
            return;
        }

        const [inv] = await databasePool.query<RowDataPacket[]>(
            `SELECT * FROM invoices WHERE customer_id = ? AND status != 'paid' ORDER BY id DESC LIMIT 1`,
            [customer.id]
        );

        if (inv.length > 0) {
            const i = inv[0];
            const msg = `🧾 *Info Tagihan*\n\n` +
                `Periode: ${i.period_date || '-'}\n` +
                `Total: Rp ${parseFloat(i.remaining_amount).toLocaleString('id-ID')}\n` +
                `Jatuh Tempo: ${i.due_date ? new Date(i.due_date).toLocaleDateString() : '-'}\n\n` +
                `Silakan lakukan pembayaran sebelum jatuh tempo.`;
            await service.sendMessage(jid, msg);
        } else {
            await service.sendMessage(jid, `✅ Terimakasih! Tidak ada tagihan yang tertunggak saat ini.`);
        }
    }

    private static async handleRegistration(service: WhatsAppService, jid: string, phone: string, text: string, session: any, location: any) {
        if (!session) {
            if (/^(daftar|reg)/.test(text)) {
                await WhatsAppSessionService.setSession(phone, { step: 'name', data: {} });
                await service.sendMessage(jid, 'Silakan masukkan *Nama Lengkap* Anda:');
            } else {
                await this.sendMenu(service, jid, null);
            }
            return;
        }

        switch (session.step) {
            case 'name':
                await WhatsAppSessionService.updateSession(phone, { step: 'address', data: { ...session.data, name: text } });
                await service.sendMessage(jid, 'Terima kasih. Sekarang masukkan *Alamat Lengkap* Anda:');
                break;
            case 'address':
                await WhatsAppSessionService.updateSession(phone, { step: 'location', data: { ...session.data, address: text } });
                await service.sendMessage(jid, 'Terakhir, mohon kirimkan *Lokasi (Share Location)* Anda saat ini agar teknisi kami mudah menemukan lokasi pemasangan.\n\n(Klik ikon klip kertas/tambah -> Lokasi/Location -> Kirim lokasi saat ini)');
                break;
            case 'location':
                if (!location) {
                    await service.sendMessage(jid, 'Mohon kirimkan format *Lokasi (Maps)*, bukan teks.\nAtau ketik *Batal* untuk membatalkan.');
                    return;
                }

                const userData = {
                    ...session.data,
                    phone: phone,
                    latitude: location.degreesLatitude,
                    longitude: location.degreesLongitude
                };

                try {
                    // Save to registration_requests table
                    await databasePool.query(
                        'INSERT INTO registration_requests (name, address, phone, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?)',
                        [userData.name, userData.address, userData.phone, userData.latitude, userData.longitude, 'pending']
                    );

                    await service.sendMessage(jid, `✅ Terima kasih *${userData.name}*.\nData & Lokasi Anda telah kami terima.\n\nAdmin kami akan segera menghubungi Anda untuk proses selanjutnya.`);
                } catch (error) {
                    console.error('Error saving registration request:', error);
                    await service.sendMessage(jid, 'Maaf, terjadi kesalahan sistem saat menyimpan data registrasi. Silakan coba lagi nanti.');
                }

                await WhatsAppSessionService.clearSession(phone);
                break;
        }
    }
}
