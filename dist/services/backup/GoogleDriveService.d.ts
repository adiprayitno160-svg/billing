export declare class GoogleDriveService {
    private auth;
    private drive;
    private keyFilePath;
    private folderName;
    private folderId;
    constructor();
    /**
     * Initialize Google Drive Client
     */
    init(): Promise<void>;
    /**
     * Get or Create backup folder
     */
    getFolderId(): Promise<string>;
    /**
     * Upload File to Drive
     */
    uploadFile(filePath: string, fileName: string): Promise<any>;
    /**
     * Check if credentials exist
     */
    hasCredentials(): boolean;
}
//# sourceMappingURL=GoogleDriveService.d.ts.map