import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';
import * as path from 'path';

const ssh = new NodeSSH();

async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        console.log('--- CONNECTED TO LIVE SERVER ---');

        const filesToPatch = [
            { 
                path: '/var/www/billing/src/controllers/billing/paymentController.ts',
                import: "import { AccountingService } from '../../services/billing/accountingService';",
                injection: `
            // SYNC TO ACCOUNTING (Journal)
            if (firstPaymentId) {
                try {
                    await AccountingService.generatePaymentJournalEntry(firstPaymentId);
                    console.log(\`[Accounting] Journal entry created for payment ID \${firstPaymentId}\`);
                } catch (accErr) {
                    console.error('[Accounting] Failed to generate journal entry:', accErr);
                }
            }`
            },
            {
                path: '/var/www/billing/src/controllers/kasirController.ts',
                import: "import { AccountingService } from '../services/billing/accountingService';",
                injection: `
            // SYNC TO ACCOUNTING (Journal)
            if (paymentId) {
                try {
                    await AccountingService.generatePaymentJournalEntry(paymentId);
                    console.log(\`[Accounting] Journal entry created for payment ID \${paymentId}\`);
                } catch (accErr) {
                    console.error('[Accounting] Failed to generate journal entry:', accErr);
                }
            }`
            }
        ];

        for (const file of filesToPatch) {
            console.log(`Processing: ${file.path}`);
            const res = await ssh.execCommand(`cat ${file.path}`);
            let content = res.stdout;

            if (!content) {
                console.error(`Could not read ${file.path}`);
                continue;
            }

            // 1. Add import if missing
            if (!content.includes('AccountingService') && !content.includes('accountingService')) {
                content = `${file.import}\n` + content;
            }

            // 2. Inject accounting sync after commit
            const commitMarker = 'await conn.commit();';
            if (content.includes(commitMarker)) {
                // Check if already injected
                if (content.includes('AccountingService.generatePaymentJournalEntry')) {
                    console.log('Skipping (Already Injected)');
                } else {
                    content = content.replace(commitMarker, commitMarker + file.injection);
                    
                    const tmpPath = path.join(process.cwd(), 'tmp_file_patch.ts');
                    fs.writeFileSync(tmpPath, content);
                    await ssh.putFile(tmpPath, file.path);
                    console.log(`✅ Successfully patched ${file.path}`);
                }
            } else {
                console.error(`❌ Marker "${commitMarker}" NOT FOUND in ${file.path}`);
            }
        }

        // --- REBUILD ON LIVE SERVER ---
        console.log('--- REBUILDING APP ON LIVE SERVER ---');
        const buildRes = await ssh.execCommand('npm run build', { cwd: '/var/www/billing' });
        console.log(buildRes.stdout || buildRes.stderr);

        // --- RESTART PM2 ---
        console.log('--- RESTARTING PM2 ---');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ All services restarted');

        ssh.dispose();
    } catch (err: any) {
        console.error('CRITICAL ERROR:', err.message);
    }
}

run();
