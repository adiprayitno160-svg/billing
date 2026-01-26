"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testMikrotikConnection = testMikrotikConnection;
exports.getMikrotikInfo = getMikrotikInfo;
exports.getPppProfiles = getPppProfiles;
exports.createPppProfile = createPppProfile;
exports.updatePppProfile = updatePppProfile;
exports.findPppProfileIdByName = findPppProfileIdByName;
exports.deletePppProfile = deletePppProfile;
exports.getInterfaces = getInterfaces;
exports.getInterfaceTraffic = getInterfaceTraffic;
exports.getPppoeActiveConnections = getPppoeActiveConnections;
exports.getPppoeSecrets = getPppoeSecrets;
exports.findPppoeSecretIdByName = findPppoeSecretIdByName;
exports.createPppoeSecret = createPppoeSecret;
exports.updatePppoeSecret = updatePppoeSecret;
exports.deletePppoeSecret = deletePppoeSecret;
exports.getSystemResources = getSystemResources;
exports.getPppoeServerStats = getPppoeServerStats;
exports.getSimpleQueues = getSimpleQueues;
exports.createSimpleQueue = createSimpleQueue;
exports.updateSimpleQueue = updateSimpleQueue;
exports.deleteSimpleQueue = deleteSimpleQueue;
exports.findSimpleQueueIdByName = findSimpleQueueIdByName;
exports.getQueueTrees = getQueueTrees;
exports.createQueueTree = createQueueTree;
exports.updateQueueTree = updateQueueTree;
exports.deleteQueueTree = deleteQueueTree;
exports.addMangleRulesForClient = addMangleRulesForClient;
exports.removeMangleRulesForClient = removeMangleRulesForClient;
exports.addIpAddress = addIpAddress;
exports.removeIpAddress = removeIpAddress;
exports.deleteClientQueuesByClientName = deleteClientQueuesByClientName;
exports.createClientQueues = createClientQueues;
exports.getSystemHealth = getSystemHealth;
exports.findIpAddressId = findIpAddressId;
exports.updateIpAddress = updateIpAddress;
exports.findQueueTreeIdByName = findQueueTreeIdByName;
exports.findMangleIdByComment = findMangleIdByComment;
exports.findQueueTreeIdByPacketMark = findQueueTreeIdByPacketMark;
const MikroTikConnectionPool_1 = require("./MikroTikConnectionPool");
async function testMikrotikConnection(cfg) {
    try {
        console.log('=== TESTING MIKROTIK CONNECTION VIA POOL ===');
        const identity = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/system/identity/print', [], 'identity', 60000);
        console.log('Γ£à Connected to MikroTik successfully:', identity);
        return { connected: true };
    }
    catch (error) {
        console.error('Γ¥î Connection failed:', error instanceof Error ? error.message : String(error));
        return { connected: false, error: error?.message || 'Gagal terhubung' };
    }
}
async function getMikrotikInfo(cfg) {
    try {
        const identity = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/system/identity/print', [], 'identity', 60000);
        const resource = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/system/resource/print', [], 'resource', 60000);
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
    }
    catch (error) {
        console.error(`[getMikrotikInfo] Error:`, error.message);
        return {};
    }
}
async function getPppProfiles(cfg) {
    try {
        const rows = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/profile/print', ['=detail='], 'ppp_profiles', 60000);
        return (rows || []).map((r) => {
            const rateLimit = r['rate-limit'] || '';
            let rx = '', tx = '', brx = '', btx = '', trx = '', ttx = '', tirx = '', titx = '';
            if (rateLimit) {
                const parts = rateLimit.split(' ');
                if (parts[0]) {
                    const s = parts[0].split('/');
                    rx = s[0];
                    tx = s[1] || s[0];
                }
                if (parts[1]) {
                    const s = parts[1].split('/');
                    brx = s[0];
                    btx = s[1] || s[0];
                }
                if (parts[2]) {
                    const s = parts[2].split('/');
                    trx = s[0];
                    ttx = s[1] || s[0];
                }
                if (parts[3]) {
                    const s = parts[3].split('/');
                    tirx = s[0];
                    titx = s[1] || s[0];
                }
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
    }
    catch (error) {
        console.error(`[getPppProfiles] Error:`, error.message);
        return [];
    }
}
async function createPppProfile(cfg, data) {
    try {
        const params = [];
        for (const [k, v] of Object.entries(data)) {
            if (k.includes('rx') || k.includes('tx') || k === 'priority')
                continue;
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${k}=${v}`);
        }
        const rl = buildRateLimitString(data);
        if (rl)
            params.push(`=rate-limit=${rl}`);
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/profile/add', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function updatePppProfile(cfg, id, data) {
    try {
        const params = [`=.id=${id}`];
        for (const [k, v] of Object.entries(data)) {
            if (k.includes('rx') || k.includes('tx') || k === 'rate-limit' || k === 'priority')
                continue;
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${k}=${v}`);
        }
        let rl = data['rate-limit'] || buildRateLimitString(data);
        if (rl)
            params.push(`=rate-limit=${rl}`);
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/profile/set', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
function buildRateLimitString(data) {
    if (!data['rate-limit-rx'])
        return null;
    const rx = data['rate-limit-rx'];
    const tx = data['rate-limit-tx'] || rx;
    let rl = `${rx}/${tx}`;
    // Check if we have burst or priority or limit-at
    const brx = data['burst-limit-rx'];
    const btx = data['burst-limit-tx'] || brx;
    const thr_rx = data['burst-threshold-rx'];
    const thr_tx = data['burst-threshold-tx'] || thr_rx;
    const time_rx = data['burst-time-rx'];
    const time_tx = data['burst-time-tx'] || time_rx;
    const priority = data['priority'];
    const lat_rx = data['limit-at-rx'];
    const lat_tx = data['limit-at-tx'] || lat_rx;
    if (brx || btx || priority || lat_rx) {
        // If we want priority or limit-at, we MUST provide burst values
        const b = brx ? `${brx}/${btx}` : '0/0';
        const t = thr_rx ? `${thr_rx}/${thr_tx}` : '0/0';
        const tm = time_rx ? `${time_rx}/${time_tx}` : '0s/0s';
        rl += ` ${b} ${t} ${tm}`;
        if (priority || lat_rx) {
            rl += ` ${priority || '8'}`;
            if (lat_rx) {
                rl += ` ${lat_rx}/${lat_tx}`;
            }
        }
    }
    return rl;
}
async function findPppProfileIdByName(cfg, name) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/profile/print', [`?name=${name}`], `profile_id:${name}`, 3600000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
async function deletePppProfile(cfg, id) {
    try {
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/profile/remove', [`.id=${id}`]);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function getInterfaces(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/interface/print', [], 'interfaces', 30000);
        return (res || []).map(r => ({
            '.id': r['.id'], name: r['name'], type: r['type'], mtu: r['mtu'], actualMtu: r['actual-mtu'], l2mtu: r['l2mtu'],
            macAddress: r['mac-address'], lastLinkUpTime: r['last-link-up-time'], linkDowns: r['link-downs'],
            rxByte: r['rx-byte'], txByte: r['tx-byte'], rxPacket: r['rx-packet'], txPacket: r['tx-packet'],
            rxDrop: r['rx-drop'], txDrop: r['tx-drop'], txQueueDrop: r['tx-queue-drop'], rxError: r['rx-error'],
            txError: r['tx-error'], disabled: r['disabled'], running: r['running'], comment: r['comment']
        }));
    }
    catch {
        return [];
    }
}
async function getInterfaceTraffic(cfg, interfaceName) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/interface/print', [`?name=${interfaceName}`], `traffic:${interfaceName}`, 5000);
        const iface = res?.[0] || {};
        return {
            rxByte: parseInt(iface['rx-byte'] || '0'), txByte: parseInt(iface['tx-byte'] || '0'),
            rxPacket: parseInt(iface['rx-packet'] || '0'), txPacket: parseInt(iface['tx-packet'] || '0'),
            rxDrop: parseInt(iface['rx-drop'] || '0'), txDrop: parseInt(iface['tx-drop'] || '0'),
            rxError: parseInt(iface['rx-error'] || '0'), txError: parseInt(iface['tx-error'] || '0')
        };
    }
    catch {
        return { rxByte: 0, txByte: 0, rxPacket: 0, txPacket: 0, rxDrop: 0, txDrop: 0, rxError: 0, txError: 0 };
    }
}
async function getPppoeActiveConnections(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/active/print', [], 'active_connections', 60000);
        return Array.isArray(res) ? res : [];
    }
    catch {
        return [];
    }
}
async function getPppoeSecrets(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/secret/print', [], 'pppoe_secrets', 60000);
        return Array.isArray(res) ? res : [];
    }
    catch (e) {
        console.error('[MikroTikService] Failed to get secrets:', e);
        return [];
    }
}
async function findPppoeSecretIdByName(cfg, name) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/secret/print', [`?name=${name}`], `secret_id:${name}`, 3600000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
async function createPppoeSecret(cfg, data) {
    try {
        const params = [];
        // Default service to pppoe if not provided
        const secretData = { service: 'pppoe', ...data };
        for (const [k, v] of Object.entries(secretData)) {
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${k}=${v}`);
        }
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/secret/add', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function updatePppoeSecret(cfg, username, data) {
    try {
        const id = await findPppoeSecretIdByName(cfg, username);
        if (!id)
            throw new Error('Secret not found');
        const params = [`=.id=${id}`];
        // Ensure service is pppoe if being updated (optional but keeps it consistent)
        const secretData = { service: 'pppoe', ...data };
        for (const [k, v] of Object.entries(secretData)) {
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${k}=${v}`);
        }
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/secret/set', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function deletePppoeSecret(cfg, username) {
    try {
        const id = await findPppoeSecretIdByName(cfg, username);
        if (id) {
            await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/secret/remove', [`=.id=${id}`]);
            MikroTikConnectionPool_1.mikrotikPool.clearCache();
        }
    }
    catch (err) {
        throw err;
    }
}
async function getSystemResources(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/system/resource/print', [], 'resource', 60000);
        return res?.[0] || {};
    }
    catch {
        return {};
    }
}
async function getPppoeServerStats(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ppp/active/print', [], 'active_connections', 60000);
        return Array.isArray(res) ? res : [];
    }
    catch {
        return [];
    }
}
async function getSimpleQueues(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/simple/print', [], 'simple_queues', 30000);
        return Array.isArray(res) ? res : [];
    }
    catch {
        return [];
    }
}
async function createSimpleQueue(cfg, data) {
    try {
        const params = [];
        const mapping = {
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
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${mikrotikKey}=${v}`);
        }
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/simple/add', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function updateSimpleQueue(cfg, id, data) {
    try {
        const params = [`=.id=${id}`];
        const mapping = {
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
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${mikrotikKey}=${v}`);
        }
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/simple/set', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function deleteSimpleQueue(cfg, id) {
    try {
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/simple/remove', [`=.id=${id}`]);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function findSimpleQueueIdByName(cfg, name) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/simple/print', [`?name=${name}`], `sq_name:${name}`, 5000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
async function getQueueTrees(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/tree/print', [], 'queue_trees', 30000);
        return Array.isArray(res) ? res : [];
    }
    catch {
        return [];
    }
}
async function createQueueTree(cfg, data) {
    try {
        // Import and use queue validation
        const { preValidateQueueCreation } = await Promise.resolve().then(() => __importStar(require('../utils/queueValidationHelper')));
        // Validate queue data before creation
        const validation = await preValidateQueueCreation(data);
        if (!validation.valid) {
            throw new Error(`Queue validation failed: ${validation.errors.join(', ')}`);
        }
        const validatedData = validation.sanitizedData;
        const params = [];
        const mapping = {
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
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${mikrotikKey}=${v}`);
        }
        console.log('[createQueueTree] Creating queue with params:', params);
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/tree/add', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        console.error('[createQueueTree] Failed to create queue:', err.message);
        throw err;
    }
}
async function updateQueueTree(cfg, id, data) {
    try {
        // Import and use queue validation
        const { preValidateQueueCreation } = await Promise.resolve().then(() => __importStar(require('../utils/queueValidationHelper')));
        // Validate and sanitize data (Using preValidate helper ensures consistent sanitization for limits/bursts)
        const validation = await preValidateQueueCreation(data);
        const validatedData = validation.sanitizedData;
        const params = [`=.id=${id}`];
        const mapping = {
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
            if (v !== undefined && v !== null && v !== '')
                params.push(`=${mikrotikKey}=${v}`);
        }
        console.log('[updateQueueTree] Updating queue with params:', params);
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/tree/set', params);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        console.error('[updateQueueTree] Failed to update queue:', err.message);
        throw err;
    }
}
async function deleteQueueTree(cfg, id) {
    try {
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/tree/remove', [`=.id=${id}`]);
        MikroTikConnectionPool_1.mikrotikPool.clearCache();
    }
    catch (err) {
        throw err;
    }
}
async function addMangleRulesForClient(cfg, data) {
    try {
        // Clear old ones first to avoid duplicates
        await removeMangleRulesForClient(cfg, data);
        // Download mangle
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/add', [
            '=chain=forward',
            `=dst-address=${data.peerIp}`,
            `=action=mark-packet`,
            `=new-packet-mark=${data.downloadMark}`,
            '=passthrough=no',
            `=comment=Download for ${data.peerIp}`
        ]);
        // Upload mangle
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/add', [
            '=chain=forward',
            `=src-address=${data.peerIp}`,
            `=action=mark-packet`,
            `=new-packet-mark=${data.uploadMark}`,
            '=passthrough=no',
            `=comment=Upload for ${data.peerIp}`
        ]);
    }
    catch (err) {
        throw err;
    }
}
async function removeMangleRulesForClient(cfg, data) {
    try {
        // 1. Find by comment (original logic)
        const rulesByCommentDown = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/print', [
            `?comment=Download for ${data.peerIp}`
        ], `mangle_down_c:${data.peerIp}`, 1000);
        const rulesByCommentUp = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/print', [
            `?comment=Upload for ${data.peerIp}`
        ], `mangle_up_c:${data.peerIp}`, 1000);
        // 2. Find by IP Address (more robust)
        const rulesByIpDown = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/print', [
            `?dst-address=${data.peerIp}`
        ], `mangle_down_ip:${data.peerIp}`, 1000);
        const rulesByIpUp = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/print', [
            `?src-address=${data.peerIp}`
        ], `mangle_up_ip:${data.peerIp}`, 1000);
        // 3. Find by packet mark (if it matches the IP or the expected marks)
        // This is for cases where the mark itself IS the IP address
        const rulesByMarkDown = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/print', [
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
                await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/remove', [`=.id=${id}`]);
            }
        }
    }
    catch (err) {
        console.warn(`[MikroTik] Warning while removing mangle rules for ${data.peerIp}:`, err);
    }
}
async function addIpAddress(cfg, data) {
    try {
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/address/add', [
            `=interface=${data.interface}`,
            `=address=${data.address}`,
            `=comment=${data.comment}`
        ]);
    }
    catch (err) {
        throw err;
    }
}
async function removeIpAddress(cfg, address) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/address/print', [`?address=${address}`], `ip_addr:${address}`, 1000);
        if (res && res.length > 0) {
            for (const r of res) {
                await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/address/remove', [`=.id=${r['.id']}`]);
            }
        }
    }
    catch { /* ignore */ }
}
async function deleteClientQueuesByClientName(cfg, clientName) {
    try {
        const trees = await getQueueTrees(cfg);
        const toDelete = trees.filter(t => t.name.includes(clientName));
        for (const t of toDelete) {
            await deleteQueueTree(cfg, t['.id']);
        }
    }
    catch { /* ignore */ }
}
async function createClientQueues(cfg, data) {
    // This seems to be a composite function, let's implement it based on typical usage
    // Usually it calls createQueueTree twice (one for upload, one for download)
    try {
        await createQueueTree(cfg, data.download);
        await createQueueTree(cfg, data.upload);
    }
    catch (err) {
        throw err;
    }
}
async function getSystemHealth(cfg) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/system/health/print', [], 'health', 60000);
        return Array.isArray(res) ? res : [];
    }
    catch {
        return [];
    }
}
async function findIpAddressId(cfg, address) {
    try {
        // Search by address exactly
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/address/print', [`?address=${address}`], `ip_addr_check:${address}`, 1000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
async function updateIpAddress(cfg, id, data) {
    try {
        const params = [`=.id=${id}`];
        if (data.comment)
            params.push(`=comment=${data.comment}`);
        if (data.interface)
            params.push(`=interface=${data.interface}`);
        await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/address/set', params);
    }
    catch { /* ignore */ }
}
async function findQueueTreeIdByName(cfg, name) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/tree/print', [`?name=${name}`], `qt_name:${name}`, 5000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
async function findMangleIdByComment(cfg, comment) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/ip/firewall/mangle/print', [`?comment=${comment}`], `mangle_chk:${comment}`, 1000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
async function findQueueTreeIdByPacketMark(cfg, packetMark) {
    try {
        const res = await MikroTikConnectionPool_1.mikrotikPool.execute(cfg, '/queue/tree/print', [`?packet-mark=${packetMark}`], `qt_mark:${packetMark}`, 5000);
        return res?.[0]?.['.id'] || null;
    }
    catch {
        return null;
    }
}
