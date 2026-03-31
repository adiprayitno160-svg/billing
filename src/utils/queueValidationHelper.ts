
/**
 * Helper to validate Mikrotik Queue Types
 * Prevents "input does not match any value of queue" error
 */


export const validTypes = [
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

export async function validateQueueType(queueName: string): Promise<string> {
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

export function sanitizeLimit(value: any): string | undefined {
    if (!value) return undefined;
    const s = String(value).trim();
    if (s === '' || s === '0') return undefined; // Treat '0' as undefined for limits usually, or maybe '0' is valid? '0' means unlimited in some contexts but usually handled elsewhere. MikroTik '0' is not valid limit string except unlimited logic? No, let's keep it safe.
    // However, rate-limit usually expects '1M' etc.
    // Remove spaces
    return s.replace(/\s/g, '');
}

export function sanitizeTime(value: any): string | undefined {
    if (!value) return undefined;
    let s = String(value).trim();
    if (s === '') return undefined;
    // If number only, add 's'
    if (/^\d+$/.test(s)) {
        return s + 's';
    }
    return s;
}

export async function preValidateQueueCreation(data: any): Promise<{ valid: boolean, errors: string[], sanitizedData: any }> {
    const sanitizedData = { ...data };

    // Auto-fix queue type if present in creation data
    if (sanitizedData.queue) {
        sanitizedData.queue = await validateQueueType(sanitizedData.queue);
    }

    // Sanitize Limits and Bursts
    if (sanitizedData.maxLimit) sanitizedData.maxLimit = sanitizeLimit(sanitizedData.maxLimit);
    if (sanitizedData.limitAt) sanitizedData.limitAt = sanitizeLimit(sanitizedData.limitAt);

    // Burst Validation:
    // If burstLimit is present, verify we have what we need.
    if (sanitizedData.burstLimit) {
        sanitizedData.burstLimit = sanitizeLimit(sanitizedData.burstLimit);

        // Handle related fields
        if (sanitizedData.burstThreshold) sanitizedData.burstThreshold = sanitizeLimit(sanitizedData.burstThreshold);
        if (sanitizedData.burstTime) sanitizedData.burstTime = sanitizeTime(sanitizedData.burstTime);

        // Sanity check: if burstLimit is set but invalid, unset it?
        // Let's rely on sanitized value.
    } else {
        // If no burst limit, remove other burst params to avoid partial config errors
        delete sanitizedData.burstThreshold;
        delete sanitizedData.burstTime;
    }

    return { valid: true, errors: [], sanitizedData };
}

export async function getAvailableQueueTypes(): Promise<string[]> {
    return validTypes;
}

