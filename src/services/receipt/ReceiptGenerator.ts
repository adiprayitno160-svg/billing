
import sharp from 'sharp';

export class ReceiptGenerator {

    static async generate(data: {
        date: string;
        refId: string;
        name: string;
        amount: number;
        item: string;
        paymentMethod: string;
    }): Promise<Buffer> {

        const width = 800;
        const height = 1000;
        const formattedAmount = data.amount.toLocaleString('id-ID');

        // SVG Template simulating a mobile banking receipt (e.g., BRIMO style - Blue Theme)
        const svgImage = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#00529C;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#0485E0;stop-opacity:1" />
                </linearGradient>
            </defs>
            
            <!-- Background -->
            <rect width="100%" height="100%" fill="#F0F4F8" />
            
            <!-- Header Background -->
            <rect width="100%" height="250" fill="url(#grad1)" rx="0" ry="0" />
            
            <!-- Success Icon Circle -->
            <circle cx="400" cy="180" r="40" fill="#FFFFFF" />
            <path d="M385 180 L395 190 L415 170" stroke="#00A51F" stroke-width="5" fill="none" />
            
            <!-- Title -->
            <text x="400" y="80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">TRANSAKSI BERHASIL</text>
            <text x="400" y="110" font-family="Arial, sans-serif" font-size="18" fill="#E0E0E0" text-anchor="middle">${data.date}</text>
            
            <!-- Card Container -->
            <rect x="50" y="240" width="700" height="650" rx="15" ry="15" fill="white" stroke="#E0E0E0" stroke-width="1" shadow="5" />
            
            <!-- Use a monospace font logic for receipt details -->
            <g font-family="Arial, sans-serif" font-size="24" fill="#333333">
                
                <!-- Reference -->
                <text x="80" y="300" fill="#888888" font-size="18">Nomor Referensi</text>
                <text x="720" y="300" text-anchor="end" font-weight="bold">${data.refId}</text>
                <line x1="80" y1="320" x2="720" y2="320" stroke="#EEEEEE" stroke-width="2" />
                
                <!-- Source -->
                <text x="80" y="370" fill="#888888" font-size="18">Sumber Dana</text>
                <text x="720" y="370" text-anchor="end">${data.name}</text>
                
                <!-- Destination -->
                <text x="80" y="420" fill="#888888" font-size="18">Tujuan Transfer</text>
                <text x="720" y="420" text-anchor="end" font-weight="bold">ISP BILLING SYSTEM</text>
                <text x="720" y="445" text-anchor="end" font-size="16" fill="#666">BCA 1234567890</text>
                
                <line x1="80" y1="480" x2="720" y2="480" stroke="#EEEEEE" stroke-width="2" />
                
                <!-- Item -->
                 <text x="80" y="530" fill="#888888" font-size="18">Pembelian</text>
                <text x="720" y="530" text-anchor="end">${data.item}</text>
                
                <!-- Amount -->
                <text x="400" y="620" text-anchor="middle" font-size="18" fill="#888888">Total Nominal</text>
                <text x="400" y="670" text-anchor="middle" font-size="56" font-weight="bold" fill="#00529C">Rp ${formattedAmount}</text>
                
                 <!-- Status Badge -->
                <rect x="300" y="740" width="200" height="50" rx="25" fill="#E8F5E9" />
                <text x="400" y="773" text-anchor="middle" fill="#2E7D32" font-size="20" font-weight="bold">LUNAS</text>

            </g>
            
            <!-- Footer -->
            <text x="400" y="940" font-family="Arial, sans-serif" font-size="14" fill="#AAAAAA" text-anchor="middle">Terima kasih telah menggunakan layanan kami.</text>
            <text x="400" y="960" font-family="Arial, sans-serif" font-size="14" fill="#AAAAAA" text-anchor="middle">ISP Billing System Automation</text>
        </svg>
        `;

        try {
            const buffer = await sharp(Buffer.from(svgImage))
                .png()
                .toBuffer();
            return buffer;
        } catch (error) {
            console.error('Receipt Generation Failed:', error);
            throw new Error('Failed to generate receipt image');
        }
    }
}
