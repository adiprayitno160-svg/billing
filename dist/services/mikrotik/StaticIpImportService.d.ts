export interface StaticIpCandidate {
    queueId: string;
    queueName: string;
    packetMark: string;
    maxLimit: string;
    ipAddress: string | null;
    gatewayIp: string | null;
    gatewayIpId: string | null;
    interface: string | null;
    comment: string;
    mangleId?: string;
}
export declare class StaticIpImportService {
    private getPoolConfig;
    /**
     * Helper: Cek apakah string adalah format IP address valid
     */
    private isValidIpAddress;
    /**
     * Helper: Konversi IP ke integer
     */
    private ipToInt;
    /**
     * Helper: Cek apakah 2 IP berada di network yang sama berdasarkan prefix
     * Contoh: 192.168.239.2 dan 192.168.239.1/30 → true (sama-sama di network /30)
     */
    private isSameNetwork;
    /**
     * Helper: Format bandwidth limit dari bytes ke readable (K/M/G)
     */
    private formatBandwidth;
    private formatSingleBandwidth;
    /**
     * Memindai MikroTik untuk mencari kandidat Queue Tree yang bisa di-import.
     * Deteksi: IP Pelanggan, Gateway IP, Interface
     */
    scanCandidates(): Promise<StaticIpCandidate[]>;
    /**
     * Helper: Bersihkan string dari karakter aneh (\r, \n, null)
     */
    private sanitizeString;
    /**
     * Mengubah nama Queue Tree agar sesuai standar Billing
     */
    renameQueue(queueId: string, newName: string, newLimit?: string): Promise<boolean>;
    /**
     * Mengubah comment di Mangle untuk tracking
     */
    tagMangle(mangleId: string, comment: string): Promise<boolean>;
    /**
     * ISOLIR: Disable IP Address di MikroTik (matikan gateway pelanggan)
     */
    disableIpAddress(ipAddressId: string): Promise<boolean>;
    /**
     * RESTORE: Enable IP Address di MikroTik (aktifkan kembali gateway pelanggan)
     */
    enableIpAddress(ipAddressId: string): Promise<boolean>;
    /**
     * Cari IP Address ID berdasarkan IP
     */
    findIpAddressId(gatewayIp: string): Promise<string | null>;
}
//# sourceMappingURL=StaticIpImportService.d.ts.map