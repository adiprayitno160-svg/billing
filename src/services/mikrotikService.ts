import { RouterOSAPI } from 'routeros-api';

export type MikroTikConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    use_tls: boolean;
};

export async function testMikrotikConnection(cfg: MikroTikConfig): Promise<{ connected: boolean, error?: string }> {
    try {
        console.log('=== TESTING MIKROTIK CONNECTION ===');
        console.log('Host:', cfg.host);
        console.log('Port:', cfg.port);
        console.log('Username:', cfg.username);
        console.log('Use TLS:', cfg.use_tls);

        const api = new RouterOSAPI({
            host: cfg.host,
            port: cfg.port,
            user: cfg.username,
            password: cfg.password,
            timeout: 5000
        });

        console.log('Attempting to connect...');
        await api.connect();
        console.log('✅ Connected to MikroTik successfully');

        // Login tidak diperlukan, kredensial sudah dipakai saat connect

        // Simple test command
        console.log('Testing with /system/identity/print...');
        const result = await api.write('/system/identity/print');
        console.log('Identity result:', result);

        // Test queue tree access
        console.log('Testing queue tree access...');
        const queues = await api.write('/queue/tree/print');
        console.log('Existing queues:', queues.length);
        console.log('Queue names:', queues.map((q: any) => q.name));

        api.close();
        console.log('✅ Connection test completed successfully');
        return { connected: true };
    } catch (error: any) {
        console.error('❌ Connection failed:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error));
        console.error('❌ Full error:', error);
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
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        const identityResult = await api.write('/system/identity/print');
        const resourceResult = await api.write('/system/resource/print');

        console.log('Identity result:', identityResult);
        console.log('Resource result:', resourceResult);

        // Parse identity data
        const identityRows = Array.isArray(identityResult) ? identityResult : [];
        const resourceRows = Array.isArray(resourceResult) ? resourceResult : [];

        console.log('Identity rows:', identityRows);
        console.log('Resource rows:', resourceRows);

        const identity = identityRows?.[0]?.['name'];
        const version = resourceRows?.[0]?.['version'];
        const uptime = resourceRows?.[0]?.['uptime'];
        const cpuLoad = resourceRows?.[0]?.['cpu-load'];
        const freeMemory = resourceRows?.[0]?.['free-memory'];
        const totalMemory = resourceRows?.[0]?.['total-memory'];
        const boardName = resourceRows?.[0]?.['board-name'];
        const cpu = resourceRows?.[0]?.['cpu'];
        const cpuCount = resourceRows?.[0]?.['cpu-count'];
        const freeHddSpace = resourceRows?.[0]?.['free-hdd-space'];
        const totalHddSpace = resourceRows?.[0]?.['total-hdd-space'];
        const architectureName = resourceRows?.[0]?.['architecture-name'];
        const buildTime = resourceRows?.[0]?.['build-time'];

        const result = {
            identity, version, uptime, cpuLoad, freeMemory, totalMemory,
            'board-name': boardName, 'cpu': cpu, 'cpu-count': cpuCount,
            'free-hdd-space': freeHddSpace, 'total-hdd-space': totalHddSpace,
            'architecture-name': architectureName, 'build-time': buildTime
        };

        console.log('MikroTik info result:', result);
        return result;
    } finally {
        api.close();
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

export async function getPppProfiles(cfg: MikroTikConfig): Promise<PppProfile[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();

        // Try to get profiles with detail flag to get all burst parameters
        console.log('📡 Fetching PPP profiles with detail flag...');
        const profiles = await api.write('/ppp/profile/print', ['=detail=']);
        const rows = Array.isArray(profiles) ? profiles : [];

        console.log('📊 Raw MikroTik Profile Data (FULL):', JSON.stringify(rows[0], null, 2));
        console.log('📊 Total profiles from MikroTik:', rows.length);

        // Parse rate-limit field (format: "rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]")
        // Example: "10M/2M 20M/4M 15M/3M 10s/10s 8"

        return rows.map((r: any) => {
            console.log(`\n🔍 Processing profile: ${r['name']}`);
            console.log(`  📋 All fields from MikroTik:`, Object.keys(r).join(', '));

            const rateLimit = r['rate-limit'] || '';
            let rate_limit_rx = '';
            let rate_limit_tx = '';
            let burst_limit_rx = '';
            let burst_limit_tx = '';
            let burst_threshold_rx = '';
            let burst_threshold_tx = '';
            let burst_time_rx = '';
            let burst_time_tx = '';

            // Check if MikroTik sends separate fields
            console.log(`  🔎 Checking separate fields:`, {
                'rx-rate': r['rx-rate'] || 'NOT FOUND',
                'tx-rate': r['tx-rate'] || 'NOT FOUND',
                'burst-rate': r['burst-rate'] || 'NOT FOUND',
                'burst-threshold': r['burst-threshold'] || 'NOT FOUND',
                'burst-time': r['burst-time'] || 'NOT FOUND'
            });

            if (rateLimit) {
                console.log(`  🔍 Parsing rate-limit string: "${rateLimit}"`);
                console.log(`  📏 String length: ${rateLimit.length}`);
                const parts = rateLimit.split(' ');
                console.log(`  📦 Split parts (${parts.length}):`, parts);

                // Parse rx-rate/tx-rate (first part)
                if (parts[0]) {
                    const rates = parts[0].split('/');
                    rate_limit_rx = rates[0] || '';
                    rate_limit_tx = rates[1] || rates[0]; // If no TX, use RX value
                    console.log(`  ✅ Rate limits: RX="${rate_limit_rx}", TX="${rate_limit_tx}"`);
                }

                // Parse burst-rate (second part)
                if (parts[1]) {
                    const bursts = parts[1].split('/');
                    burst_limit_rx = bursts[0] || '';
                    burst_limit_tx = bursts[1] || bursts[0]; // If no TX, use RX value
                    console.log(`  ✅ Burst limits: RX="${burst_limit_rx}", TX="${burst_limit_tx}"`);
                } else {
                    console.log(`  ⚠️  No burst-rate part (parts[1] is undefined)`);
                }

                // Parse burst-threshold (third part)
                if (parts[2]) {
                    const thresholds = parts[2].split('/');
                    burst_threshold_rx = thresholds[0] || '';
                    burst_threshold_tx = thresholds[1] || thresholds[0];
                    console.log(`  ✅ Burst thresholds: RX="${burst_threshold_rx}", TX="${burst_threshold_tx}"`);
                } else {
                    console.log(`  ⚠️  No burst-threshold part (parts[2] is undefined)`);
                }

                // Parse burst-time (fourth part)
                if (parts[3]) {
                    const times = parts[3].split('/');
                    burst_time_rx = times[0] || '';
                    burst_time_tx = times[1] || times[0];
                    console.log(`  ✅ Burst times: RX="${burst_time_rx}", TX="${burst_time_tx}"`);
                } else {
                    console.log(`  ⚠️  No burst-time part (parts[3] is undefined)`);
                }
            } else {
                console.log(`  ⚠️  No rate-limit field for ${r['name']}`);
            }

            // FALLBACK: Check if MikroTik sends separate burst fields (some RouterOS versions)
            if (!burst_limit_rx && r['burst-limit']) {
                const burstParts = String(r['burst-limit']).split('/');
                burst_limit_rx = burstParts[0] || '';
                burst_limit_tx = burstParts[1] || burstParts[0];
                console.log(`  🔄 FALLBACK: Got burst-limit from separate field: RX="${burst_limit_rx}", TX="${burst_limit_tx}"`);
            }

            if (!burst_threshold_rx && r['burst-threshold']) {
                const thresholdParts = String(r['burst-threshold']).split('/');
                burst_threshold_rx = thresholdParts[0] || '';
                burst_threshold_tx = thresholdParts[1] || thresholdParts[0];
                console.log(`  🔄 FALLBACK: Got burst-threshold from separate field: RX="${burst_threshold_rx}", TX="${burst_threshold_tx}"`);
            }

            if (!burst_time_rx && r['burst-time']) {
                const timeParts = String(r['burst-time']).split('/');
                burst_time_rx = timeParts[0] || '';
                burst_time_tx = timeParts[1] || timeParts[0];
                console.log(`  🔄 FALLBACK: Got burst-time from separate field: RX="${burst_time_rx}", TX="${burst_time_tx}"`);
            }

            // FINAL CHECK: Log what we got
            console.log(`  📊 FINAL BURST DATA for ${r['name']}:`, {
                'burst_limit_rx': burst_limit_rx || 'EMPTY',
                'burst_limit_tx': burst_limit_tx || 'EMPTY',
                'burst_threshold_rx': burst_threshold_rx || 'EMPTY',
                'burst_threshold_tx': burst_threshold_tx || 'EMPTY',
                'burst_time_rx': burst_time_rx || 'EMPTY',
                'burst_time_tx': burst_time_tx || 'EMPTY'
            });

            return {
                '.id': r['.id'],
                name: r['name'],
                'remote-address': r['remote-address'],
                'local-address': r['local-address'],
                'dns-server': r['dns-server'],
                'session-timeout': r['session-timeout'],
                'idle-timeout': r['idle-timeout'],
                'only-one': r['only-one'],
                'change-tcp-mss': r['change-tcp-mss'],
                'use-compression': r['use-compression'],
                'use-encryption': r['use-encryption'],
                'use-mpls': r['use-mpls'],
                'use-upnp': r['use-upnp'],
                comment: r['comment'],
                'rate-limit': rateLimit,
                'rate-limit-rx': rate_limit_rx,
                'rate-limit-tx': rate_limit_tx,
                'burst-limit-rx': burst_limit_rx,
                'burst-limit-tx': burst_limit_tx,
                'burst-threshold-rx': burst_threshold_rx,
                'burst-threshold-tx': burst_threshold_tx,
                'burst-time-rx': burst_time_rx,
                'burst-time-tx': burst_time_tx
            } as PppProfile;
        });
    } finally {
        api.close();
    }
}

export async function createPppProfile(cfg: MikroTikConfig, data: {
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
}): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        // Build rate-limit string if burst parameters are provided
        let rateLimitStr = '';
        if (data['rate-limit']) {
            rateLimitStr = data['rate-limit'];
        } else if (data['rate-limit-rx'] || data['rate-limit-tx']) {
            const rx = data['rate-limit-rx'] || '0';
            const tx = data['rate-limit-tx'] || rx;
            rateLimitStr = `${rx}/${tx}`;

            // Add burst parameters if provided
            if (data['burst-limit-rx'] || data['burst-limit-tx']) {
                const burstRx = data['burst-limit-rx'] || '';
                const burstTx = data['burst-limit-tx'] || burstRx;
                rateLimitStr += ` ${burstRx}/${burstTx}`;

                if (data['burst-threshold-rx'] || data['burst-threshold-tx']) {
                    const threshRx = data['burst-threshold-rx'] || '';
                    const threshTx = data['burst-threshold-tx'] || threshRx;
                    rateLimitStr += ` ${threshRx}/${threshTx}`;
                }

                if (data['burst-time-rx'] || data['burst-time-tx']) {
                    const timeRx = data['burst-time-rx'] || '';
                    const timeTx = data['burst-time-tx'] || timeRx;
                    rateLimitStr += ` ${timeRx}/${timeTx}`;
                }
            }
        }

        const dataArray: string[] = [];
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('rate-limit') || key.startsWith('burst-')) {
                // Skip individual rate/burst fields, we use rate-limit string instead
                continue;
            }
            if (value !== undefined && value !== null && value !== '') {
                dataArray.push(`${key}=${value}`);
            }
        }

        if (rateLimitStr) {
            dataArray.push(`rate-limit=${rateLimitStr}`);
        }

        await api.write('/ppp/profile/add', dataArray);
    } finally {
        api.close();
    }
}

export async function updatePppProfile(cfg: MikroTikConfig, id: string, data: {
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
}): Promise<void> {
    console.log(`🔄 [updatePppProfile] Starting update for profile ID: ${id}`);
    console.log(`📊 [updatePppProfile] Data received:`, JSON.stringify(data, null, 2));

    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000 // Increase timeout to 10 seconds
    });

    try {
        console.log(`🔌 [updatePppProfile] Connecting to MikroTik at ${cfg.host}:${cfg.port}...`);
        await api.connect();
        console.log(`✅ [updatePppProfile] Connected successfully`);

        // Build rate-limit string if burst parameters are provided
        let rateLimitStr = '';
        if (data['rate-limit']) {
            rateLimitStr = data['rate-limit'];
            console.log(`📊 [updatePppProfile] Using provided rate-limit string: ${rateLimitStr}`);
        } else if (data['rate-limit-rx'] || data['rate-limit-tx']) {
            const rx = data['rate-limit-rx'] || '0';
            const tx = data['rate-limit-tx'] || rx;
            rateLimitStr = `${rx}/${tx}`;
            console.log(`📊 [updatePppProfile] Built rate-limit from RX/TX: ${rateLimitStr} (RX: ${rx}, TX: ${tx})`);

            // Add burst parameters if provided
            if (data['burst-limit-rx'] || data['burst-limit-tx']) {
                const burstRx = data['burst-limit-rx'] || '';
                const burstTx = data['burst-limit-tx'] || burstRx;
                rateLimitStr += ` ${burstRx}/${burstTx}`;

                if (data['burst-threshold-rx'] || data['burst-threshold-tx']) {
                    const threshRx = data['burst-threshold-rx'] || '';
                    const threshTx = data['burst-threshold-tx'] || threshRx;
                    rateLimitStr += ` ${threshRx}/${threshTx}`;
                }

                if (data['burst-time-rx'] || data['burst-time-tx']) {
                    const timeRx = data['burst-time-rx'] || '';
                    const timeTx = data['burst-time-tx'] || timeRx;
                    rateLimitStr += ` ${timeRx}/${timeTx}`;
                }
                console.log(`📊 [updatePppProfile] Added burst parameters: ${rateLimitStr}`);
            }
        } else {
            console.warn(`⚠️ [updatePppProfile] No rate-limit data provided!`);
        }

        // Build parameters array - format HARUS sama dengan yang berhasil di test endpoint
        // Format yang berhasil: [`.id=${id}`, `=rate-limit=${rateLimitStr}`]
        const params: string[] = [];

        // ID HARUS di posisi pertama dengan format =.id=
        params.push(`=.id=${id}`);

        // Rate-limit HARUS di posisi kedua jika tersedia (ini yang paling penting!)
        if (rateLimitStr) {
            params.push(`=rate-limit=${rateLimitStr}`);
        }

        // Add other fields hanya jika rate-limit sudah ada atau jika tidak ada rate-limit sama sekali
        // Urutan: name, local-address, remote-address, dns-server, comment, dll
        if (data.name !== undefined && data.name !== null && data.name !== '') {
            params.push(`=name=${data.name}`);
        }
        if (data['local-address'] !== undefined && data['local-address'] !== null && data['local-address'] !== '') {
            params.push(`=local-address=${data['local-address']}`);
        }
        if (data['remote-address'] !== undefined && data['remote-address'] !== null && data['remote-address'] !== '') {
            params.push(`=remote-address=${data['remote-address']}`);
        }
        if (data['dns-server'] !== undefined && data['dns-server'] !== null && data['dns-server'] !== '') {
            params.push(`=dns-server=${data['dns-server']}`);
        }
        if (data.comment !== undefined && data.comment !== null && data.comment !== '') {
            params.push(`=comment=${data.comment}`);
        }

        // Add optional fields
        if (data['session-timeout'] !== undefined && data['session-timeout'] !== null && data['session-timeout'] !== '') {
            params.push(`=session-timeout=${data['session-timeout']}`);
        }
        if (data['idle-timeout'] !== undefined && data['idle-timeout'] !== null && data['idle-timeout'] !== '') {
            params.push(`=idle-timeout=${data['idle-timeout']}`);
        }
        if (data['only-one'] !== undefined && data['only-one'] !== null && data['only-one'] !== '') {
            params.push(`=only-one=${data['only-one']}`);
        }

        console.log(`📤 [updatePppProfile] Sending command: /ppp/profile/set`);
        console.log(`📤 [updatePppProfile] Parameters:`, params);
        console.log(`📤 [updatePppProfile] Rate limit string: ${rateLimitStr}`);

        // Gunakan format yang sama persis dengan yang berhasil di test endpoint
        const result = await api.write('/ppp/profile/set', params);
        console.log(`✅ [updatePppProfile] Update successful! Result:`, result);

        // Verify the update by reading the profile back
        console.log(`🔍 [updatePppProfile] Verifying update...`);
        const verifyResult = await api.write('/ppp/profile/print', [`?.id=${id}`]);
        if (Array.isArray(verifyResult) && verifyResult.length > 0) {
            const updatedProfile = verifyResult[0];
            console.log(`✅ [updatePppProfile] Verification - Profile name: ${updatedProfile.name}`);
            console.log(`✅ [updatePppProfile] Verification - Rate limit: ${updatedProfile['rate-limit'] || 'N/A'}`);
            console.log(`✅ [updatePppProfile] Verification - Rate limit RX: ${updatedProfile['rate-limit-rx'] || 'N/A'}`);
            console.log(`✅ [updatePppProfile] Verification - Rate limit TX: ${updatedProfile['rate-limit-tx'] || 'N/A'}`);
        } else {
            console.warn(`⚠️ [updatePppProfile] Could not verify update - profile not found after update`);
        }

    } catch (error: any) {
        console.error(`❌ [updatePppProfile] Error updating profile:`, error);
        console.error(`❌ [updatePppProfile] Error message:`, error?.message);
        console.error(`❌ [updatePppProfile] Error stack:`, error?.stack);
        console.error(`❌ [updatePppProfile] Profile ID: ${id}`);
        console.error(`❌ [updatePppProfile] Data sent:`, JSON.stringify(data, null, 2));
        throw new Error(`Gagal update profile di MikroTik: ${error?.message || 'Unknown error'}`);
    } finally {
        try {
            api.close();
            console.log(`🔌 [updatePppProfile] Connection closed`);
        } catch (closeError) {
            console.warn(`⚠️ [updatePppProfile] Error closing connection:`, closeError);
        }
    }
}

/**
 * Find PPP profile ID by name in MikroTik
 */
export async function findPppProfileIdByName(cfg: MikroTikConfig, name: string): Promise<string | null> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        const profiles = await api.write('/ppp/profile/print', [`?name=${name}`]);
        const rows = Array.isArray(profiles) ? profiles : [];
        if (rows.length > 0) {
            return rows[0]['.id'] || null;
        }
        return null;
    } finally {
        api.close();
    }
}

export async function deletePppProfile(cfg: MikroTikConfig, id: string): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        await api.write('/ppp/profile/remove', ['.id=' + id]);
    } finally {
        api.close();
    }
}

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

export async function getInterfaces(cfg: MikroTikConfig): Promise<InterfaceInfo[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000  // Increased timeout to 10 seconds for better reliability
    });

    try {
        console.log(`🔌 Attempting to connect to MikroTik at ${cfg.host}:${cfg.port} with user ${cfg.username}...`);
        await api.connect();
        console.log('✅ Connected to MikroTik successfully, fetching interfaces...');

        const result = await api.write('/interface/print');
        console.log(`📦 Raw result type: ${typeof result}, isArray: ${Array.isArray(result)}`);
        console.log(`📦 Raw result length: ${Array.isArray(result) ? result.length : 'N/A'}`);

        // Debug: Log raw result structure
        if (result && typeof result === 'object') {
            console.log(`📦 First item sample:`, Array.isArray(result) && result.length > 0 ? JSON.stringify(result[0]).substring(0, 200) : 'Empty array');
        }

        const rows = Array.isArray(result) ? result : [];

        if (rows.length === 0) {
            console.warn('⚠️ WARNING: No interfaces found in MikroTik response');
            console.warn('⚠️ This might mean:');
            console.warn('   1. MikroTik has no interfaces (unlikely)');
            console.warn('   2. API command returned empty array');
            console.warn('   3. Response format is unexpected');
            return []; // Return empty array instead of throwing
        } else {
            console.log(`✅ Successfully found ${rows.length} interfaces from MikroTik`);
            // Log interface names for debugging
            const names = rows.map((r: any) => r['name'] || r.name || 'unnamed').filter((n: string) => n !== 'unnamed');
            if (names.length > 0) {
                console.log(`📋 Interface names: ${names.join(', ')}`);
            }
        }

        const interfaces = rows.map((r: any) => {
            // Handle both property access methods (dot notation and bracket notation)
            const getName = () => {
                if (r['name']) return String(r['name']);
                if (r.name) return String(r.name);
                return '';
            };

            const name = getName();
            if (!name) {
                console.warn('⚠️ Found interface without name:', JSON.stringify(r).substring(0, 100));
            }

            return {
                '.id': String(r['.id'] ?? r['id'] ?? ''),
                name: name,
                type: String(r['type'] ?? r.type ?? ''),
                mtu: String(r['mtu'] ?? r.mtu ?? ''),
                actualMtu: String(r['actual-mtu'] ?? r.actualMtu ?? ''),
                l2mtu: String(r['l2mtu'] ?? r.l2mtu ?? ''),
                macAddress: String(r['mac-address'] ?? r.macAddress ?? ''),
                lastLinkUpTime: String(r['last-link-up-time'] ?? r.lastLinkUpTime ?? ''),
                linkDowns: String(r['link-downs'] ?? r.linkDowns ?? ''),
                rxByte: String(r['rx-byte'] ?? r.rxByte ?? ''),
                txByte: String(r['tx-byte'] ?? r.txByte ?? ''),
                rxPacket: String(r['rx-packet'] ?? r.rxPacket ?? ''),
                txPacket: String(r['tx-packet'] ?? r.txPacket ?? ''),
                rxDrop: String(r['rx-drop'] ?? r.rxDrop ?? ''),
                txDrop: String(r['tx-drop'] ?? r.txDrop ?? ''),
                txQueueDrop: String(r['tx-queue-drop'] ?? r.txQueueDrop ?? ''),
                rxError: String(r['rx-error'] ?? r.rxError ?? ''),
                txError: String(r['tx-error'] ?? r.txError ?? ''),
                disabled: String(r['disabled'] ?? r.disabled ?? ''),
                running: String(r['running'] ?? r.running ?? ''),
                comment: r['comment'] !== undefined ? String(r['comment']) : (r.comment !== undefined ? String(r.comment) : undefined)
            } as InterfaceInfo;
        }).filter((ifc: InterfaceInfo) => ifc.name && ifc.name.trim() !== ''); // Filter out interfaces without name

        console.log(`✅ Processed ${interfaces.length} valid interfaces (after filtering)`);
        return interfaces;
    } catch (error: any) {
        const errorMsg = error.message || String(error);
        console.error('❌ Error getting interfaces from MikroTik:', errorMsg);

        // Provide more detailed error message
        if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED')) {
            throw new Error(`Tidak dapat terhubung ke MikroTik di ${cfg.host}:${cfg.port}. Pastikan MikroTik dapat diakses dan port ${cfg.port} terbuka.`);
        } else if (errorMsg.includes('invalid user') || errorMsg.includes('password')) {
            throw new Error('Username atau password MikroTik salah. Periksa konfigurasi di Settings.');
        } else {
            throw new Error(`Gagal mengambil interface dari MikroTik: ${errorMsg}`);
        }
    } finally {
        try {
            api.close();
        } catch (err) {
            // Ignore close errors
        }
    }
}

export async function getInterfaceTraffic(cfg: MikroTikConfig, interfaceName: string): Promise<{
    rxByte: number;
    txByte: number;
    rxPacket: number;
    txPacket: number;
    rxDrop: number;
    txDrop: number;
    rxError: number;
    txError: number;
}> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        const [result] = await api.write('/interface/print', ['name=' + interfaceName]);
        if (result && Array.isArray(result) && result.length > 0) {
            const iface = result[0];
            return {
                rxByte: parseInt(iface['rx-byte'] || '0'),
                txByte: parseInt(iface['tx-byte'] || '0'),
                rxPacket: parseInt(iface['rx-packet'] || '0'),
                txPacket: parseInt(iface['tx-packet'] || '0'),
                rxDrop: parseInt(iface['rx-drop'] || '0'),
                txDrop: parseInt(iface['tx-drop'] || '0'),
                rxError: parseInt(iface['rx-error'] || '0'),
                txError: parseInt(iface['tx-error'] || '0')
            };
        }
        return {
            rxByte: 0, txByte: 0, rxPacket: 0, txPacket: 0,
            rxDrop: 0, txDrop: 0, rxError: 0, txError: 0
        };
    } finally {
        api.close();
    }
}

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

export async function getQueueTrees(cfg: MikroTikConfig): Promise<QueueTreeInfo[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        const [result] = await api.write('/queue/tree/print');
        return Array.isArray(result) ? result : [];
    } finally {
        api.close();
    }
}

export async function addIpAddress(cfg: MikroTikConfig, params: {
    interface: string;
    address: string; // e.g., 192.168.1.1/30
    comment?: string;
}): Promise<void> {
    console.log('=== ADDING IP ADDRESS TO MIKROTIK ===');
    console.log('Config:', { host: cfg.host, port: cfg.port, user: cfg.username });
    console.log('Params:', params);

    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 15000
    });

    console.log('Connecting to MikroTik...');

    try {
        await api.connect();
        console.log('Connected to MikroTik successfully');
        // Cek interface yang tersedia dulu
        console.log('Checking available interfaces...');
        const interfaces = await api.write('/interface/print');
        console.log('Available interfaces:', interfaces);

        // Cek apakah interface yang dipilih ada
        const interfaceExists = Array.isArray(interfaces) && interfaces.some((iface: any) => iface.name === params.interface);
        console.log(`Interface '${params.interface}' exists:`, interfaceExists);

        if (!interfaceExists) {
            throw new Error(`Interface '${params.interface}' tidak ditemukan di MikroTik. Interface yang tersedia: ${interfaces.map((i: any) => i.name).join(', ')}`);
        }

        // Cek apakah IP address sudah ada
        console.log('Checking if IP address already exists...');
        const existingAddresses = await api.write('/ip/address/print');
        const existingAddress = Array.isArray(existingAddresses) && existingAddresses.find((addr: any) =>
            addr.address === params.address
        );
        if (existingAddress) {
            console.log('IP address already exists, removing it first:', existingAddress);
            // Hapus IP address yang sudah ada
            await api.write('/ip/address/remove', [`=.id=${existingAddress['.id']}`]);
            console.log('Existing IP address removed successfully');
        }

        const args = [
            `=interface=${params.interface}`,
            `=address=${params.address}`
        ];
        if (params.comment) args.push(`=comment=${params.comment}`);

        console.log('Sending command: /ip/address/add with args:', args);

        try {
            const result = await api.write('/ip/address/add', args);
            console.log('RouterOS response:', result);
            console.log('RouterOS response type:', typeof result);
            console.log('RouterOS response length:', Array.isArray(result) ? result.length : 'not array');
            if (Array.isArray(result) && result.length > 0) {
                console.log('First result item:', result[0]);
            }
            console.log('IP address add command completed');
        } catch (addError: any) {
            console.error('Error during /ip/address/add command:', addError);
            console.error('Add error message:', addError.message);
            console.error('Add error code:', addError.code);
            throw addError;
        }

        // Test manual: coba tambah IP address dengan command yang lebih sederhana
        console.log('Testing manual IP address addition...');
        try {
            const testResult = await api.write('/ip/address/add', [
                `=interface=${params.interface}`,
                `=address=${params.address}`,
                `=comment=Test-${Date.now()}`
            ]);
            console.log('Manual test result:', testResult);
        } catch (testError: any) {
            console.error('Manual test failed:', testError);
        }

        // Verifikasi IP address berhasil ditambahkan
        console.log('Verifying IP address was added...');
        const addresses = await api.write('/ip/address/print');
        console.log('All IP addresses in MikroTik:', addresses);
        console.log('Looking for address:', params.address, 'on interface:', params.interface);

        const addedAddress = Array.isArray(addresses) && addresses.find((addr: any) =>
            addr.address === params.address && addr.interface === params.interface
        );
        console.log('IP address verification:', addedAddress ? 'SUCCESS' : 'FAILED');
        if (addedAddress) {
            console.log('Added IP details:', addedAddress);
        } else {
            console.log('IP address not found. Checking for similar addresses...');
            const similarAddresses = Array.isArray(addresses) && addresses.filter((addr: any) =>
                addr.interface === params.interface
            );
            console.log('Addresses on same interface:', similarAddresses);

            // Cek apakah ada IP dengan format yang mirip
            const similarFormat = Array.isArray(addresses) && addresses.filter((addr: any) =>
                addr.address && addr.address.includes('192.168.1')
            );
            console.log('IP addresses with similar format (192.168.1.x):', similarFormat);
        }

    } catch (error: any) {
        console.error('Error adding IP address to MikroTik:', error);
        console.error('Error message:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error));
        console.error('Error code:', error.code);
        console.error('Full error object:', error);
        throw new Error(`Failed to add IP address to MikroTik: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)}`);
    } finally {
        api.close();
    }
}

export async function addMangleRulesForClient(cfg: MikroTikConfig, params: {
    peerIp: string; // e.g., 192.168.1.2
    downloadMark: string; // e.g., 192.168.1.2
    uploadMark: string; // e.g., UP-192.168.1.2
}): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 8000
    });

    try {
        await api.connect();
        // Download marking: dst-address=peerIp
        await api.write('/ip/firewall/mangle/add', [
            `=chain=prerouting`,
            `=action=mark-packet`,
            `=new-packet-mark=${params.downloadMark}`,
            `=passthrough=yes`,
            `=dst-address=${params.peerIp}`
        ]);
        // Upload marking: src-address=peerIp
        await api.write('/ip/firewall/mangle/add', [
            `=chain=postrouting`,
            `=action=mark-packet`,
            `=new-packet-mark=${params.uploadMark}`,
            `=passthrough=yes`,
            `=src-address=${params.peerIp}`
        ]);
    } finally {
        api.close();
    }
}

export async function createClientQueues(cfg: MikroTikConfig, params: {
    clientName: string;
    parentDownload: string; // package parent download queue name
    parentUpload: string;   // package parent upload queue name
    downloadMark: string;
    uploadMark: string;
    downloadLimit: string; // e.g., "5M"
    uploadLimit: string;   // e.g., "5M"
}): Promise<void> {
    // Create download child queue
    await createQueueTree(cfg, {
        name: `${params.clientName}_DOWNLOAD`,
        parent: params.parentDownload,
        packetMarks: params.downloadMark,
        maxLimit: params.downloadLimit,
        comment: `Download queue for ${params.clientName}`
    });
    // Create upload child queue
    await createQueueTree(cfg, {
        name: `${params.clientName}_UPLOAD`,
        parent: params.parentUpload,
        packetMarks: params.uploadMark,
        maxLimit: params.uploadLimit,
        comment: `Upload queue for ${params.clientName}`
    });
}


export async function createQueueTree(cfg: MikroTikConfig, data: {
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
}): Promise<void> {

    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        // Check if queue already exists
        const existingQueues = await api.write('/queue/tree/print');
        const existingQueue = existingQueues.find((q: any) => q.name === data.name);

        if (existingQueue) {
            console.log(`Queue tree with name "${data.name}" already exists, skipping creation`);
            return;
        }

        const queueData: any = {
            name: data.name,
            parent: data.parent || 'DOWNLOAD ALL',
            'max-limit': data.maxLimit || '5M'
        };

        if (data.packetMarks) queueData['packet-mark'] = data.packetMarks;
        if (data.limitAt) queueData['limit-at'] = data.limitAt;
        if (data.burstLimit) queueData['burst-limit'] = data.burstLimit;
        if (data.burstThreshold) queueData['burst-threshold'] = data.burstThreshold;
        if (data.burstTime) queueData['burst-time'] = data.burstTime;
        if (data.priority) queueData.priority = data.priority;
        if (data.disabled !== undefined) queueData.disabled = data.disabled;

        const params: string[] = [];
        for (const [key, value] of Object.entries(queueData)) {
            if (value !== undefined && value !== null && String(value) !== '') {
                params.push(`=${key}=${value}`);
            }
        }
        const result = await api.write('/queue/tree/add', params);

    } catch (error: any) {
        console.error('Error creating queue tree:', error);
        throw new Error(`Failed to create queue tree: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)}`);
    } finally {
        api.close();
    }
}


export async function updateQueueTree(cfg: MikroTikConfig, id: string, data: {
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
}): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        const dataArray = Object.entries(data).map(([key, value]) => `${key}=${value}`);
        await api.write('/queue/tree/set', ['.id=' + id, ...dataArray]);
    } finally {
        api.close();
    }
}

export async function deleteQueueTree(cfg: MikroTikConfig, id: string): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        await api.write('/queue/tree/remove', ['.id=' + id]);
    } finally {
        api.close();
    }
}


// Helper: temukan ID queue tree berdasarkan nama
export async function findQueueTreeIdByName(cfg: MikroTikConfig, name: string): Promise<string | null> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000
    });

    try {
        await api.connect();
        const results: any[] = await api.write('/queue/tree/print', []);
        const found = (Array.isArray(results) ? results : []).find((q: any) => q.name === name);
        return found ? String(found['.id'] || found.id || '') : null;
    } finally {
        api.close();
    }
}

export async function deleteQueueTreeByName(cfg: MikroTikConfig, name: string): Promise<void> {
    const id = await findQueueTreeIdByName(cfg, name);
    if (!id) return;
    await deleteQueueTree(cfg, id);
}

// IP Address helpers
export async function removeIpAddress(cfg: MikroTikConfig, address: string): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 8000
    });

    try {
        await api.connect();
        const list: any[] = await api.write('/ip/address/print');
        const row = (Array.isArray(list) ? list : []).find((r: any) => r.address === address);
        const id = row ? (row['.id'] || row.id) : null;
        if (id) {
            await api.write('/ip/address/remove', ['.id=' + id]);
        }
    } finally {
        api.close();
    }
}

// Mangle helpers
export async function removeMangleRulesForClient(cfg: MikroTikConfig, params: {
    peerIp: string;
    downloadMark?: string;
    uploadMark?: string;
}): Promise<void> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 8000
    });

    try {
        await api.connect();
        const list: any[] = await api.write('/ip/firewall/mangle/print');
        const items = Array.isArray(list) ? list : [];
        const candidates = items.filter((r: any) => {
            const mark = r['new-packet-mark'] || r['packet-mark'] || '';
            const src = r['src-address'] || '';
            const dst = r['dst-address'] || '';
            return mark === params.downloadMark || mark === params.uploadMark || src === params.peerIp || dst === params.peerIp;
        });
        for (const row of candidates) {
            const id = row['.id'] || row.id;
            if (id) await api.write('/ip/firewall/mangle/remove', ['.id=' + id]);
        }
    } finally {
        api.close();
    }
}

export async function deleteClientQueuesByClientName(cfg: MikroTikConfig, clientName: string): Promise<void> {
    await deleteQueueTreeByName(cfg, `${clientName}_DOWNLOAD`);
    await deleteQueueTreeByName(cfg, `${clientName}_UPLOAD`);
}

// ===== CONNECTION MONITORING HELPERS =====

/**
 * Get PPPoE active connections with bandwidth stats
 */
export async function getPppoeActiveConnections(cfg: MikroTikConfig): Promise<PppoeActiveConnection[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const connections = await api.write('/ppp/active/print');
        return Array.isArray(connections) ? connections as PppoeActiveConnection[] : [];
    } finally {
        api.close();
    }
}

/**
 * Delete PPPoE secret from MikroTik by username/name
 */
export async function deletePppoeSecret(cfg: MikroTikConfig, username: string): Promise<void> {
    const port = cfg.port || 8728;
    const api = new RouterOSAPI({
        host: cfg.host,
        port: port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        console.log(`🔄 Deleting PPPoE secret: ${username}`);
        await api.connect();

        // Find secret by username
        const secretId = await findPppoeSecretIdByName(cfg, username);
        if (!secretId) {
            console.log(`⚠️ PPPoE secret "${username}" tidak ditemukan di MikroTik, skip deletion`);
            return;
        }

        console.log(`   Found secret ID: ${secretId}`);
        await api.write('/ppp/secret/remove', [`=.id=${secretId}`]);
        console.log(`✅ PPPoE secret "${username}" berhasil dihapus dari MikroTik`);
    } catch (error: any) {
        console.error(`❌ Failed to delete PPPoE secret "${username}":`);
        console.error(`   Error message: ${error.message}`);
        throw error;
    } finally {
        try {
            api.close();
        } catch (closeError) {
            console.error('Error closing API connection:', closeError);
        }
    }
}

/**
 * Get PPPoE secrets (users) for monitoring
 */
export async function getPppoeSecrets(cfg: MikroTikConfig): Promise<PppoeSecret[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const secrets = await api.write('/ppp/secret/print');
        return Array.isArray(secrets) ? secrets as PppoeSecret[] : [];
    } finally {
        api.close();
    }
}

/**
 * Find PPPoE secret ID by username
 */
export async function findPppoeSecretIdByName(cfg: MikroTikConfig, username: string): Promise<string | null> {
    const port = cfg.port || 8728; // Default port jika tidak ada
    const api = new RouterOSAPI({
        host: cfg.host,
        port: port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000 // Increased timeout for reliability
    });

    try {
        await api.connect();
        const secrets = await api.write('/ppp/secret/print', [`?name=${username}`]);
        const rows = Array.isArray(secrets) ? secrets : [];
        if (rows.length > 0) {
            return rows[0]['.id'] || null;
        }
        return null;
    } catch (error: any) {
        console.error(`❌ Failed to find PPPoE secret "${username}":`, error.message);
        return null;
    } finally {
        try {
            api.close();
        } catch (closeError) {
            console.error('Error closing API connection:', closeError);
        }
    }
}

/**
 * Create PPPoE secret in MikroTik
 */
export async function createPppoeSecret(cfg: MikroTikConfig, data: {
    name: string;
    password: string;
    profile?: string;
    comment?: string;
    disabled?: boolean;
}): Promise<void> {
    const port = cfg.port || 8728; // Default port jika tidak ada
    const api = new RouterOSAPI({
        host: cfg.host,
        port: port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000 // Increased timeout for reliability
    });

    try {
        console.log(`🔄 Creating PPPoE secret: ${data.name}`);
        console.log(`   Host: ${cfg.host}:${port}`);
        console.log(`   Username: ${cfg.username}`);
        console.log(`   Profile: ${data.profile || 'default'}`);
        console.log(`   Password: ${data.password ? '***' : 'NOT SET'}`);

        await api.connect();
        console.log(`   ✅ Connected to MikroTik`);

        // Build params array - format yang benar untuk routeros-api
        // Format: ['/command', '=param1=value1', '=param2=value2', ...]
        const params: string[] = [];
        params.push(`=name=${data.name}`);
        params.push(`=password=${data.password}`);

        // Hanya tambahkan profile jika ada dan tidak kosong
        if (data.profile && data.profile.trim() !== '') {
            params.push(`=profile=${data.profile}`);
            console.log(`   📌 Using profile: "${data.profile}"`);
        } else {
            console.log(`   ⚠️ No profile specified, secret will be created without profile`);
        }

        if (data.comment) {
            // Comment tidak perlu escape, langsung pakai
            params.push(`=comment=${data.comment}`);
        }
        if (data.disabled !== undefined) {
            params.push(`=disabled=${data.disabled ? 'yes' : 'no'}`);
        }

        console.log(`   📤 Sending command: /ppp/secret/add`);
        console.log(`   📤 Params array:`, params);
        console.log(`   📤 Params count: ${params.length}`);
        console.log(`   📤 Full command: ['/ppp/secret/add', ...${params.length} params]`);

        try {
            console.log(`   🔄 Executing write command...`);
            // Try format: api.write('/ppp/secret/add', params)
            const result = await api.write('/ppp/secret/add', params);
            console.log(`   📥 Response type:`, typeof result);
            console.log(`   📥 Response:`, JSON.stringify(result, null, 2));

            // Check if result indicates success or error
            if (result && typeof result === 'object') {
                if ('ret' in result && result.ret === '') {
                    console.log(`   ✅ Command executed successfully (ret is empty string)`);
                } else if (Array.isArray(result) && result.length > 0) {
                    console.log(`   ✅ Command executed successfully (array response)`);
                } else {
                    console.log(`   ⚠️ Unexpected response format:`, result);
                }
            }

            // Verify the secret was created
            console.log(`   🔍 Verifying secret creation...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            // Create new connection for verification
            const verifyApi = new RouterOSAPI({
                host: cfg.host,
                port: port,
                user: cfg.username,
                password: cfg.password,
                timeout: 10000
            });

            try {
                await verifyApi.connect();
                const verifySecrets = await verifyApi.write('/ppp/secret/print', [`?name=${data.name}`]);
                const verifyRows = Array.isArray(verifySecrets) ? verifySecrets : [];

                if (verifyRows.length > 0) {
                    const secretId = verifyRows[0]['.id'] || null;
                    console.log(`✅ PPPoE secret "${data.name}" berhasil dibuat dan diverifikasi di MikroTik (ID: ${secretId})`);
                    console.log(`   Secret details:`, {
                        id: secretId,
                        name: verifyRows[0].name,
                        profile: verifyRows[0].profile || 'N/A',
                        comment: verifyRows[0].comment || 'N/A'
                    });
                } else {
                    console.warn(`⚠️ PPPoE secret "${data.name}" dibuat tapi tidak ditemukan saat verifikasi`);
                    console.warn(`   Response was:`, result);
                }
                verifyApi.close();
            } catch (verifyError: any) {
                console.error(`   ⚠️ Error during verification:`, verifyError.message);
                verifyApi.close();
            }
        } catch (writeError: any) {
            console.error(`   ❌ Error saat write command:`);
            console.error(`   ❌ Error type:`, typeof writeError);
            console.error(`   ❌ Error message:`, writeError.message);
            console.error(`   ❌ Error code:`, writeError.code);
            console.error(`   ❌ Error name:`, writeError.name);
            if (writeError.stack) {
                console.error(`   ❌ Error stack:`, writeError.stack);
            }
            if (writeError.response) {
                console.error(`   ❌ Error response:`, writeError.response);
            }
            if (writeError.request) {
                console.error(`   ❌ Error request:`, writeError.request);
            }
            throw writeError;
        }
    } catch (error: any) {
        console.error(`❌ Failed to create PPPoE secret "${data.name}":`);
        console.error(`   Error message: ${error.message}`);
        console.error(`   Error code: ${error.code || 'N/A'}`);
        console.error(`   Error stack:`, error.stack);
        console.error(`   Config used:`, {
            host: cfg.host,
            port: port,
            username: cfg.username,
            password: '***'
        });
        throw error;
    } finally {
        try {
            api.close();
        } catch (closeError) {
            console.error('Error closing API connection:', closeError);
        }
    }
}

/**
 * Update PPPoE secret in MikroTik
 */
export async function updatePppoeSecret(cfg: MikroTikConfig, username: string, data: {
    name?: string;
    password?: string;
    profile?: string;
    comment?: string;
    disabled?: boolean;
}): Promise<void> {
    const port = cfg.port || 8728; // Default port jika tidak ada
    const api = new RouterOSAPI({
        host: cfg.host,
        port: port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000 // Increased timeout for reliability
    });

    try {
        console.log(`🔄 Updating PPPoE secret: ${username}`);
        console.log(`   Host: ${cfg.host}:${port}`);
        console.log(`   Update data:`, data);
        await api.connect();
        console.log(`   ✅ Connected to MikroTik`);

        // Find secret by username
        const secretId = await findPppoeSecretIdByName(cfg, username);
        if (!secretId) {
            throw new Error(`PPPoE secret dengan username "${username}" tidak ditemukan di MikroTik`);
        }

        console.log(`   Found secret ID: ${secretId}`);
        const params: string[] = [`=.id=${secretId}`];
        if (data.name !== undefined) params.push(`=name=${data.name}`);
        if (data.password !== undefined) params.push(`=password=${data.password}`);
        if (data.profile !== undefined) params.push(`=profile=${data.profile}`);
        if (data.comment !== undefined) params.push(`=comment=${data.comment}`);
        if (data.disabled !== undefined) params.push(`=disabled=${data.disabled ? 'yes' : 'no'}`);

        console.log(`   📤 Sending params:`, params);
        const result = await api.write('/ppp/secret/set', params);
        console.log(`   📥 Response:`, result);
        console.log(`✅ PPPoE secret "${username}" berhasil di-update di MikroTik`);
    } catch (error: any) {
        console.error(`❌ Failed to update PPPoE secret "${username}":`);
        console.error(`   Error message: ${error.message}`);
        console.error(`   Error code: ${error.code || 'N/A'}`);
        console.error(`   Error stack:`, error.stack);
        throw error;
    } finally {
        try {
            api.close();
        } catch (closeError) {
            console.error('Error closing API connection:', closeError);
        }
    }
}

/**
 * Get interface traffic monitoring data
 */
export async function getInterfaceTrafficMonitoring(cfg: MikroTikConfig, interfaceName?: string): Promise<any[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        let command = '/interface/monitor-traffic';
        if (interfaceName) {
            command += ` interface=${interfaceName}`;
        }

        const traffic = await api.write(command);
        return Array.isArray(traffic) ? traffic : [];
    } finally {
        api.close();
    }
}

/**
 * Get queue tree statistics for bandwidth monitoring
 */
export async function getQueueTreeStats(cfg: MikroTikConfig): Promise<any[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const queues = await api.write('/queue/tree/print');
        return Array.isArray(queues) ? queues : [];
    } finally {
        api.close();
    }
}

/**
 * Get IP addresses with interface information
 */
export async function getIpAddresses(cfg: MikroTikConfig): Promise<any[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const addresses = await api.write('/ip/address/print');
        return Array.isArray(addresses) ? addresses : [];
    } finally {
        api.close();
    }
}

/**
 * Get system resource information
 */
export async function getSystemResources(cfg: MikroTikConfig): Promise<any> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const resources = await api.write('/system/resource/print');
        return Array.isArray(resources) && resources.length > 0 ? resources[0] : {};
    } finally {
        api.close();
    }
}

/**
 * Get interface list for monitoring
 */
export async function getInterfacesForMonitoring(cfg: MikroTikConfig): Promise<any[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const interfaces = await api.write('/interface/print');
        return Array.isArray(interfaces) ? interfaces : [];
    } finally {
        api.close();
    }
}

/**
 * Get PPPoE server statistics
 */
export async function getPppoeServerStats(cfg: MikroTikConfig): Promise<PppoeServerStats[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 10000
    });

    try {
        await api.connect();
        const servers = await api.write('/interface/pppoe-server/print');
        return Array.isArray(servers) ? servers as PppoeServerStats[] : [];
    } finally {
        api.close();
    }
}

/**
 * Get system health information (temperature, voltage, etc.)
 */
export async function getSystemHealth(cfg: MikroTikConfig): Promise<any[]> {
    const api = new RouterOSAPI({
        host: cfg.host,
        user: cfg.username,
        password: cfg.password,
        port: cfg.port,
        timeout: 5000
    });

    try {
        await api.connect();
        const health = await api.write('/system/health/print');
        return Array.isArray(health) ? health : [];
    } catch (err) {
        console.error('Error fetching system health:', err);
        return [];
    } finally {
        api.close();
    }
}
