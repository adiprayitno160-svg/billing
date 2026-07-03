import TelegramBot from 'node-telegram-bot-api';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { KasirController } from '../../controllers/kasirController';

interface PembayaranState {
    step: 'SEARCH' | 'SELECT_CUSTOMER' | 'SELECT_INVOICE' | 'SELECT_METHOD';
    data: {
        keyword?: string;
        customerId?: number;
        customerName?: string;
        invoiceId?: number;
        invoiceNumber?: string;
        amount?: number;
        paymentMethod?: string;
    }
}

export class TelegramPembayaranHandler {
    private bot: TelegramBot;
    private states: Record<number, PembayaranState> = {};
    private kasirController: KasirController;

    constructor(bot: TelegramBot) {
        this.bot = bot;
        this.kasirController = new KasirController();
    }

    public async handleCommand(msg: TelegramBot.Message, user: any) {
        const chatId = msg.chat.id;
        console.log(`[Pembayaran] handleCommand started for chatId: ${chatId}`);

        this.states[chatId] = {
            step: 'SEARCH',
            data: {}
        };
        console.log(`[Pembayaran] state set to SEARCH for chatId: ${chatId}`);

        try {
            await this.bot.sendMessage(chatId, '💸 *Pembayaran Tagihan*\n\nSilakan ketik *Nama* atau *Kode Pelanggan* yang akan melakukan pembayaran:', { parse_mode: 'Markdown' });
            console.log(`[Pembayaran] welcome message sent to chatId: ${chatId}`);
        } catch (e) {
            console.error(`[Pembayaran] Error sending welcome message:`, e);
        }
    }

    public isPaying(chatId: number): boolean {
        return !!this.states[chatId];
    }

    public async handleMessage(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        const state = this.states[chatId];
        console.log(`[Pembayaran] handleMessage called for chatId: ${chatId}, text: ${msg.text}, step: ${state?.step}`);
        if (!state) return;
        if (!msg.text) return;

        if (msg.text.startsWith('/')) {
            // Cancel payment on new command
            delete this.states[chatId];
            return;
        }

        try {
            switch (state.step) {
                case 'SEARCH':
                    state.data.keyword = msg.text.trim();
                    const keyword = `%${state.data.keyword}%`;
                    console.log(`[Pembayaran] Searching for keyword: ${keyword}`);
                    
                    // Cari pelanggan yang punya tagihan pending/overdue
                    const [customers] = await pool.query<RowDataPacket[]>(`
                        SELECT c.id, c.name, c.customer_code, c.address, COUNT(i.id) as pending_invoices
                        FROM customers c
                        JOIN invoices i ON c.id = i.customer_id
                        WHERE (c.name LIKE ? OR c.customer_code LIKE ?) AND i.status IN ('sent', 'partial', 'overdue', 'carried_over')
                        GROUP BY c.id
                        LIMIT 10
                    `, [keyword, keyword]);
                    
                    console.log(`[Pembayaran] Search result count: ${customers.length}`);

                    if (customers.length === 0) {
                        await this.bot.sendMessage(chatId, `❌ Tidak ada tagihan tertunda untuk pencarian: *${state.data.keyword}*.\n\nKetik nama atau kode pelanggan lain, atau /cancel untuk membatalkan.`, { parse_mode: 'Markdown' });
                        return;
                    }

                    if (customers.length === 1) {
                        console.log(`[Pembayaran] Found exactly 1 customer, proceeding to promptInvoices`);
                        // Langsung pilih pelanggan ini
                        state.data.customerId = customers[0].id;
                        state.data.customerName = customers[0].name;
                        state.step = 'SELECT_INVOICE';
                        await this.promptInvoices(chatId);
                    } else {
                        console.log(`[Pembayaran] Found ${customers.length} customers, showing options`);
                        // Tampilkan pilihan
                        state.step = 'SELECT_CUSTOMER';
                        const keyboardRows = customers.map(c => {
                            const addr = c.address ? ` - ${c.address.substring(0, 15)}` : '';
                            const code = c.customer_code || `#${c.id}`;
                            const text = `${code} ${c.name}${addr} (${c.pending_invoices} tgh)`.substring(0, 60);
                            return [{ text: text, callback_data: `bayar_cust_${c.id}` }];
                        });

                        await this.bot.sendMessage(chatId, `Ditemukan beberapa pelanggan:\n\nSilakan pilih pelanggan:`, {
                            reply_markup: { inline_keyboard: keyboardRows }
                        });
                    }
                    break;
                case 'SELECT_CUSTOMER':
                case 'SELECT_INVOICE':
                case 'SELECT_METHOD':
                    console.log(`[Pembayaran] User typed message during button selection step: ${state.step}`);
                    // User shouldn't type here, but if they do, we can just prompt them to click or ignore.
                    await this.bot.sendMessage(chatId, 'Tolong gunakan tombol di atas untuk memilih, atau ketik /cancel untuk batal.');
                    break;
            }
        } catch (e: any) {
            console.error('[Pembayaran] Error in handleMessage:', e);
            await this.bot.sendMessage(chatId, `❌ Terjadi kesalahan:\n${e.message}\n\nKetik /pembayaran untuk mengulang.`);
            delete this.states[chatId];
        }
    }

    public async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<boolean> {
        const chatId = query.message?.chat.id;
        const data = query.data;
        if (!chatId || !data || !this.states[chatId]) return false;

        const state = this.states[chatId];

        try {
            if (data.startsWith('bayar_cust_')) {
                const customerId = parseInt(data.replace('bayar_cust_', ''));
                
                const [cust] = await pool.query<RowDataPacket[]>('SELECT name FROM customers WHERE id = ?', [customerId]);
                if (cust.length > 0) {
                    state.data.customerId = customerId;
                    state.data.customerName = cust[0].name;
                    state.step = 'SELECT_INVOICE';
                    
                    await this.bot.editMessageText(`Pelanggan terpilih: *${state.data.customerName}*`, {
                        chat_id: chatId,
                        message_id: query.message?.message_id,
                        parse_mode: 'Markdown'
                    });
                    
                    await this.promptInvoices(chatId);
                }
                return true;

            } else if (data.startsWith('bayar_inv_')) {
                const invoiceId = parseInt(data.replace('bayar_inv_', ''));
                
                const [inv] = await pool.query<RowDataPacket[]>(`
                    SELECT invoice_number, remaining_amount, total_amount 
                    FROM invoices WHERE id = ?
                `, [invoiceId]);

                if (inv.length > 0) {
                    state.data.invoiceId = invoiceId;
                    state.data.invoiceNumber = inv[0].invoice_number;
                    state.data.amount = parseFloat(inv[0].remaining_amount || inv[0].total_amount);
                    state.step = 'SELECT_METHOD';

                    const keyboardRows = [
                        [
                            { text: '💵 Cash', callback_data: 'bayar_method_cash' },
                            { text: '🏦 Transfer', callback_data: 'bayar_method_transfer' }
                        ]
                    ];

                    await this.bot.editMessageText(
                        `Tagihan dipilih: *${state.data.invoiceNumber}*\n` +
                        `Nominal: *Rp ${state.data.amount.toLocaleString('id-ID')}*\n\n` +
                        `Pilih Metode Pembayaran:`, 
                        {
                            chat_id: chatId,
                            message_id: query.message?.message_id,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: keyboardRows }
                        }
                    );
                }
                return true;

            } else if (data.startsWith('bayar_method_')) {
                const method = data.replace('bayar_method_', '');
                state.data.paymentMethod = method;
                
                await this.bot.editMessageText(`Memproses pembayaran tagihan *${state.data.invoiceNumber}* via ${method}... ⏳`, {
                    chat_id: chatId,
                    message_id: query.message?.message_id,
                    parse_mode: 'Markdown'
                });

                await this.finalizePayment(chatId);
                return true;
            }
        } catch (e: any) {
            console.error('Error in handleCallbackQuery:', e);
            await this.bot.sendMessage(chatId, `❌ Terjadi kesalahan saat memproses data:\n${e.message}\n\nKetik /pembayaran untuk mengulang.`);
            delete this.states[chatId];
        }
        return false;
    }

    private async promptInvoices(chatId: number) {
        const state = this.states[chatId];
        if (!state.data.customerId) return;

        const [invoices] = await pool.query<RowDataPacket[]>(`
            SELECT id, invoice_number, period, remaining_amount, total_amount 
            FROM invoices 
            WHERE customer_id = ? AND status IN ('sent', 'partial', 'overdue', 'carried_over')
            ORDER BY period ASC
        `, [state.data.customerId]);

        if (invoices.length === 0) {
            await this.bot.sendMessage(chatId, `❌ Tidak ada tagihan tertunda untuk *${state.data.customerName}*.`, { parse_mode: 'Markdown' });
            delete this.states[chatId];
            return;
        }

        const keyboardRows = invoices.map(i => {
            const amount = parseFloat(i.remaining_amount || i.total_amount);
            return [{ text: `${i.invoice_number} (Periode ${i.period}) - Rp ${amount.toLocaleString('id-ID')}`, callback_data: `bayar_inv_${i.id}` }];
        });

        const [custInfo] = await pool.query<RowDataPacket[]>('SELECT address FROM customers WHERE id = ?', [state.data.customerId]);
        const custAddress = custInfo[0]?.address ? `\n📍 Alamat: ${custInfo[0].address}` : '';

        await this.bot.sendMessage(chatId, `Silakan pilih Tagihan untuk dilunasi:\n👤 *${state.data.customerName}*${custAddress}`, {
            reply_markup: { inline_keyboard: keyboardRows }
        });
    }

    private async finalizePayment(chatId: number) {
        const state = this.states[chatId];
        if (!state || !state.data.customerId || !state.data.invoiceId || !state.data.amount || !state.data.paymentMethod) return;

        try {
            let kasirId = 1;
            try {
                // If there's a custom mapped user id or username, fetch here, otherwise fallback to 1.
                // We'll safely fallback to 1.
                kasirId = 1; 
            } catch (err) {}

            const result = await this.kasirController.processPaymentTransaction(
                state.data.customerId,
                state.data.amount,
                state.data.paymentMethod,
                `Pembayaran via Telegram Bot (Kasir ID: ${kasirId})`,
                kasirId,
                'partial',
                false,
                [state.data.invoiceId]
            );

            if (result.success) {
                await this.bot.sendMessage(chatId, `✅ *Pembayaran Berhasil*\n\nTagihan *${state.data.invoiceNumber}* sebesar *Rp ${state.data.amount.toLocaleString('id-ID')}* untuk pelanggan *${state.data.customerName}* telah lunas!`, { parse_mode: 'Markdown' });
            } else {
                await this.bot.sendMessage(chatId, `❌ Gagal memproses pembayaran: ${result.message}`);
            }
        } catch (error: any) {
            console.error('Finalize payment error:', error);
            await this.bot.sendMessage(chatId, `❌ Terjadi kesalahan server saat memproses pembayaran:\n${error.message}\n\nSilakan cek riwayat tagihan manual.`);
        } finally {
            delete this.states[chatId];
        }
    }
}
