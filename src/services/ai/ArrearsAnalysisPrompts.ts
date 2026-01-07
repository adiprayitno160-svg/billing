
export class ArrearsAnalysisPrompts {

    /**
     * PROMPT 1: Early Warning Analysis (1-2x Tunggakan)
     * Digunakan untuk pelanggan yang belum mencapai ambang batas 3x, tapi sudah mulai menunggak.
     */
    static getEarlyWarningPrompt(
        customer: { name: string; id: number },
        arrearsStats: {
            count: number; // Jumlah invoice unpaid 1 tahun terakhir
            totalAmount: number;
            oldestUnpaidDate: string;
        },
        historySummary: any[] // Ringkasan history 1 tahun terakhir
    ): string {
        return `
    Peran: Anda adalah AI Financial Advisor untuk ISP (Internet Service Provider) yang empatik namun tegas.
    
    DATA PELANGGAN (1 Tahun Terakhir):
    - Nama: ${customer.name}
    - ID: ${customer.id}
    - Jumlah Tunggakan (Invoice Unpaid): ${arrearsStats.count} kali
    - Total Tagihan Belum Dibayar: Rp ${arrearsStats.totalAmount.toLocaleString('id-ID')}
    - Tanggal Tunggakan Tertua: ${arrearsStats.oldestUnpaidDate}
    
    KONTEKS:
    Sistem kami memiliki kebijakan PERKETATAN: "Jika pelanggan menunggak/telat bayar sebanyak 2x dalam 1 tahun terakhir, status akun akan OTOMATIS dipindahkan dari Pascabayar menjadi PRABAYAR."
    DAN "Layanan internet akan dikunci total (Isolir) dan tidak bisa digunakan meskipun membeli paket, sampai SELURUH tunggakan lama dilunasi."
    
    Saat ini pelanggan ini baru menunggak ${arrearsStats.count} kali. Belum mencapai batas 2x, tapi harus segera diperingatkan dengan tegas.
    
    TUGAS:
    1. Analisa risiko pembayaran pelanggan ini.
    2. Buatkan pesan peringatan personal untuk WhatsApp.
    
    SYARAT PESAN (WA):
    - Nada bicara: Tegas namun tetap sopan dan profesional.
    - Peringatan Utama: Jelaskan kebijakan baru: "Tunggakan ke-2 akan menyebabkan akun otomatis pindah ke Prabayar & Internet TERKUNCI sampai utang lunas".
    - Ajak untuk segera melunasi tagihan tertunggak sekarang juga.
    
    OUTPUT FORMAT (JSON):
    {
      "riskScore": number (0-100),
      "analysisSummary": "string singkat analisismu",
      "whatsappMessage": "string pesan untuk dikirim ke pelanggan"
    }
    `;
    }

    /**
     * PROMPT 2: Migration Action Analysis (>= 3x Tunggakan)
     * Digunakan saat pelanggan sudah mencapai limit 3x tunggakan dalam 1 tahun.
     * AI harus memvalidasi keputusan migrasi ke Prabayar.
     */
    static getMigrationActionPrompt(
        customer: { name: string; id: number; phone: string },
        arrearsStats: {
            count: number;
            totalAmount: number;
            unpaidInvoicesList: any[];
        }
    ): string {
        return `
    Peran: Anda adalah Sistem Keputusan Otomatis Billing ISP.
    
    DATA PELANGGAN:
    - Nama: ${customer.name}
    - Total Kali Menunggak (1 Tahun Terakhir): ${arrearsStats.count} kali
    - Ambang Batas Logika Sistem: 2 kali
    - Total Utang Gantung: Rp ${arrearsStats.totalAmount.toLocaleString('id-ID')}
    
    SITUASI:
    Pelanggan ini telah menunggak >= 2 kali. Sistem akan melakukan MIGRASI KE PRABAYAR + ISOLIR.
    Arti Isolir disini: Meskipun akun sudah jadi Prabayar, mereka TIDAK BISA menggunakan internet (walaupun beli paket) SEBELUM utang lama (Rp ${arrearsStats.totalAmount.toLocaleString('id-ID')}) dilunasi total.
    
    TUGAS:
    1. Validasi keputusan: Apakah ${arrearsStats.count} >= 2?
    2. Buatkan Pesan Notifikasi Final ke pelanggan.
    
    SYARAT PESAN (WA):
    - Nada bicara: Tegas, Formal, Informatif.
    - Info: "Akun Anda telah dialihkan ke PRABAYAR karena keterlambatan pembayaran ke-${arrearsStats.count}."
    - Kunci Utama: TEKANKAN BAHWA "Layanan internet Anda saat ini TERKUNCI. Untuk membuka kembali & membeli paket prabayar, Anda WAJIB melunasi seluruh tunggakan sebesar Rp ${arrearsStats.totalAmount.toLocaleString('id-ID')} terlebih dahulu."
    - Berikan instruksi cara bayar.
    
    OUTPUT FORMAT (JSON):
    {
      "shouldMigrate": boolean (true jika count >= 2),
      "confidence": number (0-100),
      "reasoning": "string alasan",
      "whatsappMessage": "string pesan final"
    }
    `;
    }
}
