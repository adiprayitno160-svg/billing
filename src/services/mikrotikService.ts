import { RouterOSAPI } from 'routeros-api';
import { mikrotikPool } from './MikroTikConnectionPool';

export type MikroTikConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    use_tls: boolean;
};

export async function testMikrotikConnection(cfg: MikroTikConfig): Promise<{ connected: boolean, error?: string }> {
    try {
        console.log('=== TESTING MIKROTIK CONNECTION VIA POOL ===');
        const identity = await mikrotikPool.execute(cfg, '/system/identity/print', [], 'identity', 60000);
        console.log('Γ£à Connected to MikroTik successfully:', identity);
        return { connected: true };
    } catch (error: any) {
        console.error('Γ¥î Connection failed:', error instanceof Error ? error.message : String(error));
        return { connected: false, error: error?.message || 'Gagal terhubung' };
    }
}

export type MikroTikInfo = {
    identity?: string;
    version?: string;
    uptime?: string;
    cpuLoad?: string;
    freeMemory?: string;
    totalMemory?: string;
    'board-name'?: string;
    'cpu'?: string;
    'cpu-count'?: string;
    'free-hdd-space'?: string;
    'total-hdd-space'?: string;
    'architecture-name'?: string;
    'build-time'?: string;
};

export async function getMikrotikInfo(cfg: MikroTikConfig): Promise<MikroTikInfo> {
    try {
        const identity = await mikrotikPool.execute<any[]>(cfg, '/system/identity/print', [], 'identity', 60000);
        const resource = await mikrotikPool.execute<any[]>(cfg, '/system/resource/print', [], 'resource', 60000);

        const id = identity?.[0]?.['name'];
        const res = resource?.[0] || {};

        return {
            identity: id,
            version: res['version'],
            uptime: res['uptime'],
            cpuLoad: res['cpu-load'],
            freeMemory: res['free-memory'],
            totalMemory: res['total-memory'],
            'board-name': res['board-name'],
            'cpu': res['cpu'],
            'cpu-count': res['cpu-count'],
            'free-hdd-space': res['free-hdd-space'],
            'total-hdd-space': res['total-hdd-space'],
            'architecture-name': res['architecture-name'],
            'build-time': res['build-time']
        };
    } catch (error: any) {
        console.error(`[getMikrotikInfo] Error:`, error.message);
        return {};
    }
}

export type PppProfile = {
    '.id': string;
    name: string;
    'remote-address'?: string;
    'local-address'?: string;
    'dns-server'?: string;
    'session-timeout'?: string;
    'idle-timeout'?: string;
    'only-one'?: string;
    'change-tcp-mss'?: string;
    'use-compression'?: string;
    'use-encryption'?: string;
    'use-mpls'?: string;
    'use-upnp'?: string;
    comment?: string;
    'rate-limit'?: string;
    'rate-limit-rx'?: string;
    'rate-limit-tx'?: string;
    'burst-limit-rx'?: string;
    'burst-limit-tx'?: string;
    'burst-threshold-rx'?: string;
    'burst-threshold-tx'?: string;
    'burst-time-rx'?: string;
    'burst-time-tx'?: string;
};

export async function getPppProfiles(cfg: MikroTikConfig): Promise<PppProfile[]> {
    try {
        const rows = await mikrotikPool.execute<any[]>(cfg, '/ppp/profile/print', ['=detail='], 'ppp_profiles', 60000);
        return (rows || []).map((r: any) => {
            const rateLimit = r['rate-limit'] || '';
            let rx = '', tx = '', brx = '', btx = '', trx = '', ttx = '', tirx = '', titx = '';
            if (rateLimit) {
                const parts = rateLimit.split(' ');
                if (parts[0]) { const s = parts[0].split('/'); rx = s[0]; tx = s[1] || s[0]; }
                if (parts[1]) { const s = parts[1].split('/'); brx = s[0]; btx = s[1] || s[0]; }
                if (parts[2]) { const s = parts[2].split('/'); trx = s[0]; ttx = s[1] || s[0]; }
                if (parts[3]) { const s = parts[3].split('/'); tirx = s[0]; titx = s[1] || s[0]; }
            }
            return {
                '.id': r['.id'], name: r['name'], 'remote-address': r['remote-address'], 'local-address': r['local-address'],
                'dns-server': r['dns-server'], 'session-timeout': r['session-timeout'], 'idle-timeout': r['idle-timeout'],
                'only-one': r['only-one'], 'change-tcp-mss': r['change-tcp-mss'], 'use-compression': r['use-compression'],
                'use-encryption': r['use-encryption'], 'use-mpls': r['use-mpls'], 'use-upnp': r['use-upnp'],
                comment: r['comment'], 'rate-limit': rateLimit, 'rate-limit-rx': rx, 'rate-limit-tx': tx,
                'burst-limit-rx': brx, 'burst-limit-tx': btx, 'burst-threshold-rx': trx, 'burst-threshold-tx': ttx,
                'burst-time-rx': tirx, 'burst-time-tx': titx
            };
        });
    } catch (error: any) {
        console.error(`[getPppProfiles] Error:`, error.message);
        return [];
    }
}

export async function createPppProfile(cfg: MikroTikConfig, data: any): Promise<void> {
    try {
        const params: string[] = [];
        for (const [k, v] of Object.entries(data)) {
            if (k.includes('rx') || k.includes('tx')) continue;
            if (v !== undefined && v !== null && v !== '') params.push(`=${k}=${v}`);
        }
        if (data['rate-limit-rx']) {
            const rx = data['rate-limit-rx'], tx = data['rate-limit-tx'] || rx;
            let rl = `${rx}/${tx}`;
            if (data['burst-limit-rx']) {
                rl += ` ${data['burst-limit-rx']}/${data['burst-limit-tx'] || data['burst-limit-rx']}`;
                if (data['burst-threshold-rx']) rl += ` ${data['burst-threshold-rx']}/${data['burst-threshold-tx'] || data['burst-threshold-rx']}`;
                if (data['burst-time-rx']) rl += ` ${data['burst-time-rx']}/${data['burst-time-tx'] || data['burst-time-rx']}`;
            }
            params.push(`=rate-limit=${rl}`);
        }
        await mikrotikPool.execute(cfg, '/ppp/profile/add', params);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function updatePppProfile(cfg: MikroTikConfig, id: string, data: any): Promise<void> {
    try {
        const params: string[] = [`=.id=${id}`];
        for (const [k, v] of Object.entries(data)) {
            if (k.includes('rx') || k.includes('tx') || k === 'rate-limit') continue;
            if (v !== undefined && v !== null && v !== '') params.push(`=${k}=${v}`);
        }
        let rl = data['rate-limit'];
        if (!rl && data['rate-limit-rx']) {
            rl = `${data['rate-limit-rx']}/${data['rate-limit-tx'] || data['rate-limit-rx']}`;
            if (data['burst-limit-rx']) {
                rl += ` ${data['burst-limit-rx']}/${data['burst-limit-tx'] || data['burst-limit-rx']}`;
                if (data['burst-threshold-rx']) rl += ` ${data['burst-threshold-rx']}/${data['burst-threshold-tx'] || data['burst-threshold-rx']}`;
                if (data['burst-time-rx']) rl += ` ${data['burst-time-rx']}/${data['burst-time-tx'] || data['burst-time-rx']}`;
            }
        }
        if (rl) params.push(`=rate-limit=${rl}`);
        await mikrotikPool.execute(cfg, '/ppp/profile/set', params);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function findPppProfileIdByName(cfg: MikroTikConfig, name: string): Promise<string | null> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/ppp/profile/print', [`?name=${name}`], `profile_id:${name}`, 3600000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}

export async function deletePppProfile(cfg: MikroTikConfig, id: string): Promise<void> {
    try {
        await mikrotikPool.execute(cfg, '/ppp/profile/remove', [`.id=${id}`]);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export type InterfaceInfo = {
    '.id': string; name: string; type: string; mtu: string; actualMtu: string; l2mtu: string;
    macAddress: string; lastLinkUpTime: string; linkDowns: string; rxByte: string; txByte: string;
    rxPacket: string; txPacket: string; rxDrop: string; txDrop: string; txQueueDrop: string;
    rxError: string; txError: string; disabled: string; running: string; comment?: string;
};

export async function getInterfaces(cfg: MikroTikConfig): Promise<InterfaceInfo[]> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/interface/print', [], 'interfaces', 30000);
        return (res || []).map(r => ({
            '.id': r['.id'], name: r['name'], type: r['type'], mtu: r['mtu'], actualMtu: r['actual-mtu'], l2mtu: r['l2mtu'],
            macAddress: r['mac-address'], lastLinkUpTime: r['last-link-up-time'], linkDowns: r['link-downs'],
            rxByte: r['rx-byte'], txByte: r['tx-byte'], rxPacket: r['rx-packet'], txPacket: r['tx-packet'],
            rxDrop: r['rx-drop'], txDrop: r['tx-drop'], txQueueDrop: r['tx-queue-drop'], rxError: r['rx-error'],
            txError: r['tx-error'], disabled: r['disabled'], running: r['running'], comment: r['comment']
        }));
    } catch { return []; }
}

export async function getInterfaceTraffic(cfg: MikroTikConfig, interfaceName: string): Promise<any> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/interface/print', [`?name=${interfaceName}`], `traffic:${interfaceName}`, 5000);
        const iface = res?.[0] || {};
        return {
            rxByte: parseInt(iface['rx-byte'] || '0'), txByte: parseInt(iface['tx-byte'] || '0'),
            rxPacket: parseInt(iface['rx-packet'] || '0'), txPacket: parseInt(iface['tx-packet'] || '0'),
            rxDrop: parseInt(iface['rx-drop'] || '0'), txDrop: parseInt(iface['tx-drop'] || '0'),
            rxError: parseInt(iface['rx-error'] || '0'), txError: parseInt(iface['tx-error'] || '0')
        };
    } catch { return { rxByte: 0, txByte: 0, rxPacket: 0, txPacket: 0, rxDrop: 0, txDrop: 0, rxError: 0, txError: 0 }; }
}

export type PppoeActiveConnection = {
    '.id': string; name: string; service: string; callerId?: string; address: string; uptime: string; 'caller-id'?: string;
};

export async function getPppoeActiveConnections(cfg: MikroTikConfig): Promise<PppoeActiveConnection[]> {
    try {
        const res = await mikrotikPool.execute<PppoeActiveConnection[]>(cfg, '/ppp/active/print', [], 'active_connections', 60000);
        return Array.isArray(res) ? res : [];
    } catch { return []; }
}

export type PppoeSecret = {
    '.id': string; name: string; password: string; service: string; profile: string; 'remote-address'?: string; comment?: string; disabled: string;
};

export async function getPppoeSecrets(cfg: MikroTikConfig): Promise<PppoeSecret[]> {
    try {
        const res = await mikrotikPool.execute<PppoeSecret[]>(cfg, '/ppp/secret/print', [], 'pppoe_secrets', 60000);
        return Array.isArray(res) ? res : [];
    } catch (e) {
        console.error('[MikroTikService] Failed to get secrets:', e);
        return [];
    }
}

export async function findPppoeSecretIdByName(cfg: MikroTikConfig, name: string): Promise<string | null> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/ppp/secret/print', [`?name=${name}`], `secret_id:${name}`, 3600000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}

export async function createPppoeSecret(cfg: MikroTikConfig, data: any): Promise<void> {
    try {
        const params: string[] = [];
        // Default service to pppoe if not provided
        const secretData = { service: 'pppoe', ...data };
        for (const [k, v] of Object.entries(secretData)) {
            if (v !== undefined && v !== null && v !== '') params.push(`=${k}=${v}`);
        }
        await mikrotikPool.execute(cfg, '/ppp/secret/add', params);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function updatePppoeSecret(cfg: MikroTikConfig, username: string, data: any): Promise<void> {
    try {
        const id = await findPppoeSecretIdByName(cfg, username);
        if (!id) throw new Error('Secret not found');
        const params: string[] = [`=.id=${id}`];
        // Ensure service is pppoe if being updated (optional but keeps it consistent)
        const secretData = { service: 'pppoe', ...data };
        for (const [k, v] of Object.entries(secretData)) {
            if (v !== undefined && v !== null && v !== '') params.push(`=${k}=${v}`);
        }
        await mikrotikPool.execute(cfg, '/ppp/secret/set', params);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function deletePppoeSecret(cfg: MikroTikConfig, username: string): Promise<void> {
    try {
        const id = await findPppoeSecretIdByName(cfg, username);
        if (id) {
            await mikrotikPool.execute(cfg, '/ppp/secret/remove', [`=.id=${id}`]);
            mikrotikPool.clearCache();
        }
    } catch (err: any) { throw err; }
}

export async function getSystemResources(cfg: MikroTikConfig): Promise<any> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/system/resource/print', [], 'resource', 60000);
        return res?.[0] || {};
    } catch { return {}; }
}

export async function getPppoeServerStats(cfg: MikroTikConfig): Promise<any[]> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/ppp/active/print', [], 'active_connections', 60000);
        return Array.isArray(res) ? res : [];
    } catch { return []; }
}
export async function getSimpleQueues(cfg: MikroTikConfig): Promise<any[]> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/queue/simple/print', [], 'simple_queues', 30000);
        return Array.isArray(res) ? res : [];
    } catch { return []; }
}

export async function createSimpleQueue(cfg: MikroTikConfig, data: any): Promise<void> {
    try {
        const params: string[] = [];
        const mapping: any = {
            name: 'name',
            target: 'target',
            parent: 'parent',
            maxLimit: 'max-limit',
            limitAt: 'limit-at',
            priority: 'priority',
            burstLimit: 'burst-limit',
            burstThreshold: 'burst-threshold',
            burstTime: 'burst-time',
            comment: 'comment',
            queue: 'queue' // Add queue type support
        };
        for (const [k, v] of Object.entries(data)) {
            const mikrotikKey = mapping[k] || k;
            if (v !== undefined && v !== null && v !== '') params.push(`=${mikrotikKey}=${v}`);
        }
        await mikrotikPool.execute(cfg, '/queue/simple/add', params);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function updateSimpleQueue(cfg: MikroTikConfig, id: string, data: any): Promise<void> {
    try {
        const params: string[] = [`=.id=${id}`];
        const mapping: any = {
            name: 'name',
            target: 'target',
            parent: 'parent',
            maxLimit: 'max-limit',
            limitAt: 'limit-at',
            priority: 'priority',
            burstLimit: 'burst-limit',
            burstThreshold: 'burst-threshold',
            burstTime: 'burst-time',
            comment: 'comment',
            queue: 'queue'
        };
        for (const [k, v] of Object.entries(data)) {
            const mikrotikKey = mapping[k] || k;
            if (v !== undefined && v !== null && v !== '') params.push(`=${mikrotikKey}=${v}`);
        }
        await mikrotikPool.execute(cfg, '/queue/simple/set', params);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function deleteSimpleQueue(cfg: MikroTikConfig, id: string): Promise<void> {
    try {
        await mikrotikPool.execute(cfg, '/queue/simple/remove', [`=.id=${id}`]);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function findSimpleQueueIdByName(cfg: MikroTikConfig, name: string): Promise<string | null> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/queue/simple/print', [`?name=${name}`], `sq_name:${name}`, 5000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}

export async function getQueueTrees(cfg: MikroTikConfig): Promise<any[]> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/queue/tree/print', [], 'queue_trees', 30000);
        return Array.isArray(res) ? res : [];
    } catch { return []; }
}


export async function createQueueTree(cfg: MikroTikConfig, data: any): Promise<void> {
    try {
        // Import and use queue validation
        const { preValidateQueueCreation } = await import('../utils/queueValidationHelper');

        // Validate queue data before creation
        const validation = await preValidateQueueCreation(data);
        if (!validation.valid) {
            throw new Error(`Queue validation failed: ${validation.errors.join(', ')}`);
        }

        const validatedData = validation.sanitizedData;

        const params: string[] = [];
        const mapping: any = {
            name: 'name',
            parent: 'parent',
            packetMarks: 'packet-mark',
            maxLimit: 'max-limit',
            limitAt: 'limit-at',
            queue: 'queue',
            priority: 'priority',
            burstLimit: 'burst-limit',
            burstThreshold: 'burst-threshold',
            burstTime: 'burst-time',
            comment: 'comment'
        };

        for (const [k, v] of Object.entries(validatedData)) {
            const mikrotikKey = mapping[k] || k;
            if (v !== undefined && v !== null && v !== '') params.push(`=${mikrotikKey}=${v}`);
        }

        console.log('[createQueueTree] Creating queue with params:', params);
        await mikrotikPool.execute(cfg, '/queue/tree/add', params);
        mikrotikPool.clearCache();

    } catch (err: any) {
        console.error('[createQueueTree] Failed to create queue:', err.message);
        throw err;
    }
}

export async function updateQueueTree(cfg: MikroTikConfig, id: string, data: any): Promise<void> {
    try {
        // Import and use queue validation
        const { preValidateQueueCreation } = await import('../utils/queueValidationHelper');

        // Validate and sanitize data (Using preValidate helper ensures consistent sanitization for limits/bursts)
        const validation = await preValidateQueueCreation(data);
        const validatedData = validation.sanitizedData;

        const params: string[] = [`=.id=${id}`];
        const mapping: any = {
            name: 'name',
            parent: 'parent',
            packetMarks: 'packet-mark',
            maxLimit: 'max-limit',
            limitAt: 'limit-at',
            queue: 'queue',
            priority: 'priority',
            burstLimit: 'burst-limit',
            burstThreshold: 'burst-threshold',
            burstTime: 'burst-time',
            comment: 'comment'
        };
        for (const [k, v] of Object.entries(validatedData)) {
            const mikrotikKey = mapping[k] || k;
            if (v !== undefined && v !== null && v !== '') params.push(`=${mikrotikKey}=${v}`);
        }
        console.log('[updateQueueTree] Updating queue with params:', params);
        await mikrotikPool.execute(cfg, '/queue/tree/set', params);
        mikrotikPool.clearCache();
    } catch (err: any) {
        console.error('[updateQueueTree] Failed to update queue:', err.message);
        throw err;
    }
}

export async function deleteQueueTree(cfg: MikroTikConfig, id: string): Promise<void> {
    try {
        await mikrotikPool.execute(cfg, '/queue/tree/remove', [`=.id=${id}`]);
        mikrotikPool.clearCache();
    } catch (err: any) { throw err; }
}

export async function addMangleRulesForClient(cfg: MikroTikConfig, data: { peerIp: string, downloadMark: string, uploadMark: string }): Promise<void> {
    try {
        // Clear old ones first to avoid duplicates
        await removeMangleRulesForClient(cfg, data);

        // Download mangle
        await mikrotikPool.execute(cfg, '/ip/firewall/mangle/add', [
            '=chain=forward',
            `=dst-address=${data.peerIp}`,
            `=action=mark-packet`,
            `=new-packet-mark=${data.downloadMark}`,
            '=passthrough=no',
            `=comment=Download for ${data.peerIp}`
        ]);

        // Upload mangle
        await mikrotikPool.execute(cfg, '/ip/firewall/mangle/add', [
            '=chain=forward',
            `=src-address=${data.peerIp}`,
            `=action=mark-packet`,
            `=new-packet-mark=${data.uploadMark}`,
            '=passthrough=no',
            `=comment=Upload for ${data.peerIp}`
        ]);
    } catch (err: any) { throw err; }
}

export async function removeMangleRulesForClient(cfg: MikroTikConfig, data: { peerIp: string, downloadMark: string, uploadMark: string }): Promise<void> {
    try {
        // 1. Find by comment (original logic)
        const rulesByCommentDown = await mikrotikPool.execute<any[]>(cfg, '/ip/firewall/mangle/print', [
            `?comment=Download for ${data.peerIp}`
        ], `mangle_down_c:${data.peerIp}`, 1000);

        const rulesByCommentUp = await mikrotikPool.execute<any[]>(cfg, '/ip/firewall/mangle/print', [
            `?comment=Upload for ${data.peerIp}`
        ], `mangle_up_c:${data.peerIp}`, 1000);

        // 2. Find by IP Address (more robust)
        const rulesByIpDown = await mikrotikPool.execute<any[]>(cfg, '/ip/firewall/mangle/print', [
            `?dst-address=${data.peerIp}`
        ], `mangle_down_ip:${data.peerIp}`, 1000);

        const rulesByIpUp = await mikrotikPool.execute<any[]>(cfg, '/ip/firewall/mangle/print', [
            `?src-address=${data.peerIp}`
        ], `mangle_up_ip:${data.peerIp}`, 1000);

        // 3. Find by packet mark (if it matches the IP or the expected marks)
        // This is for cases where the mark itself IS the IP address
        const rulesByMarkDown = await mikrotikPool.execute<any[]>(cfg, '/ip/firewall/mangle/print', [
            `?new-packet-mark=${data.peerIp}`
        ], `mangle_down_m:${data.peerIp}`, 1000);

        // Combine all found rules
        const allRules = [
            ...(rulesByCommentDown || []),
            ...(rulesByCommentUp || []),
            ...(rulesByIpDown || []),
            ...(rulesByIpUp || []),
            ...(rulesByMarkDown || [])
        ];

        // Unique by .id
        const uniqueIds = Array.from(new Set(allRules.map(r => r['.id'])));

        if (uniqueIds.length > 0) {
            console.log(`[MikroTik] Cleaning up ${uniqueIds.length} old mangle rules for ${data.peerIp}`);
            for (const id of uniqueIds) {
                await mikrotikPool.execute(cfg, '/ip/firewall/mangle/remove', [`=.id=${id}`]);
            }
        }
    } catch (err) {
        console.warn(`[MikroTik] Warning while removing mangle rules for ${data.peerIp}:`, err);
    }
}

export async function addIpAddress(cfg: MikroTikConfig, data: { interface: string, address: string, comment: string }): Promise<void> {
    try {
        await mikrotikPool.execute(cfg, '/ip/address/add', [
            `=interface=${data.interface}`,
            `=address=${data.address}`,
            `=comment=${data.comment}`
        ]);
    } catch (err: any) { throw err; }
}

export async function removeIpAddress(cfg: MikroTikConfig, address: string): Promise<void> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/ip/address/print', [`?address=${address}`], `ip_addr:${address}`, 1000);
        if (res && res.length > 0) {
            for (const r of res) {
                await mikrotikPool.execute(cfg, '/ip/address/remove', [`=.id=${r['.id']}`]);
            }
        }
    } catch { /* ignore */ }
}

export async function deleteClientQueuesByClientName(cfg: MikroTikConfig, clientName: string): Promise<void> {
    try {
        const trees = await getQueueTrees(cfg);
        const toDelete = trees.filter(t => t.name.includes(clientName));
        for (const t of toDelete) {
            await deleteQueueTree(cfg, t['.id']);
        }
    } catch { /* ignore */ }
}

export async function createClientQueues(cfg: MikroTikConfig, data: any): Promise<void> {
    // This seems to be a composite function, let's implement it based on typical usage
    // Usually it calls createQueueTree twice (one for upload, one for download)
    try {
        await createQueueTree(cfg, data.download);
        await createQueueTree(cfg, data.upload);
    } catch (err: any) { throw err; }
}

export async function getSystemHealth(cfg: MikroTikConfig): Promise<any[]> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/system/health/print', [], 'health', 60000);
        return Array.isArray(res) ? res : [];
    } catch { return []; }
}


export async function findIpAddressId(cfg: MikroTikConfig, address: string): Promise<string | null> {
    try {
        // Search by address exactly
        const res = await mikrotikPool.execute<any[]>(cfg, '/ip/address/print', [`?address=${address}`], `ip_addr_check:${address}`, 1000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}

export async function updateIpAddress(cfg: MikroTikConfig, id: string, data: { comment?: string, interface?: string }): Promise<void> {
    try {
        const params = [`=.id=${id}`];
        if (data.comment) params.push(`=comment=${data.comment}`);
        if (data.interface) params.push(`=interface=${data.interface}`);

        await mikrotikPool.execute(cfg, '/ip/address/set', params);
    } catch { /* ignore */ }
}

export async function findQueueTreeIdByName(cfg: MikroTikConfig, name: string): Promise<string | null> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/queue/tree/print', [`?name=${name}`], `qt_name:${name}`, 5000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}

export async function findMangleIdByComment(cfg: MikroTikConfig, comment: string): Promise<string | null> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/ip/firewall/mangle/print', [`?comment=${comment}`], `mangle_chk:${comment}`, 1000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}

export async function findQueueTreeIdByPacketMark(cfg: MikroTikConfig, packetMark: string): Promise<string | null> {
    try {
        const res = await mikrotikPool.execute<any[]>(cfg, '/queue/tree/print', [`?packet-mark=${packetMark}`], `qt_mark:${packetMark}`, 5000);
        return res?.[0]?.['.id'] || null;
    } catch { return null; }
}
