import { databasePool } from './db/pool';
import { WhatsAppSessionService } from './services/whatsapp/WhatsAppSessionService';
import { WhatsAppHandler } from './services/whatsapp/WhatsAppHandler';
import { WhatsAppService } from './services/whatsapp/WhatsAppService';

async function testBotEditFlow() {
    console.log('🚀 Starting Bot Edit Flow Test...');

    const testPhone = '6281234567891';
    const testJid = testPhone + '@s.whatsapp.net';

    // Mock WhatsAppService
    const mockService: any = {
        sendMessage: async (to: string, text: string) => {
            console.log(`[Mock WA] Sending to ${to}: ${text.substring(0, 50)}...`);
            return { success: true };
        },
        getSocket: () => ({})
    };

    try {
        // 1. Setup customer and session
        console.log('Step 1: Setting up test customer and session...');
        const [customerResult]: any = await databasePool.execute(
            'INSERT INTO customers (name, phone, customer_code, connection_type, status, address) VALUES (?, ?, ?, ?, ?, ?)',
            ['Pelanggan Salah', testPhone, 'TEST-EDIT', 'pppoe', 'active', 'Alamat Salah']
        );
        const customerId = customerResult.insertId;

        await WhatsAppSessionService.setSession(testPhone, {
            step: 'waiting_welcome_confirmation',
            data: { customerId, customerName: 'Pelanggan Salah', customerAddress: 'Alamat Salah' }
        });

        // 2. Simulate "SALAH" response
        console.log('Step 2: Simulating "SALAH" response...');
        await WhatsAppHandler.handleIncomingMessage({
            key: { remoteJid: testJid },
            message: { conversation: 'SALAH' },
            messageTimestamp: Date.now() / 1000
        } as any, mockService);

        // Verify session updated to waiting_name_correction
        let session = await WhatsAppSessionService.getSession(testPhone);
        if (session && session.step === 'waiting_name_correction') {
            console.log('✅ Success: Bot moved to waiting_name_correction.');
        } else {
            throw new Error(`❌ Failure: Unexpected session step: ${session?.step}`);
        }

        // 3. Simulate sending new name
        console.log('Step 3: Sending new name "Pelanggan Benar"...');
        await WhatsAppHandler.handleIncomingMessage({
            key: { remoteJid: testJid },
            message: { conversation: 'Pelanggan Benar' },
            messageTimestamp: Date.now() / 1000
        } as any, mockService);

        // Verify session updated to waiting_address_correction
        session = await WhatsAppSessionService.getSession(testPhone);
        if (session && session.step === 'waiting_address_correction' && session.data.newName === 'Pelanggan Benar') {
            console.log('✅ Success: Bot moved to waiting_address_correction with name saved.');
        } else {
            throw new Error(`❌ Failure: Unexpected session step or data: ${session?.step}`);
        }

        // 4. Simulate sending new address
        console.log('Step 4: Sending new address "Alamat Benar Sekali"...');
        await WhatsAppHandler.handleIncomingMessage({
            key: { remoteJid: testJid },
            message: { conversation: 'Alamat Benar Sekali' },
            messageTimestamp: Date.now() / 1000
        } as any, mockService);

        // 5. Verify Database Update
        const [rows]: any = await databasePool.execute('SELECT name, address FROM customers WHERE id = ?', [customerId]);
        const updatedCustomer = rows[0];
        if (updatedCustomer.name === 'Pelanggan Benar' && updatedCustomer.address === 'Alamat Benar Sekali') {
            console.log('✅ Success: Database updated with corrected data!');
        } else {
            throw new Error(`❌ Failure: Data not updated in DB correctly. Got: ${JSON.stringify(updatedCustomer)}`);
        }

        // Verify session cleared
        session = await WhatsAppSessionService.getSession(testPhone);
        if (!session) {
            console.log('✅ Success: Session cleared after completion.');
        } else {
            throw new Error('❌ Failure: Session not cleared.');
        }

        // Clean up
        await databasePool.execute('DELETE FROM customers WHERE id = ?', [customerId]);

        console.log('✨ ALL BOT EDIT TESTS PASSED!');
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    } finally {
        process.exit(0);
    }
}

testBotEditFlow();
