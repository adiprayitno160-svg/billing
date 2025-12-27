export type MikroTikConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    use_tls: boolean;
};
export declare function testMikrotikConnection(cfg: MikroTikConfig): Promise<{
    connected: boolean;
    error?: string;
}>;
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
export declare function getMikrotikInfo(cfg: MikroTikConfig): Promise<MikroTikInfo>;
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
export type PppoeActiveConnection = {
    '.id': string;
    name: string;
    service?: string;
    caller_id?: string;
    address?: string;
    uptime?: string;
    encoding?: string;
    session_id?: string;
    limit_bytes_in?: string;
    limit_bytes_out?: string;
    limit_bytes_total?: string;
    bytes_in?: string;
    bytes_out?: string;
    packets_in?: string;
    packets_out?: string;
    radius?: string;
    comment?: string;
};
export type PppoeSecret = {
    '.id': string;
    name: string;
    service?: string;
    profile?: string;
    'remote-address'?: string;
    'local-address'?: string;
    password?: string;
    comment?: string;
    disabled?: string;
    'caller-id'?: string;
    'last-logged-out'?: string;
    'last-caller-id'?: string;
};
export type PppoeServerStats = {
    '.id': string;
    name: string;
    interface?: string;
    'default-profile'?: string;
    'authentication'?: string;
    'keepalive-timeout'?: string;
    'max-mtu'?: string;
    'max-mru'?: string;
    'mrru'?: string;
    'allow'?: string;
    disabled?: string;
    comment?: string;
};
export declare function getPppProfiles(cfg: MikroTikConfig): Promise<PppProfile[]>;
export declare function createPppProfile(cfg: MikroTikConfig, data: {
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
}): Promise<void>;
export declare function updatePppProfile(cfg: MikroTikConfig, id: string, data: {
    name?: string;
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
}): Promise<void>;
/**
 * Find PPP profile ID by name in MikroTik
 */
export declare function findPppProfileIdByName(cfg: MikroTikConfig, name: string): Promise<string | null>;
export declare function deletePppProfile(cfg: MikroTikConfig, id: string): Promise<void>;
export type InterfaceInfo = {
    '.id': string;
    name: string;
    type: string;
    mtu: string;
    actualMtu: string;
    l2mtu: string;
    macAddress: string;
    lastLinkUpTime: string;
    linkDowns: string;
    rxByte: string;
    txByte: string;
    rxPacket: string;
    txPacket: string;
    rxDrop: string;
    txDrop: string;
    txQueueDrop: string;
    rxError: string;
    txError: string;
    disabled: string;
    running: string;
    comment?: string;
};
export declare function getInterfaces(cfg: MikroTikConfig): Promise<InterfaceInfo[]>;
export declare function getInterfaceTraffic(cfg: MikroTikConfig, interfaceName: string): Promise<{
    rxByte: number;
    txByte: number;
    rxPacket: number;
    txPacket: number;
    rxDrop: number;
    txDrop: number;
    rxError: number;
    txError: number;
}>;
export type QueueTreeInfo = {
    '.id': string;
    name: string;
    parent: string;
    packetMarks: string;
    limitAt: string;
    maxLimit: string;
    burstLimit: string;
    burstThreshold: string;
    burstTime: string;
    priority: string;
    queue: string;
    disabled: string;
    comment?: string;
};
export declare function getQueueTrees(cfg: MikroTikConfig): Promise<QueueTreeInfo[]>;
export declare function addIpAddress(cfg: MikroTikConfig, params: {
    interface: string;
    address: string;
    comment?: string;
}): Promise<void>;
export declare function addMangleRulesForClient(cfg: MikroTikConfig, params: {
    peerIp: string;
    downloadMark: string;
    uploadMark: string;
}): Promise<void>;
export declare function createClientQueues(cfg: MikroTikConfig, params: {
    clientName: string;
    parentDownload: string;
    parentUpload: string;
    downloadMark: string;
    uploadMark: string;
    downloadLimit: string;
    uploadLimit: string;
}): Promise<void>;
export declare function createQueueTree(cfg: MikroTikConfig, data: {
    name: string;
    parent?: string;
    packetMarks?: string;
    limitAt?: string;
    maxLimit?: string;
    burstLimit?: string;
    burstThreshold?: string;
    burstTime?: string;
    priority?: string;
    queue?: string;
    disabled?: string;
    comment?: string;
}): Promise<void>;
export declare function updateQueueTree(cfg: MikroTikConfig, id: string, data: {
    name?: string;
    parent?: string;
    packetMarks?: string;
    limitAt?: string;
    maxLimit?: string;
    burstLimit?: string;
    burstThreshold?: string;
    burstTime?: string;
    priority?: string;
    queue?: string;
    disabled?: string;
    comment?: string;
}): Promise<void>;
export declare function deleteQueueTree(cfg: MikroTikConfig, id: string): Promise<void>;
export declare function findQueueTreeIdByName(cfg: MikroTikConfig, name: string): Promise<string | null>;
export declare function deleteQueueTreeByName(cfg: MikroTikConfig, name: string): Promise<void>;
export declare function removeIpAddress(cfg: MikroTikConfig, address: string): Promise<void>;
export declare function removeMangleRulesForClient(cfg: MikroTikConfig, params: {
    peerIp: string;
    downloadMark?: string;
    uploadMark?: string;
}): Promise<void>;
export declare function deleteClientQueuesByClientName(cfg: MikroTikConfig, clientName: string): Promise<void>;
/**
 * Get PPPoE active connections with bandwidth stats
 */
export declare function getPppoeActiveConnections(cfg: MikroTikConfig): Promise<PppoeActiveConnection[]>;
/**
 * Delete PPPoE secret from MikroTik by username/name
 */
export declare function deletePppoeSecret(cfg: MikroTikConfig, username: string): Promise<void>;
/**
 * Get PPPoE secrets (users) for monitoring
 */
export declare function getPppoeSecrets(cfg: MikroTikConfig): Promise<PppoeSecret[]>;
/**
 * Find PPPoE secret ID by username
 */
export declare function findPppoeSecretIdByName(cfg: MikroTikConfig, username: string): Promise<string | null>;
/**
 * Create PPPoE secret in MikroTik
 */
export declare function createPppoeSecret(cfg: MikroTikConfig, data: {
    name: string;
    password: string;
    profile?: string;
    comment?: string;
    disabled?: boolean;
}): Promise<void>;
/**
 * Update PPPoE secret in MikroTik
 */
export declare function updatePppoeSecret(cfg: MikroTikConfig, username: string, data: {
    name?: string;
    password?: string;
    profile?: string;
    comment?: string;
    disabled?: boolean;
}): Promise<void>;
/**
 * Get interface traffic monitoring data
 */
export declare function getInterfaceTrafficMonitoring(cfg: MikroTikConfig, interfaceName?: string): Promise<any[]>;
/**
 * Get queue tree statistics for bandwidth monitoring
 */
export declare function getQueueTreeStats(cfg: MikroTikConfig): Promise<any[]>;
/**
 * Get IP addresses with interface information
 */
export declare function getIpAddresses(cfg: MikroTikConfig): Promise<any[]>;
/**
 * Get system resource information
 */
export declare function getSystemResources(cfg: MikroTikConfig): Promise<any>;
/**
 * Get interface list for monitoring
 */
export declare function getInterfacesForMonitoring(cfg: MikroTikConfig): Promise<any[]>;
/**
 * Get PPPoE server statistics
 */
export declare function getPppoeServerStats(cfg: MikroTikConfig): Promise<PppoeServerStats[]>;
//# sourceMappingURL=mikrotikService.d.ts.map