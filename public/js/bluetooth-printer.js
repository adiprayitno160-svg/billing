/**
 * Bluetooth Thermal Printer (ESC/POS) - Web Bluetooth API
 * Supports 58mm & 80mm thermal printers via Bluetooth
 * 
 * Usage:
 *   const printer = new BluetoothPrinter();
 *   await printer.connect();
 *   printer.text('Hello World');
 *   await printer.print();
 */

class BluetoothPrinter {
    constructor(options = {}) {
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.connected = false;
        this.buffer = [];
        this.paperWidth = options.paperWidth || 32; // 58mm = 32 chars, 80mm = 48 chars
        this.encoder = new TextEncoder();

        // ESC/POS Constants
        this.ESC = 0x1B;
        this.GS = 0x1D;
        this.LF = 0x0A;
        this.CR = 0x0D;

        // Common Bluetooth printer service UUIDs
        this.PRINTER_SERVICE_UUIDS = [
            '000018f0-0000-1000-8000-00805f9b34fb', // Common thermal printer
            '00001101-0000-1000-8000-00805f9b34fb', // SPP (Serial Port Profile)
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Some Chinese printers
            '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip BLE
        ];

        this.CHAR_UUIDS = [
            '00002af1-0000-1000-8000-00805f9b34fb',
            '49535343-8841-43f4-a8d4-ecbe34729bb3',
            '49535343-1e4d-4bd9-ba61-23c647249616',
        ];

        // Try to restore last connected device name
        this.lastDeviceName = localStorage.getItem('bt_printer_name') || null;
        this.lastDeviceId = localStorage.getItem('bt_printer_id') || null;
    }

    /**
     * Check if Web Bluetooth is supported
     */
    static isSupported() {
        return 'bluetooth' in navigator;
    }

    /**
     * Connect to Bluetooth printer
     */
    async connect() {
        if (!BluetoothPrinter.isSupported()) {
            throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Chrome/Edge di Android.');
        }

        try {
            // Request device with all possible printer services
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.PRINTER_SERVICE_UUIDS
            });

            console.log('[BTPrinter] Device selected:', this.device.name);

            // Save device info
            localStorage.setItem('bt_printer_name', this.device.name || 'Unknown');
            localStorage.setItem('bt_printer_id', this.device.id || '');
            this.lastDeviceName = this.device.name;

            // Listen for disconnection
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('[BTPrinter] Disconnected');
                this.connected = false;
                this.dispatchEvent('disconnected');
            });

            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            console.log('[BTPrinter] GATT connected');

            // Find the writable characteristic
            await this._findCharacteristic();

            this.connected = true;
            this.dispatchEvent('connected', { name: this.device.name });

            return true;
        } catch (error) {
            console.error('[BTPrinter] Connection error:', error);
            if (error.message?.includes('cancelled')) {
                throw new Error('Pemilihan printer dibatalkan');
            }
            throw new Error('Gagal tersambung ke printer: ' + error.message);
        }
    }

    /**
     * Find writable characteristic from available services
     */
    async _findCharacteristic() {
        const services = await this.server.getPrimaryServices();
        console.log('[BTPrinter] Found services:', services.length);

        for (const service of services) {
            try {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        this.characteristic = char;
                        console.log('[BTPrinter] Found writable characteristic:', char.uuid);
                        return;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        throw new Error('Tidak menemukan characteristic untuk print. Pastikan printer Bluetooth kompatibel.');
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.connected = false;
    }

    // ============ ESC/POS Commands ============

    /**
     * Initialize printer
     */
    init() {
        this.buffer.push(new Uint8Array([this.ESC, 0x40])); // ESC @
        return this;
    }

    /**
     * Add text
     */
    text(str) {
        this.buffer.push(this.encoder.encode(str));
        return this;
    }

    /**
     * Add newline
     */
    newline(count = 1) {
        for (let i = 0; i < count; i++) {
            this.buffer.push(new Uint8Array([this.LF]));
        }
        return this;
    }

    /**
     * Center align text
     */
    center(str) {
        this.buffer.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center
        this.text(str);
        this.newline();
        this.buffer.push(new Uint8Array([this.ESC, 0x61, 0x00])); // Left
        return this;
    }

    /**
     * Right align text
     */
    right(str) {
        this.buffer.push(new Uint8Array([this.ESC, 0x61, 0x02])); // Right
        this.text(str);
        this.newline();
        this.buffer.push(new Uint8Array([this.ESC, 0x61, 0x00])); // Left
        return this;
    }

    /**
     * Bold text on/off
     */
    bold(on = true) {
        this.buffer.push(new Uint8Array([this.ESC, 0x45, on ? 0x01 : 0x00]));
        return this;
    }

    /**
     * Double height text
     */
    doubleHeight(on = true) {
        this.buffer.push(new Uint8Array([this.ESC, 0x21, on ? 0x10 : 0x00]));
        return this;
    }

    /**
     * Double width text
     */
    doubleWidth(on = true) {
        this.buffer.push(new Uint8Array([this.ESC, 0x21, on ? 0x20 : 0x00]));
        return this;
    }

    /**
     * Large text (double height + double width)
     */
    large(on = true) {
        this.buffer.push(new Uint8Array([this.ESC, 0x21, on ? 0x30 : 0x00]));
        return this;
    }

    /**
     * Underline
     */
    underline(on = true) {
        this.buffer.push(new Uint8Array([this.ESC, 0x2D, on ? 0x01 : 0x00]));
        return this;
    }

    /**
     * Print a row with label and value (right-aligned)
     */
    row(label, value) {
        const maxLen = this.paperWidth;
        const labelStr = String(label);
        const valueStr = String(value);
        const spaces = maxLen - labelStr.length - valueStr.length;
        const line = labelStr + ' '.repeat(Math.max(1, spaces)) + valueStr;
        this.text(line);
        this.newline();
        return this;
    }

    /**
     * Print a dashed divider line
     */
    divider(char = '-') {
        this.text(char.repeat(this.paperWidth));
        this.newline();
        return this;
    }

    /**
     * Print a double-line divider
     */
    doubleDivider() {
        this.divider('=');
        return this;
    }

    /**
     * Cut paper (partial cut)
     */
    cut() {
        this.newline(3);
        this.buffer.push(new Uint8Array([this.GS, 0x56, 0x01])); // Partial cut
        return this;
    }

    /**
     * Feed paper
     */
    feed(lines = 3) {
        this.buffer.push(new Uint8Array([this.ESC, 0x64, lines]));
        return this;
    }

    /**
     * Open cash drawer (if connected)
     */
    openDrawer() {
        this.buffer.push(new Uint8Array([this.ESC, 0x70, 0x00, 0x19, 0xFA]));
        return this;
    }

    // ============ Print Execution ============

    /**
     * Send buffer to printer
     */
    async print() {
        if (!this.connected || !this.characteristic) {
            throw new Error('Printer tidak terhubung');
        }

        // Merge all buffer into single Uint8Array
        const totalLen = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
        const data = new Uint8Array(totalLen);
        let offset = 0;
        for (const arr of this.buffer) {
            data.set(arr, offset);
            offset += arr.length;
        }

        // Send in chunks (BLE has MTU limit ~20 bytes, some printers ~512)
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            try {
                if (this.characteristic.properties.writeWithoutResponse) {
                    await this.characteristic.writeValueWithoutResponse(chunk);
                } else {
                    await this.characteristic.writeValue(chunk);
                }
            } catch (e) {
                console.error('[BTPrinter] Write error at offset', i, e);
                throw new Error('Gagal mengirim data ke printer');
            }
            // Small delay between chunks
            await new Promise(r => setTimeout(r, 30));
        }

        // Clear buffer
        this.buffer = [];
        console.log('[BTPrinter] Print complete, sent', data.length, 'bytes');
    }

    // ============ Receipt Templates ============

    /**
     * Print a payment receipt
     */
    async printReceipt(data) {
        this.init();

        // Header
        this.doubleDivider();
        this.bold(true);
        this.center(data.companyName || 'BILLING SYSTEM');
        this.bold(false);
        this.center(data.companyAddress || '');
        this.center(data.companyPhone || '');
        this.doubleDivider();

        // Receipt title
        this.bold(true);
        this.center('RECEIPT PEMBAYARAN');
        this.bold(false);
        this.divider();

        // Receipt info
        this.row('No. Receipt', '#' + data.paymentId);
        this.row('Tanggal', data.paymentDate);
        this.divider();

        // Customer info
        this.bold(true);
        this.center('DATA PELANGGAN');
        this.bold(false);
        this.row('ID', data.customerCode);
        this.row('Nama', data.customerName);
        if (data.customerPhone) this.row('Telp', data.customerPhone);
        if (data.packageName) this.row('Paket', data.packageName);
        this.divider();

        // Invoice info
        this.bold(true);
        this.center('DETAIL TAGIHAN');
        this.bold(false);
        this.row('No. Invoice', data.invoiceNumber);
        this.row('Periode', data.period);
        this.row('Total Tagihan', 'Rp ' + this._formatNumber(data.invoiceTotal));
        this.divider();

        // Payment info
        this.bold(true);
        this.center('DETAIL PEMBAYARAN');
        this.bold(false);
        this.row('Metode', (data.paymentMethod || 'CASH').toUpperCase());
        if (data.referenceNumber) this.row('Referensi', data.referenceNumber);

        this.doubleDivider();

        // Total
        this.large(true);
        this.center('Rp ' + this._formatNumber(data.amount));
        this.large(false);

        // Status
        this.newline();
        this.bold(true);
        this.center('*** LUNAS ***');
        this.bold(false);

        this.doubleDivider();

        // Kasir info
        this.row('Kasir', data.kasirName || 'System');

        // Footer
        this.newline();
        this.center('Terima kasih atas');
        this.center('pembayaran Anda!');
        this.center('Simpan struk ini sebagai');
        this.center('bukti pembayaran');
        this.divider();
        this.center(new Date().toLocaleString('id-ID'));

        this.feed(4);
        this.cut();

        await this.print();
    }

    /**
     * Print an invoice/tagihan
     */
    async printInvoice(data) {
        this.init();

        this.doubleDivider();
        this.bold(true);
        this.center(data.companyName || 'BILLING SYSTEM');
        this.bold(false);
        this.center(data.companyAddress || '');
        this.doubleDivider();

        this.bold(true);
        this.center('TAGIHAN INTERNET');
        this.bold(false);
        this.divider();

        this.row('No. Invoice', data.invoiceNumber);
        this.row('Periode', data.period);
        this.row('Jth Tempo', data.dueDate);
        this.divider();

        this.row('ID', data.customerCode);
        this.row('Nama', data.customerName);
        this.row('Alamat', data.customerAddress || '-');
        this.divider();

        // Items
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                this.text(item.description);
                this.newline();
                this.right('Rp ' + this._formatNumber(item.total_price));
            }
            this.divider();
        }

        // Totals
        if (data.discount > 0) {
            this.row('Subtotal', 'Rp ' + this._formatNumber(data.subtotal));
            this.row('Diskon', '-Rp ' + this._formatNumber(data.discount));
        }

        this.bold(true);
        this.row('TOTAL', 'Rp ' + this._formatNumber(data.totalAmount));
        this.bold(false);

        if (data.paidAmount > 0) {
            this.row('Terbayar', 'Rp ' + this._formatNumber(data.paidAmount));
            this.bold(true);
            this.row('SISA', 'Rp ' + this._formatNumber(data.remainingAmount));
            this.bold(false);
        }

        this.doubleDivider();

        this.center('Harap lakukan pembayaran');
        this.center('sebelum tanggal jatuh tempo');
        this.center('untuk menghindari isolir.');
        this.newline();
        this.center(new Date().toLocaleString('id-ID'));

        this.feed(4);
        this.cut();

        await this.print();
    }

    // ============ Helpers ============

    _formatNumber(num) {
        return Number(num || 0).toLocaleString('id-ID');
    }

    // Simple event system
    _listeners = {};
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }
    dispatchEvent(event, data) {
        (this._listeners[event] || []).forEach(cb => cb(data));
    }
}

// ============ Global Singleton ============
window.btPrinter = window.btPrinter || new BluetoothPrinter();
