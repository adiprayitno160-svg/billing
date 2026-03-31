/**
 * Service untuk mendapatkan konfigurasi URL berdasarkan mode (domain/local)
 */
export declare class UrlConfigService {
    /**
     * Mendapatkan URL aktif berdasarkan mode yang diaktifkan
     * Prioritas: Domain Mode > Local Mode > Fallback ke localhost
     */
    static getActiveUrl(): Promise<string>;
    /**
     * Mendapatkan domain URL jika domain mode aktif
     */
    static getDomainUrl(): Promise<string | null>;
    /**
     * Mendapatkan local URL jika local mode aktif
     */
    static getLocalUrl(): Promise<string | null>;
    /**
     * Cek apakah domain mode aktif
     */
    static isDomainModeEnabled(): Promise<boolean>;
    /**
     * Cek apakah local mode aktif
     */
    static isLocalModeEnabled(): Promise<boolean>;
    /**
     * Mendapatkan semua URL yang aktif (domain dan local jika keduanya aktif)
     */
    static getAllActiveUrls(): Promise<string[]>;
}
//# sourceMappingURL=urlConfigService.d.ts.map