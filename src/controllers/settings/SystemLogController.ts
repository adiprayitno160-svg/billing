
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { BillingLogService } from '../../services/billing/BillingLogService';

export class SystemLogController {
    /**
     * Show Logs Page
     */
    static async index(req: Request, res: Response) {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            let logFiles: string[] = [];

            if (fs.existsSync(logDir)) {
                logFiles = fs.readdirSync(logDir)
                    .filter(file => file.endsWith('.log'))
                    .sort((a, b) => {
                        // Sort by modification time desc
                        return fs.statSync(path.join(logDir, b)).mtime.getTime() -
                            fs.statSync(path.join(logDir, a)).mtime.getTime();
                    });
            }

            // Check for System SSH Logs (Linux only)
            const sshLogPath = '/var/log/auth.log';
            let includeSsh = false;
            if (process.platform !== 'win32' && fs.existsSync(sshLogPath)) {
                try {
                    fs.accessSync(sshLogPath, fs.constants.R_OK);
                    logFiles.push('System SSH Log (auth.log)');
                    includeSsh = true;
                } catch (e) {
                    console.warn('SSH Log exists but not readable by app user');
                }
            }

            // Default to showing the most recent file or error.log if available
            let selectedFile = req.query.file as string || (logFiles.includes('err.log') ? 'err.log' : logFiles[0]);
            let fileContent = '';
            let isSystemLog = false;

            if (selectedFile === 'System SSH Log (auth.log)') {
                isSystemLog = true;
            }

            if (selectedFile) {
                let filePath;

                if (isSystemLog) {
                    filePath = sshLogPath;
                } else if (logFiles.includes(selectedFile)) {
                    filePath = path.join(logDir, selectedFile);
                }

                if (filePath && fs.existsSync(filePath)) {
                    // Read last 2000 lines approx (read last 100KB)
                    const stats = fs.statSync(filePath);
                    const fileSize = stats.size;
                    const bufferSize = Math.min(100 * 1024, fileSize);

                    if (bufferSize > 0) {
                        const buffer = Buffer.alloc(bufferSize);
                        const fd = fs.openSync(filePath, 'r');
                        fs.readSync(fd, buffer, 0, bufferSize, fileSize - bufferSize);
                        fs.closeSync(fd);
                        fileContent = buffer.toString('utf-8');
                    }
                }
            }

            // Also fetch recent DB logs
            const dbLogs = await BillingLogService.getLogs({ limit: 50, level: 'error' });

            res.render('settings/system-logs', {
                title: 'System Logs',
                logFiles,
                selectedFile,
                fileContent,
                dbLogs,
                currentPath: '/settings/logs'
            });

        } catch (error: any) {
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
    static async getLogContent(req: Request, res: Response) {
        try {
            const filename = req.params.filename;
            const logDir = path.join(process.cwd(), 'logs');
            const filePath = path.join(logDir, filename);

            if (!filename || !filename.endsWith('.log') || !fs.existsSync(filePath)) {
                return res.json({ success: false, message: 'File log tidak valid' });
            }

            // Read last 50KB
            const stats = fs.statSync(filePath);
            const bufferSize = Math.min(50 * 1024, stats.size);
            const buffer = Buffer.alloc(bufferSize);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);

            res.json({ success: true, content: buffer.toString('utf-8') });

        } catch (error: any) {
            res.json({ success: false, message: error.message });
        }
    }
}
