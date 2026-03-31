"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemLogController = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const BillingLogService_1 = require("../../services/billing/BillingLogService");
class SystemLogController {
    /**
     * Show Logs Page
     */
    static async index(req, res) {
        try {
            const logDir = path_1.default.join(process.cwd(), 'logs');
            let logFiles = [];
            if (fs_1.default.existsSync(logDir)) {
                logFiles = fs_1.default.readdirSync(logDir)
                    .filter(file => file.endsWith('.log'))
                    .sort((a, b) => {
                    // Sort by modification time desc
                    return fs_1.default.statSync(path_1.default.join(logDir, b)).mtime.getTime() -
                        fs_1.default.statSync(path_1.default.join(logDir, a)).mtime.getTime();
                });
            }
            // Check for System SSH Logs (Linux only)
            const sshLogPath = '/var/log/auth.log';
            let includeSsh = false;
            if (process.platform !== 'win32' && fs_1.default.existsSync(sshLogPath)) {
                try {
                    fs_1.default.accessSync(sshLogPath, fs_1.default.constants.R_OK);
                    logFiles.push('System SSH Log (auth.log)');
                    includeSsh = true;
                }
                catch (e) {
                    console.warn('SSH Log exists but not readable by app user');
                }
            }
            // Default to showing the most recent file or error.log if available
            let selectedFile = req.query.file || (logFiles.includes('err.log') ? 'err.log' : logFiles[0]);
            let fileContent = '';
            let isSystemLog = false;
            if (selectedFile === 'System SSH Log (auth.log)') {
                isSystemLog = true;
            }
            if (selectedFile) {
                let filePath;
                if (isSystemLog) {
                    filePath = sshLogPath;
                }
                else if (logFiles.includes(selectedFile)) {
                    filePath = path_1.default.join(logDir, selectedFile);
                }
                if (filePath && fs_1.default.existsSync(filePath)) {
                    // Read last 2000 lines approx (read last 100KB)
                    const stats = fs_1.default.statSync(filePath);
                    const fileSize = stats.size;
                    const bufferSize = Math.min(100 * 1024, fileSize);
                    if (bufferSize > 0) {
                        const buffer = Buffer.alloc(bufferSize);
                        const fd = fs_1.default.openSync(filePath, 'r');
                        fs_1.default.readSync(fd, buffer, 0, bufferSize, fileSize - bufferSize);
                        fs_1.default.closeSync(fd);
                        fileContent = buffer.toString('utf-8');
                    }
                }
            }
            // Also fetch recent DB logs
            const dbLogs = await BillingLogService_1.BillingLogService.getLogs({ limit: 50, level: 'error' });
            res.render('settings/system-logs', {
                title: 'System Logs',
                logFiles,
                selectedFile,
                fileContent,
                dbLogs,
                currentPath: '/settings/logs'
            });
        }
        catch (error) {
            console.error('Error viewing logs:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat log sistem: ' + error.message,
                status: 500
            });
        }
    }
    /**
     * API to stream/tail logs (simple version)
     */
    static async getLogContent(req, res) {
        try {
            const filename = req.params.filename;
            const logDir = path_1.default.join(process.cwd(), 'logs');
            const filePath = path_1.default.join(logDir, filename);
            if (!filename || !filename.endsWith('.log') || !fs_1.default.existsSync(filePath)) {
                return res.json({ success: false, message: 'File log tidak valid' });
            }
            // Read last 50KB
            const stats = fs_1.default.statSync(filePath);
            const bufferSize = Math.min(50 * 1024, stats.size);
            const buffer = Buffer.alloc(bufferSize);
            const fd = fs_1.default.openSync(filePath, 'r');
            fs_1.default.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs_1.default.closeSync(fd);
            res.json({ success: true, content: buffer.toString('utf-8') });
        }
        catch (error) {
            res.json({ success: false, message: error.message });
        }
    }
}
exports.SystemLogController = SystemLogController;
//# sourceMappingURL=SystemLogController.js.map