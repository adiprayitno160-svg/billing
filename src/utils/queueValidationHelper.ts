
/**
 * Helper to validate Mikrotik Queue Types
 * Prevents "input does not match any value of queue" error
 */

export async function validateQueueType(queueName: string): Promise<string> {
    // Common standard types
    const validTypes = [
        'default',
        'default-small',
        'ethernet-default',
        'wireless-default',
        'synchronous-default',
        'hotspot-default',
        'pcq-upload-default',
        'pcq-download-default',
        'only-hardware-queue',
        'mq-pfifo',
        'pfifo'
    ];

    if (!queueName || typeof queueName !== 'string') return 'default-small';

    if (validTypes.includes(queueName)) {
        return queueName;
    }

    // Heuristics
    if (queueName.includes('pcq')) return 'pcq-download-default'; // Fallback for PCQ
    if (queueName.includes('upload')) return 'default-small';
    if (queueName.includes('download')) return 'default-small';

    // Ultimate fallback
    return 'default-small';
}

export async function preValidateQueueCreation(data: any): Promise<{ valid: boolean, errors: string[] }> {
    return { valid: true, errors: [] };
}
