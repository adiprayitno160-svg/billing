import TelegramBot from 'node-telegram-bot-api';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface RegistrationState {
    step: 'NAME' | 'PHONE' | 'ADDRESS' | 'COORDINATES' | 'TYPE' | 'INTERFACE' | 'PACKAGE';
    data: {
        name?: string;
        phone?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        type?: 'pppoe' | 'static_ip';
        interface?: string;
        packageId?: number;
    }
}

export class TelegramDaftarHandler {
    private bot: TelegramBot;
    private states: Record<number, RegistrationState> = {};

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    public async handleCommand(msg: TelegramBot.Message, user: any) {
        const chatId = msg.chat.id;
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'teknisi')) {
            await this.bot.sendMessage(chatId, '❌ Perintah /daftar hanya untuk admin dan teknisi.');
            return;
        }

        this.states[chatId] = {
            step: 'NAME',
            data: {}
        };

        await this.bot.sendMessage(chatId, '📝 *Registrasi Pelanggan Baru*\n\nSilakan masukkan *Nama Lengkap* pelanggan:', { parse_mode: 'Markdown' });
    }

    public isRegistering(chatId: number): boolean {
        return !!this.states[chatId];
    }

    public async handleMessage(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        const state = this.states[chatId];
        if (!state) return;
        if (!msg.text && !msg.location) return;

        if (msg.text && msg.text.startsWith('/')) {
            // Cancel registration on new command
            delete this.states[chatId];
            return;
        }

        try {
            switch (state.step) {
                case 'NAME':
                    if (!msg.text) return;
                    state.data.name = msg.text.trim();
                    state.step = 'PHONE';
                    await this.bot.sendMessage(chatId, `Nama dicatat: *${state.data.name}*\n\nSilakan masukkan *Nomor Telepon/WhatsApp*:`, { parse_mode: 'Markdown' });
                    break;
                case 'PHONE':
                    if (!msg.text) return;
                    const rawPhone = msg.text.trim();
                    const justNumbers = rawPhone.replace(/\D/g, '');
                    if (justNumbers.length < 8 || rawPhone.match(/[a-zA-Z]/)) {
                        await this.bot.sendMessage(chatId, `❌ Nomor Telepon tidak valid. Harap masukkan angka saja (contoh: 081234567890).\n\nSilakan masukkan *Nomor Telepon/WhatsApp* kembali:`, { parse_mode: 'Markdown' });
                        return;
                    }
                    state.data.phone = justNumbers;
                    state.step = 'ADDRESS';
                    await this.bot.sendMessage(chatId, `Nomor Telepon dicatat: *${state.data.phone}*\n\nSilakan masukkan *Alamat Lengkap*:`, { parse_mode: 'Markdown' });
                    break;
                case 'ADDRESS':
                    if (!msg.text) return;
                    state.data.address = msg.text.trim();
                    state.step = 'COORDINATES';
                    await this.bot.sendMessage(chatId, `Alamat dicatat.\n\nSilakan masukkan *Titik Koordinat* (Latitude, Longitude) secara manual, ATAU tekan tombol *Kirim Lokasi* di bawah ini:`, { 
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [[{ text: '📍 Kirim Lokasi Saat Ini', request_location: true }]],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    });
                    break;
                case 'COORDINATES':
                    if (msg.location) {
                        state.data.latitude = msg.location.latitude;
                        state.data.longitude = msg.location.longitude;
                    } else if (msg.text) {
                        const coords = msg.text.trim().split(',');
                        if (coords.length < 2 || isNaN(parseFloat(coords[0])) || isNaN(parseFloat(coords[1]))) {
                            await this.bot.sendMessage(chatId, '❌ Format koordinat tidak valid. Harus berupa angka dipisah koma (contoh: -7.123, 110.456) atau gunakan tombol Kirim Lokasi.');
                            return;
                        }
                        state.data.latitude = parseFloat(coords[0]);
                        state.data.longitude = parseFloat(coords[1]);
                    } else {
                        return;
                    }
                    state.step = 'TYPE';
                    
                    const inlineKeyboard = {
                        inline_keyboard: [
                            [
                                { text: 'PPPoE', callback_data: 'daftar_type_pppoe' },
                                { text: 'Static IP', callback_data: 'daftar_type_static_ip' }
                            ]
                        ]
                    };
                    
                    // Hilangkan custom keyboard (Kirim Lokasi) dulu
                    await this.bot.sendMessage(chatId, 'Koordinat berhasil dicatat.', {
                        reply_markup: { remove_keyboard: true }
                    });
                    
                    await this.bot.sendMessage(chatId, `Titik koordinat: \`${state.data.latitude}, ${state.data.longitude}\`\n\nPilih *Tipe Koneksi*:`, {
                        parse_mode: 'Markdown',
                        reply_markup: inlineKeyboard
                    });
                    break;
            }
        } catch (e) {
            console.error('Error in handleMessage:', e);
            await this.bot.sendMessage(chatId, '❌ Terjadi kesalahan. Ketik /daftar untuk mengulang.');
            delete this.states[chatId];
        }
    }

    public async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<boolean> {
        const chatId = query.message?.chat.id;
        const data = query.data;
        if (!chatId || !data || !this.states[chatId]) return false;

        const state = this.states[chatId];

        try {
            if (data.startsWith('daftar_type_')) {
                const type = data.replace('daftar_type_', '');
                if (type !== 'pppoe' && type !== 'static_ip') return false;

                state.data.type = type as 'pppoe' | 'static_ip';

                if (type === 'static_ip') {
                    state.step = 'INTERFACE';
                    
                    // Fetch interface list from mikrotik if possible, or give a simple list
                    let interfaces: any[] = [];
                    try {
                        const { getMikrotikConfig } = await import('../../utils/mikrotikConfigHelper');
                        const { getInterfaces } = await import('../../services/mikrotikService');
                        const config = await getMikrotikConfig();
                        if (config) {
                            const mikrotikIfaces = await getInterfaces(config);
                            interfaces = mikrotikIfaces.map(i => ({ name: i.name }));
                        }
                    } catch (e) {
                        console.error('Failed to get interfaces, using default', e);
                    }
                    
                    if (interfaces.length === 0) {
                        interfaces = [{name: 'ether1'}, {name: 'ether2'}, {name: 'ether3'}, {name: 'ether4'}];
                    }

                    const keyboardRows = [];
                    for (let i = 0; i < interfaces.length; i += 2) {
                        const row = [];
                        row.push({ text: interfaces[i].name, callback_data: `daftar_iface_${interfaces[i].name}` });
                        if (i + 1 < interfaces.length) {
                            row.push({ text: interfaces[i + 1].name, callback_data: `daftar_iface_${interfaces[i + 1].name}` });
                        }
                        keyboardRows.push(row);
                    }

                    await this.bot.editMessageText(`Tipe dipilih: *${type}*\n\nSilakan pilih *Interface* MikroTik untuk Static IP:`, {
                        chat_id: chatId,
                        message_id: query.message?.message_id,
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboardRows }
                    });
                    return true;
                } else {
                    state.step = 'PACKAGE';
                    return await this.promptPackages(chatId, query.message?.message_id);
                }

            } else if (data.startsWith('daftar_iface_')) {
                const iface = data.replace('daftar_iface_', '');
                state.data.interface = iface;
                state.step = 'PACKAGE';
                return await this.promptPackages(chatId, query.message?.message_id);

            } else if (data.startsWith('daftar_pkg_')) {
                const packageId = parseInt(data.replace('daftar_pkg_', ''));
                state.data.packageId = packageId;
                
                await this.bot.editMessageText(`Memproses pendaftaran pelanggan... Mohon tunggu ⏳`, {
                    chat_id: chatId,
                    message_id: query.message?.message_id
                });

                await this.finalizeRegistration(chatId);
                return true;
            }
        } catch (e) {
            console.error('Error in handleCallbackQuery:', e);
            await this.bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses data. Ketik /daftar untuk mengulang.');
            delete this.states[chatId];
        }
        return false;
    }

    private async promptPackages(chatId: number, messageId?: number): Promise<boolean> {
        const state = this.states[chatId];
        let packages: any[] = [];
        if (state.data.type === 'pppoe') {
            const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, price FROM packages WHERE status = "active"');
            packages = rows;
        } else {
            const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, price FROM static_ip_packages WHERE status = "active"');
            packages = rows;
        }

        if (packages.length === 0) {
            await this.bot.sendMessage(chatId, `❌ Tidak ada paket aktif untuk tipe ${state.data.type}. Pendaftaran dibatalkan.`);
            delete this.states[chatId];
            return true;
        }

        const keyboardRows = [];
        for (let i = 0; i < packages.length; i += 2) {
            const row = [];
            row.push({ text: packages[i].name, callback_data: `daftar_pkg_${packages[i].id}` });
            if (i + 1 < packages.length) {
                row.push({ text: packages[i + 1].name, callback_data: `daftar_pkg_${packages[i + 1].id}` });
            }
            keyboardRows.push(row);
        }

        const text = state.data.type === 'static_ip' ? 
            `Interface dipilih: *${state.data.interface}*\n\nSilakan pilih *Paket Internet*:` : 
            `Tipe dipilih: *${state.data.type}*\n\nSilakan pilih *Paket Internet*:`;

        await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboardRows }
        });
        return true;
    }

    private async finalizeRegistration(chatId: number) {
        const state = this.states[chatId];
        if (!state || !state.data.name) return;

        try {
            let packageInfo;
            if (state.data.type === 'pppoe') {
                const [pkgRows] = await pool.query<RowDataPacket[]>('SELECT * FROM packages WHERE id = ?', [state.data.packageId]);
                packageInfo = pkgRows[0];
            } else {
                const [pkgRows] = await pool.query<RowDataPacket[]>('SELECT * FROM static_ip_packages WHERE id = ?', [state.data.packageId]);
                packageInfo = pkgRows[0];
            }

            if (!packageInfo) {
                await this.bot.sendMessage(chatId, '❌ Paket tidak ditemukan.');
                delete this.states[chatId];
                return;
            }

            let pppoeUsername, pppoePassword, allocatedIp;
            if (state.data.type === 'pppoe') {
                pppoeUsername = `${state.data.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '')}${Math.floor(1000 + Math.random() * 9000)}`;
                pppoePassword = Math.floor(100000 + Math.random() * 900000).toString();
            } else if (state.data.type === 'static_ip') {
                let baseSubnet = '192.168.239';
                try {
                    const [ipRows] = await pool.query<RowDataPacket[]>('SELECT ip_address FROM static_ip_clients ORDER BY id DESC LIMIT 1');
                    if (ipRows.length > 0 && ipRows[0].ip_address) {
                        const ipStr = ipRows[0].ip_address.split('/')[0];
                        const parts = ipStr.split('.');
                        if (parts.length === 4) {
                            baseSubnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
                        }
                    }
                    const [allClients] = await pool.query<RowDataPacket[]>('SELECT ip_address FROM static_ip_clients');
                    const usedIps = allClients.map(row => row.ip_address.split('/')[0]);
                    
                    for (let i = 2; i <= 254; i += 4) {
                        const candidate = `${baseSubnet}.${i}`;
                        if (!usedIps.includes(candidate)) {
                            allocatedIp = `${candidate}/30`;
                            break;
                        }
                    }
                } catch(e) {
                    console.error('Failed to pre-allocate IP:', e);
                }
            }

            // Create JSON notes
            const notesObj = {
                type: state.data.type,
                packageId: state.data.packageId,
                packageName: packageInfo.name,
                interface: state.data.interface || null,
                telegram_chat_id: chatId,
                pppoe_username: pppoeUsername,
                pppoe_password: pppoePassword,
                allocated_ip: allocatedIp
            };

            const notesJson = JSON.stringify(notesObj);
            
            // Format phone number to start with 62
            let phone = state.data.phone || '0000000000';
            phone = phone.replace(/\D/g, '');
            if (phone.startsWith('0')) {
                phone = '62' + phone.substring(1);
            }

            // Insert into registration_requests (status = pending)
            await pool.query<ResultSetHeader>(
                `INSERT INTO registration_requests (
                    name, phone, address, latitude, longitude, 
                    notes, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
                [
                    state.data.name, 
                    phone, 
                    state.data.address || '', 
                    state.data.latitude || null, 
                    state.data.longitude || null, 
                    notesJson
                ]
            );

            let successMsg = `✅ *Permintaan Registrasi Berhasil Disimpan!*\n\nData pelanggan baru telah masuk ke antrian **Permintaan Registrasi** di Dashboard Admin.\n\n`;
            successMsg += `⚠️ *Informasi Konfigurasi ONT (Segera Setting)*:\n\n`;
            if (state.data.type === 'pppoe') {
                successMsg += `📡 *Koneksi PPPoE*\nUser: \`${pppoeUsername}\`\nPass: \`${pppoePassword}\`\nPaket: ${packageInfo.name}`;
            } else if (state.data.type === 'static_ip') {
                successMsg += `🖥️ *Koneksi Static IP*\nIP: \`${allocatedIp || 'GAGAL GENERATE'}\`\nInterface: ${state.data.interface}\nPaket: ${packageInfo.name}`;
            }
            successMsg += `\n\n📌 *Harap tunggu Admin klik Setujui agar internet mulai berjalan.*`;

            await this.bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('Finalize registration error:', error);
            await this.bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses pendaftaran. Silakan coba lagi.');
        } finally {
            delete this.states[chatId];
        }
    }
}
