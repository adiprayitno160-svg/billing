const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

// Konfigurasi
const PORT = 3001; // Port untuk webhook (bukan port aplikasi utama)
const SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-here'; // Ganti dengan secret key yang aman
const APP_PATH = '/opt/billing';
const UPDATE_SCRIPT = path.join(__dirname, 'auto-update.sh');

// Fungsi untuk menjalankan command
function execCommand(command, cwd = APP_PATH) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command failed: ${command}`);
                console.error(`Error: ${error.message}`);
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Fungsi untuk verify GitHub webhook signature
function verifySignature(payload, signature, secret) {
    if (!signature) return false;
    
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
    );
}

// HTTP Server untuk menerima webhook
const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook/github') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }

    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            // Verify signature
            const signature = req.headers['x-hub-signature-256'];
            if (!verifySignature(body, signature, SECRET)) {
                console.error('Invalid webhook signature!');
                res.writeHead(401, { 'Content-Type': 'text/plain' });
                res.end('Unauthorized');
                return;
            }

            const payload = JSON.parse(body);
            
            // Only process push events to main branch
            if (payload.ref === 'refs/heads/main' && payload.repository) {
                console.log(`📥 Webhook received: Push to main branch`);
                console.log(`📦 Commit: ${payload.head_commit?.id?.substring(0, 7)}`);
                console.log(`👤 Author: ${payload.head_commit?.author?.name}`);
                console.log(`💬 Message: ${payload.head_commit?.message}`);
                
                // Run auto-update script
                console.log('🚀 Starting auto-update...');
                
                execCommand(`bash ${UPDATE_SCRIPT}`)
                    .then(() => {
                        console.log('✅ Auto-update completed successfully');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            message: 'Auto-update triggered successfully' 
                        }));
                    })
                    .catch((error) => {
                        console.error('❌ Auto-update failed:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            error: error.message 
                        }));
                    });
            } else {
                // Not a push to main branch, ignore
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Event ignored (not push to main)' 
                }));
            }
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                error: error.message 
            }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`🔔 GitHub Webhook server listening on port ${PORT}`);
    console.log(`📡 Webhook URL: http://your-server-ip:${PORT}/webhook/github`);
    console.log(`🔐 Secret: ${SECRET.substring(0, 8)}...`);
});

