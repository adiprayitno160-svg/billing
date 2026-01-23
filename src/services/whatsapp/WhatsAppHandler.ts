
import { WAMessage, proto } from '@whiskeysockets/baileys';
import { WhatsAppService } from './WhatsAppService';
import { databasePool } from '../../db/pool';
import { WhatsAppSessionService } from './WhatsAppSessionService';
import { RowDataPacket } from 'mysql2';
import { GenieacsWhatsAppController } from '../../controllers/whatsapp/GenieacsWhatsAppController';
import { ChatBotService } from '../ai/ChatBotService';

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
        // Normalize 628... to 08... or vice versa logic if needed. 
        // Best approach: try multiple formats
        // Also handle if phone is actually an LID (very long number), it won't be in DB probably.

        const formats = [
            phone,
            phone.replace(/^62/, '0'),
            `62${phone.replace(/^0/, '')}`
        ];

        for (const fmt of formats) {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone = ? OR phone = ? LIMIT 1',
                [fmt, fmt]
            );
            if (rows.length > 0) return rows[0];
        }
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
