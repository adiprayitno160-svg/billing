import { RouterOSAPI } from 'routeros-api';

async function diagnoseQueueTypes() {
    try {
        console.log('=== DIAGNOSING MIKROTIK QUEUE TYPES ===');
        
        // Connect to MikroTik
        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        // 1. Check available queue types
        console.log('\n=== AVAILABLE QUEUE TYPES ===');
        try {
            const queueTypes = await api.write('/queue/type/print');
            console.log('Queue types found:', queueTypes.length);
            queueTypes.forEach((qt: any, index: number) => {
                console.log(`${index + 1}. Name: ${qt.name}, Kind: ${qt.kind}`);
            });
        } catch (error: any) {
            console.log('❌ Failed to get queue types:', error.message);
        }

        // 2. Check existing queue trees
        console.log('\n=== EXISTING QUEUE TREES ===');
        try {
            const queueTrees = await api.write('/queue/tree/print');
            console.log('Queue trees found:', queueTrees.length);
            queueTrees.slice(0, 10).forEach((qt: any, index: number) => {
                console.log(`${index + 1}. Name: ${qt.name}, Parent: ${qt.parent}, Queue: ${qt.queue}`);
            });
            if (queueTrees.length > 10) {
                console.log(`... and ${queueTrees.length - 10} more`);
            }
        } catch (error: any) {
            console.log('❌ Failed to get queue trees:', error.message);
        }

        // 3. Check existing simple queues
        console.log('\n=== EXISTING SIMPLE QUEUES ===');
        try {
            const simpleQueues = await api.write('/queue/simple/print');
            console.log('Simple queues found:', simpleQueues.length);
            simpleQueues.slice(0, 10).forEach((sq: any, index: number) => {
                console.log(`${index + 1}. Name: ${sq.name}, Target: ${sq.target}, Queue: ${sq.queue}`);
            });
            if (simpleQueues.length > 10) {
                console.log(`... and ${simpleQueues.length - 10} more`);
            }
        } catch (error: any) {
            console.log('❌ Failed to get simple queues:', error.message);
        }

        // 4. Test creating a queue with different queue types
        console.log('\n=== TESTING QUEUE CREATION ===');
        
        const testQueueName = `TEST_QUEUE_TYPES_${Date.now()}`;
        const queueTypesToTest = ['default', 'pcq-download-default', 'pcq-upload-default', 'ethernet'];
        
        for (const queueType of queueTypesToTest) {
            try {
                console.log(`\nTesting queue type: ${queueType}`);
                const result = await api.write('/queue/tree/add', [
                    `name=${testQueueName}_${queueType}`,
                    'parent=global',
                    'max-limit=1M',
                    `queue=${queueType}`,
                    `comment=Test ${queueType}`
                ]);
                console.log(`✅ Queue type '${queueType}' works:`, result);
                
                // Clean up
                await api.write('/queue/tree/remove', [`name=${testQueueName}_${queueType}`]);
                console.log(`🧹 Cleaned up test queue for ${queueType}`);
                
            } catch (error: any) {
                console.log(`❌ Queue type '${queueType}' failed: ${error.message}`);
            }
        }

        // 5. Check what parent queues exist
        console.log('\n=== AVAILABLE PARENT QUEUES ===');
        try {
            const queueTrees = await api.write('/queue/tree/print');
            const parents = new Set(queueTrees.map((qt: any) => qt.parent).filter(Boolean));
            console.log('Available parent queues:');
            parents.forEach((parent: string) => {
                console.log(`- ${parent}`);
            });
        } catch (error: any) {
            console.log('❌ Failed to get parent queues:', error.message);
        }

        api.close();
        console.log('\n=== DIAGNOSIS COMPLETE ===');

    } catch (error: any) {
        console.error('❌ Diagnosis failed:', error.message);
    }
}

diagnoseQueueTypes();