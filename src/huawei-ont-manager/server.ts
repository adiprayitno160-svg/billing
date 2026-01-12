import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'ssh2';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = 3002;

// OLT Credentials (Should ideally be in .env)
const OLT_CONFIG = {
    host: process.env.OLT_HOST || '192.168.1.100',
    port: 22,
    username: process.env.OLT_USER || 'admin',
    password: process.env.OLT_PASSWORD || 'admin'
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

// SSH Helper Function
async function executeCommand(conn: Client, cmd: string, logCallback: (data: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('close', (code: number) => {
                resolve(output);
            }).on('data', (data: any) => {
                const str = data.toString();
                output += str;
                logCallback(str);
            }).stderr.on('data', (data: any) => {
                logCallback('ERROR: ' + data.toString());
            });
        });
    });
}

// Logic for SSH and Socket
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('scan-ont', async () => {
        socket.emit('log', '>> display ont autofind all');

        // Simulation for now (since I don't have real OLT connection)
        // In real app, we would use Client from ssh2
        setTimeout(() => {
            const mockOnts = [
                { interface: '0/1/1', sn: '48575453AABBCCDD', type: 'HG8245H' },
                { interface: '0/1/2', sn: '4857545311223344', type: 'HG8546M' }
            ];
            socket.emit('ont-found', mockOnts);
            socket.emit('log', 'SUCCESS: Found 2 new ONTs');
        }, 1500);
    });

    socket.on('approve-ont', async (data) => {
        socket.emit('log', `>> Starting Provisioning for ${data.sn}...`);

        const commands = [
            `interface gpon ${data.interface.split('/').slice(0, 2).join('/')}`,
            `ont add ${data.interface.split('/').pop()} sn-auth "${data.sn}" omci ont-lineprofile-id 10 ont-serviceprofile-id 10 desc "${data.customerName}"`,
            `quit`,
            `service-port vlan ${data.vlan} gpon ${data.interface} ont ${data.sn} gemport 1 multi-service user-vlan ${data.vlan} tag-transform add-vlan`
        ];

        for (const cmd of commands) {
            socket.emit('log', `>> ${cmd}`);
            await new Promise(r => setTimeout(r, 800)); // Simulate delay
        }

        socket.emit('log', `SUCCESS: ONT ${data.sn} approved and online!`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`🚀 Huawei ONT Manager running at http://localhost:${PORT}`);
});
