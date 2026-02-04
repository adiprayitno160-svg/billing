import express from 'express';
import { createServer } from 'http';
import axios from 'axios';

const app = express();
const port = 3002;
const MAIN_APP_URL = 'http://localhost:3001';

app.get('/whatsapp', (req, res) => {
    // Redirect to main app (port 3001)
    const host = req.get('host'); // e.g. 192.168.239.154:3002
    if (host) {
        const domain = host.split(':')[0];
        res.redirect(`http://${domain}:3001/whatsapp`);
    } else {
        res.redirect('http://localhost:3001/whatsapp');
    }
});

app.get('/', async (req, res) => {
    let mainAppStatus = 'UNKNOWN';
    let responseTime = 0;

    try {
        const start = Date.now();
        await axios.get(MAIN_APP_URL);
        responseTime = Date.now() - start;
        mainAppStatus = 'ONLINE';
    } catch (error) {
        mainAppStatus = 'OFFLINE';
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Billing System Monitor</title>
        <meta http-equiv="refresh" content="30">
        <style>
            body { font-family: sans-serif; padding: 20px; background: #f0f2f5; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
            .status { font-size: 24px; font-weight: bold; margin: 20px 0; }
            .online { color: green; }
            .offline { color: red; }
            .metric { margin: 10px 0; color: #666; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>System Monitor</h1>
            <div class="status ${mainAppStatus.toLowerCase()}">
                Main App (Port 3001): ${mainAppStatus}
            </div>
            <div class="metric">Response Time: ${responseTime}ms</div>
            <div class="metric">Last Checked: ${new Date().toLocaleString()}</div>
            <div class="metric">Monitor running on Port 3002</div>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
    console.log(`Monitoring system running on http://localhost:${port}`);
});
