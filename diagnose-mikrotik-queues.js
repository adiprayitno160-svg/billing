#!/usr/bin/env node
/**
 * MikroTik Queue Validator Script
 * Diagnoses and fixes queue type issues
 */

const { RouterOSAPI } = require('routeros-api');

async function diagnoseAndFixQueueIssue() {
    console.log('=== MIKROTIK QUEUE DIAGNOSIS ===');
    
    // MikroTik connection config (adjust as needed)
    const config = {
        host: '192.168.5.1',
        port: 8728,
        username: 'adii',
        password: 'adi',
        use_tls: false
    };
    
    try {
        console.log('Connecting to MikroTik...');
        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });
        
        await api.connect();
        console.log('✅ Connected to MikroTik successfully');
        
        // 1. Check available queue types
        console.log('\n=== CHECKING AVAILABLE QUEUE TYPES ===');
        try {
            const queueTypes = await api.write('/queue/type/print');
            console.log('Available queue types:');
            queueTypes.forEach((qt, index) => {
                console.log(`${index + 1}. ${qt.name} (${qt.kind})`);
            });
        } catch (error) {
            console.log('❌ Failed to get queue types:', error.message);
        }
        
        // 2. Test queue creation with different types
        console.log('\n=== TESTING QUEUE CREATION ===');
        const testQueueBase = `TEST_QUEUE_FIX_${Date.now()}`;
        
        const queueTypesToTest = [
            'default',
            'ethernet', 
            'wireless',
            'pcq',
            'pcq-download-default',
            'pcq-upload-default'
        ];
        
        for (const queueType of queueTypesToTest) {
            try {
                console.log(`\nTesting queue type: ${queueType}`);
                const queueName = `${testQueueBase}_${queueType.replace(/[^a-zA-Z0-9]/g, '_')}`;
                
                const result = await api.write('/queue/tree/add', [
                    `name=${queueName}`,
                    'parent=global',
                    'max-limit=1M',
                    `queue=${queueType}`,
                    `comment=Test ${queueType}`
                ]);
                
                console.log(`✅ Queue type '${queueType}' works`);
                
                // Clean up
                await api.write('/queue/tree/remove', [`name=${queueName}`]);
                console.log(`🧹 Cleaned up test queue`);
                
            } catch (error) {
                console.log(`❌ Queue type '${queueType}' failed: ${error.message}`);
            }
        }
        
        // 3. Check existing queue trees for common patterns
        console.log('\n=== ANALYZING EXISTING QUEUES ===');
        try {
            const queueTrees = await api.write('/queue/tree/print');
            console.log(`Found ${queueTrees.length} existing queue trees`);
            
            // Show some examples
            const sampleQueues = queueTrees.slice(0, 5);
            sampleQueues.forEach((qt, index) => {
                console.log(`${index + 1}. ${qt.name} -> parent: ${qt.parent}, queue: ${qt.queue || 'default'}`);
            });
            
        } catch (error) {
            console.log('❌ Failed to analyze existing queues:', error.message);
        }
        
        api.close();
        console.log('\n=== DIAGNOSIS COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('\nTroubleshooting steps:');
        console.log('1. Check if MikroTik is reachable at 192.168.5.1:8728');
        console.log('2. Verify username/password are correct');
        console.log('3. Ensure API service is enabled on MikroTik');
        console.log('4. Check firewall rules allowing API connections');
    }
}

// Run the diagnosis
diagnoseAndFixQueueIssue().catch(console.error);