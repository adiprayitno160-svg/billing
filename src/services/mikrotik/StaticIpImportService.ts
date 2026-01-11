import { mikrotikPool } from '../MikroTikConnectionPool';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';

export interface StaticIpCandidate {
    queueId: string;
    queueName: string;
    packetMark: string;
    maxLimit: string;
    ipAddress: string | null;      // IP pelanggan (dari mangle/queue)
    gatewayIp: string | null;      // IP gateway MikroTik (untuk isolir)
    gatewayIpId: string | null;    // .id dari /ip/address (untuk disable saat isolir)
    interface: string | null;       // Interface dimana gateway terpasang
    comment: string;
    mangleId?: string;
}

export class StaticIpImportService {
    private async getPoolConfig() {
        const config = await getMikrotikConfig();
        if (!config) throw new Error('MikroTik configuration not found');

        return {
            host: config.host,
            port: config.port || config.api_port || 8728,
            username: config.username,
            password: config.password
        };
    }

    /**
     * Helper: Cek apakah string adalah format IP address valid
     */
    private isValidIpAddress(str: string): boolean {
        if (!str) return false;
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
        if (!ipRegex.test(str)) return false;

        const ip = str.split('/')[0];
        const octets = ip.split('.');
        return octets.every(oct => {
            const num = parseInt(oct, 10);
            return num >= 0 && num <= 255;
        });
    }

    /**
     * Helper: Konversi IP ke integer
     */
    private ipToInt(ip: string): number {
        return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
    }

    /**
     * Helper: Cek apakah 2 IP berada di network yang sama berdasarkan prefix
     * Contoh: 192.168.239.2 dan 192.168.239.1/30 → true (sama-sama di network /30)
     */
    private isSameNetwork(customerIp: string, gatewayWithCidr: string): boolean {
        if (!customerIp || !gatewayWithCidr) return false;

        const [gwIp, cidrStr] = gatewayWithCidr.split('/');
        const cidr = parseInt(cidrStr || '32', 10);

        if (cidr < 1 || cidr > 32) return false;

        const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        const custNetwork = this.ipToInt(customerIp) & mask;
        const gwNetwork = this.ipToInt(gwIp) & mask;

        return custNetwork === gwNetwork;
    }

    /**
     * Helper: Format bandwidth limit dari bytes ke readable (K/M/G)
     */
    private formatBandwidth(limit: string): string {
        if (!limit || limit === '0') return '0';

        if (/[KMGkmg]/.test(limit)) return limit;

        if (limit.includes('/')) {
            const parts = limit.split('/');
            return parts.map(p => this.formatSingleBandwidth(p)).join('/');
        }

        return this.formatSingleBandwidth(limit);
    }

    private formatSingleBandwidth(value: string): string {
        const num = parseInt(value, 10);
        if (isNaN(num) || num === 0) return '0';

        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(0) + 'G';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(0) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toString();
    }

    /**
     * Memindai MikroTik untuk mencari kandidat Queue Tree yang bisa di-import.
     * Deteksi: IP Pelanggan, Gateway IP, Interface
     */
    async scanCandidates(): Promise<StaticIpCandidate[]> {
        const config = await this.getPoolConfig();

        try {
            // 1. Ambil semua Queue Tree
            const queues = await mikrotikPool.execute(config, '/queue/tree/print', []);

            // 2. Ambil semua Mangle Rules
            const mangles = await mikrotikPool.execute(config, '/ip/firewall/mangle/print', []);

            // 3. Ambil semua IP Address dari /ip/address (untuk cari gateway)
            const ipAddresses = await mikrotikPool.execute(config, '/ip/address/print', []);

            if (!Array.isArray(queues)) {
                return [];
            }

            const candidates: StaticIpCandidate[] = [];

            // Mapping Packet Mark ke IP dari Mangle
            const packetMarkToIpMap = new Map<string, { ip: string, id: string }>();
            if (Array.isArray(mangles)) {
                for (const mangle of mangles) {
                    const mark = mangle['new-packet-mark'];
                    if (mark) {
                        const ip = mangle['src-address'] || mangle['dst-address'] || null;
                        if (ip) {
                            const cleanIp = ip.split('/')[0];
                            packetMarkToIpMap.set(mark, { ip: cleanIp, id: mangle['.id'] });
                        }
                    }
                }
            }

            // Build list of IP Addresses dengan info lengkap
            const ipAddressList: { id: string, address: string, ip: string, cidr: number, interface: string, comment: string }[] = [];
            if (Array.isArray(ipAddresses)) {
                for (const ipEntry of ipAddresses) {
                    const address = ipEntry['address'];
                    if (address && address.includes('/')) {
                        const [ip, cidrStr] = address.split('/');
                        ipAddressList.push({
                            id: ipEntry['.id'],
                            address: address,
                            ip: ip,
                            cidr: parseInt(cidrStr, 10),
                            interface: ipEntry['interface'] || '',
                            comment: ipEntry['comment'] || ''
                        });
                    }
                }
            }

            // Gabungkan data
            for (const queue of queues) {
                const packetMark = queue['packet-mark'];
                if (!packetMark || packetMark === 'no-mark') continue;

                // Filter: Skip queue yang hanya untuk upload (parent queue)
                // Biasanya queue upload memiliki nama dengan pola: up-*, upload-*, *-upload, *-up
                const queueName = (queue['name'] || '').toLowerCase();
                const uploadPatterns = [
                    /^up-/i,           // up-testing, up-xxx
                    /^upload-/i,       // upload-testing
                    /-upload$/i,       // xxx-upload
                    /-up$/i,           // xxx-up
                    /^upload$/i,       // upload (exact)
                    /^parent-/i,       // parent-xxx
                    /^global-/i,       // global-xxx
                ];

                const isUploadQueue = uploadPatterns.some(pattern => pattern.test(queueName));
                if (isUploadQueue) {
                    console.log(`[StaticIP Scan] Skipping upload/parent queue: ${queueName}`);
                    continue;
                }

                let customerIp: string | null = null;
                let mangleId: string | undefined = undefined;
                let gatewayIp: string | null = null;
                let gatewayIpId: string | null = null;
                let gatewayInterface: string | null = null;

                // === DETEKSI IP PELANGGAN ===

                // Strategi 1: Packet Mark = IP Address
                if (this.isValidIpAddress(packetMark)) {
                    customerIp = packetMark.split('/')[0];
                }

                // Strategi 2: Cari di Mangle berdasarkan packet-mark
                if (!customerIp) {
                    const mangleData = packetMarkToIpMap.get(packetMark);
                    if (mangleData) {
                        customerIp = mangleData.ip;
                        mangleId = mangleData.id;
                    }
                }

                // Strategi 3: Ekstrak IP dari nama packet-mark (format: xxx_192.168.1.1)
                if (!customerIp) {
                    const ipMatch = packetMark.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                    if (ipMatch && this.isValidIpAddress(ipMatch[1])) {
                        customerIp = ipMatch[1];
                    }
                }

                // === DETEKSI GATEWAY IP (untuk isolir) ===
                // Cari di /ip/address yang network-nya sama dengan customer IP
                if (customerIp) {
                    for (const ipEntry of ipAddressList) {
                        // Cek apakah customer IP berada di network yang sama dengan gateway
                        if (this.isSameNetwork(customerIp, ipEntry.address)) {
                            // Pastikan ini bukan IP pelanggan itu sendiri
                            if (ipEntry.ip !== customerIp) {
                                gatewayIp = ipEntry.address;
                                gatewayIpId = ipEntry.id;
                                gatewayInterface = ipEntry.interface;
                                break;
                            }
                        }
                    }

                    // Jika tidak ketemu dengan network matching, coba cari dengan comment
                    if (!gatewayIp) {
                        const queueName = queue['name'] || '';
                        const queueComment = queue['comment'] || '';

                        for (const ipEntry of ipAddressList) {
                            const entryComment = ipEntry.comment.toLowerCase();
                            const searchName = queueName.toLowerCase().replace(/[_\-\.]/g, ' ').trim();

                            if (entryComment && (entryComment.includes(searchName) || searchName.includes(entryComment))) {
                                gatewayIp = ipEntry.address;
                                gatewayIpId = ipEntry.id;
                                gatewayInterface = ipEntry.interface;
                                break;
                            }
                        }
                    }
                }

                // Format limit
                const rawLimit = queue['max-limit'] || '0';
                const formattedLimit = this.formatBandwidth(rawLimit);

                candidates.push({
                    queueId: queue['.id'],
                    queueName: this.sanitizeString(queue['name']),
                    packetMark: this.sanitizeString(packetMark),
                    maxLimit: formattedLimit,
                    ipAddress: customerIp,
                    gatewayIp: gatewayIp,
                    gatewayIpId: gatewayIpId,
                    interface: gatewayInterface,
                    comment: this.sanitizeString(queue['comment'] || ''),
                    mangleId: mangleId
                });
            }

            // Urutkan berdasarkan Nama Queue
            return candidates.sort((a, b) => a.queueName.localeCompare(b.queueName));

        } catch (error) {
            console.error('Failed to scan MikroTik candidates:', error);
            throw error;
        }
    }

    /**
     * Helper: Bersihkan string dari karakter aneh (\r, \n, null)
     */
    private sanitizeString(str: string | undefined): string {
        if (!str) return '';
        return str.replace(/[\r\n\t]/g, '').trim();
    }

    /**
     * Mengubah nama Queue Tree agar sesuai standar Billing
     */
    async renameQueue(queueId: string, newName: string, newLimit?: string): Promise<boolean> {
        const config = await this.getPoolConfig();
        try {
            const params = [`.id=${queueId}`, `=name=${newName}`];
            if (newLimit) {
                params.push(`=max-limit=${newLimit}`);
            }

            await mikrotikPool.execute(config, '/queue/tree/set', params);
            return true;
        } catch (error) {
            console.error(`Failed to rename queue ${queueId}:`, error);
            return false;
        }
    }

    /**
     * Mengubah comment di Mangle untuk tracking
     */
    async tagMangle(mangleId: string, comment: string): Promise<boolean> {
        const config = await this.getPoolConfig();
        try {
            await mikrotikPool.execute(config, '/ip/firewall/mangle/set', [
                `.id=${mangleId}`,
                `=comment=${comment}`
            ]);
            return true;
        } catch (error) {
            console.error(`Failed to tag mangle ${mangleId}:`, error);
            return false;
        }
    }

    /**
     * ISOLIR: Disable IP Address di MikroTik (matikan gateway pelanggan)
     */
    async disableIpAddress(ipAddressId: string): Promise<boolean> {
        const config = await this.getPoolConfig();
        try {
            await mikrotikPool.execute(config, '/ip/address/set', [
                `.id=${ipAddressId}`,
                `=disabled=yes`
            ]);
            console.log(`[StaticIP Isolir] IP Address ${ipAddressId} disabled`);
            return true;
        } catch (error) {
            console.error(`Failed to disable IP address ${ipAddressId}:`, error);
            return false;
        }
    }

    /**
     * RESTORE: Enable IP Address di MikroTik (aktifkan kembali gateway pelanggan)
     */
    async enableIpAddress(ipAddressId: string): Promise<boolean> {
        const config = await this.getPoolConfig();
        try {
            await mikrotikPool.execute(config, '/ip/address/set', [
                `.id=${ipAddressId}`,
                `=disabled=no`
            ]);
            console.log(`[StaticIP Restore] IP Address ${ipAddressId} enabled`);
            return true;
        } catch (error) {
            console.error(`Failed to enable IP address ${ipAddressId}:`, error);
            return false;
        }
    }

    /**
     * Cari IP Address ID berdasarkan IP
     */
    async findIpAddressId(gatewayIp: string): Promise<string | null> {
        const config = await this.getPoolConfig();
        try {
            const ipAddresses = await mikrotikPool.execute(config, '/ip/address/print', []);
            if (!Array.isArray(ipAddresses)) return null;

            for (const ipEntry of ipAddresses) {
                if (ipEntry['address'] === gatewayIp) {
                    return ipEntry['.id'];
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to find IP address ID:', error);
            return null;
        }
    }
}
