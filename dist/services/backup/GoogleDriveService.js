"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveService = void 0;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class GoogleDriveService {
    constructor() {
        this.folderName = 'BillingAppBackups'; // Default folder name
        this.folderId = null;
        this.keyFilePath = path_1.default.join(process.cwd(), 'storage', 'credentials', 'google-drive-key.json');
    }
    /**
     * Initialize Google Drive Client
     */
    async init() {
        if (!fs_1.default.existsSync(this.keyFilePath)) {
            throw new Error('Google Drive credentials (JSON) not found. Please upload it in settings.');
        }
        try {
            this.auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: this.keyFilePath,
                scopes: ['https://www.googleapis.com/auth/drive.file'],
            });
            this.drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
            // Verify auth works by getting about info
            await this.drive.about.get({ fields: 'user' });
        }
        catch (error) {
            throw new Error(`Failed to initialize Google Drive: ${error.message}`);
        }
    }
    /**
     * Get or Create backup folder
     */
    async getFolderId() {
        if (this.folderId)
            return this.folderId;
        if (!this.drive)
            await this.init();
        try {
            // Check if folder exists
            const res = await this.drive.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${this.folderName}' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            });
            if (res.data.files && res.data.files.length > 0) {
                this.folderId = res.data.files[0].id;
                return this.folderId;
            }
            else {
                // Create folder
                const fileMetadata = {
                    name: this.folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                };
                const file = await this.drive.files.create({
                    requestBody: fileMetadata,
                    fields: 'id',
                });
                this.folderId = file.data.id;
                return this.folderId;
            }
        }
        catch (error) {
            throw new Error(`Failed to get/create backup folder: ${error.message}`);
        }
    }
    /**
     * Upload File to Drive
     */
    async uploadFile(filePath, fileName) {
        if (!this.drive)
            await this.init();
        const folderId = await this.getFolderId();
        const resource = {
            name: fileName,
            parents: [folderId],
        };
        const media = {
            mimeType: 'application/octet-stream',
            body: fs_1.default.createReadStream(filePath),
        };
        try {
            const response = await this.drive.files.create({
                requestBody: resource,
                media: media,
                fields: 'id, name, webViewLink, size',
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Upload failed: ${error.message}`);
        }
    }
    /**
     * Check if credentials exist
     */
    hasCredentials() {
        return fs_1.default.existsSync(this.keyFilePath);
    }
}
exports.GoogleDriveService = GoogleDriveService;
//# sourceMappingURL=GoogleDriveService.js.map