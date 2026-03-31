export declare class SettingsService {
    /**
     * Get setting value by key
     */
    static get(key: string, defaultValue?: string): Promise<string>;
    /**
     * Set setting value
     */
    static set(key: string, value: string, description?: string): Promise<void>;
    /**
     * Get boolean setting
     */
    static getBoolean(key: string, defaultValue?: boolean): Promise<boolean>;
    /**
     * Get number setting
     */
    static getNumber(key: string, defaultValue?: number): Promise<number>;
    /**
     * Get all settings
     */
    static getAll(): Promise<any>;
}
//# sourceMappingURL=SettingsService.d.ts.map