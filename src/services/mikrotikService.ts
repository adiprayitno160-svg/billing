import { RouterOSAPI } from 'routeros-api';

export type MikroTikConfig = {
	host: string;
	port: number;
	username: string;
	password: string;
	use_tls: boolean;
};

export async function testMikrotikConnection(cfg: MikroTikConfig): Promise<{connected: boolean, error?: string}> {
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
    const profiles = await api.write('/ppp/profile/print');
    const rows = Array.isArray(profiles) ? profiles : [];
    
    console.log('📊 Raw MikroTik Profile Data:', JSON.stringify(rows[0], null, 2));
    
    // Parse rate-limit field (format: "rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]")
    // Example: "10M/2M 20M/4M 15M/3M 10s/10s 8"
    
    return rows.map((r: any) => {
        const rateLimit = r['rate-limit'] || '';
        let rate_limit_rx = '';
        let rate_limit_tx = '';
        let burst_limit_rx = '';
        let burst_limit_tx = '';
        let burst_threshold_rx = '';
        let burst_threshold_tx = '';
        let burst_time_rx = '';
        let burst_time_tx = '';
        
        if (rateLimit) {
            const parts = rateLimit.split(' ');
            
            // Parse rx-rate/tx-rate (first part)
            if (parts[0]) {
                const rates = parts[0].split('/');
                rate_limit_rx = rates[0] || '';
                rate_limit_tx = rates[1] || '';
            }
            
            // Parse burst-rate (second part)
            if (parts[1]) {
                const bursts = parts[1].split('/');
                burst_limit_rx = bursts[0] || '';
                burst_limit_tx = bursts[1] || '';
            }
            
            // Parse burst-threshold (third part)
            if (parts[2]) {
                const thresholds = parts[2].split('/');
                burst_threshold_rx = thresholds[0] || '';
                burst_threshold_tx = thresholds[1] || '';
            }
            
            // Parse burst-time (fourth part)
            if (parts[3]) {
                const times = parts[3].split('/');
                burst_time_rx = times[0] || '';
                burst_time_tx = times[1] || '';
            }
        }
        
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
		await api.write('/ppp/profile/set', ['.id=' + id, ...dataArray]);
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
			timeout: 5000
		});
		
    try {
		await api.connect();
        const result = await api.write('/interface/print');
        const rows = Array.isArray(result) ? result : [];
        return rows.map((r: any) => ({
            '.id': String(r['.id'] ?? ''),
            name: String(r['name'] ?? ''),
            type: String(r['type'] ?? ''),
            mtu: String(r['mtu'] ?? ''),
            actualMtu: String(r['actual-mtu'] ?? ''),
            l2mtu: String(r['l2mtu'] ?? ''),
            macAddress: String(r['mac-address'] ?? ''),
            lastLinkUpTime: String(r['last-link-up-time'] ?? ''),
            linkDowns: String(r['link-downs'] ?? ''),
            rxByte: String(r['rx-byte'] ?? ''),
            txByte: String(r['tx-byte'] ?? ''),
            rxPacket: String(r['rx-packet'] ?? ''),
            txPacket: String(r['tx-packet'] ?? ''),
            rxDrop: String(r['rx-drop'] ?? ''),
            txDrop: String(r['tx-drop'] ?? ''),
            txQueueDrop: String(r['tx-queue-drop'] ?? ''),
            rxError: String(r['rx-error'] ?? ''),
            txError: String(r['tx-error'] ?? ''),
            disabled: String(r['disabled'] ?? ''),
            running: String(r['running'] ?? ''),
            comment: r['comment'] !== undefined ? String(r['comment']) : undefined
        } as InterfaceInfo));
    } finally {
		api.close();
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
export async function getPppoeActiveConnections(cfg: MikroTikConfig): Promise<any[]> {
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
        return Array.isArray(connections) ? connections : [];
    } finally {
        api.close();
    }
}

/**
 * Get PPPoE secrets (users) for monitoring
 */
export async function getPppoeSecrets(cfg: MikroTikConfig): Promise<any[]> {
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
        return Array.isArray(secrets) ? secrets : [];
    } finally {
        api.close();
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
export async function getPppoeServerStats(cfg: MikroTikConfig): Promise<any> {
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
        return Array.isArray(servers) ? servers : [];
    } finally {
        api.close();
    }
}

