import { databasePool } from '../db/pool';
import { getPppProfiles, createPppProfile, updatePppProfile, deletePppProfile, findPppProfileIdByName, PppProfile, MikroTikConfig } from './mikrotikService';

export type PppoeProfile = {
	id: number;
	name: string;
	remote_address_pool?: string;
	local_address?: string;
	dns_server?: string;
	session_timeout?: string;
	idle_timeout?: string;
	only_one?: string;
	change_tcp_mss?: string;
	use_compression?: string;
	use_encryption?: string;
	use_mpls?: string;
	use_upnp?: string;
	comment?: string;
	created_at: Date;
	updated_at: Date;
};

export type PppoePackage = {
	id: number;
	name: string;
	profile_id?: number;
	price: number;
	duration_days: number;
	status: 'active' | 'inactive';
	description?: string;
	rate_limit_rx?: string;
	rate_limit_tx?: string;
	burst_limit_rx?: string;
	burst_limit_tx?: string;
	burst_threshold_rx?: string;
	burst_threshold_tx?: string;
	burst_time_rx?: string;
	burst_time_tx?: string;
	price_7_days?: number;  // ADDED for prepaid
	price_14_days?: number; // ADDED for prepaid
	price_30_days?: number; // ADDED for prepaid
	is_enabled_7_days?: number;
	is_enabled_14_days?: number;
	is_enabled_30_days?: number;
	max_clients?: number;
	limit_at_rx?: string;
	limit_at_tx?: string;
	limit_at_download?: string;
	limit_at_upload?: string;
	created_at: Date;
	updated_at: Date;
	profile?: PppoeProfile;
};

export async function getMikrotikConfig(): Promise<MikroTikConfig | null> {
	// console.log('[getMikrotikConfig] Requesting config...');
	try {
		const [rows] = await databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
		const settings = Array.isArray(rows) && rows.length ? rows[0] as any : null;

		// console.log('[getMikrotikConfig] Config found:', !!settings);
		if (!settings) return null;

		return {
			host: settings.host,
			port: settings.port,
			username: settings.username,
			password: settings.password,
			use_tls: Boolean(settings.use_tls)
		};
	} catch (error) {
		console.error('[getMikrotikConfig] Error:', error);
		return null;
	}
}

export async function syncProfilesFromMikrotik(): Promise<{ synced: number; errors: string[] }> {
	console.log('=== STARTING PPPoE PROFILES SYNC ===');

	const config = await getMikrotikConfig();
	if (!config) {
		console.error('❌ Konfigurasi MikroTik tidak ditemukan');
		throw new Error('Konfigurasi MikroTik tidak ditemukan');
	}

	console.log('✅ Konfigurasi MikroTik ditemukan:', { host: config.host, port: config.port, username: config.username });

	try {
		console.log('📡 Mengambil profil PPPoE dari MikroTik...');
		const profiles = await getPppProfiles(config);
		console.log(`✅ Berhasil mengambil ${profiles.length} profil dari MikroTik`);

		const conn = await databasePool.getConnection();
		const errors: string[] = [];
		let synced = 0;

		try {
			await conn.beginTransaction();
			console.log('🔄 Memulai transaksi database...');

			for (const profile of profiles) {
				try {
					console.log(`📝 Memproses profil: ${profile.name}`);
					console.log(`  📊 Burst Data:`, {
						'burst-limit-rx': profile['burst-limit-rx'] || 'EMPTY',
						'burst-limit-tx': profile['burst-limit-tx'] || 'EMPTY',
						'burst-threshold-rx': profile['burst-threshold-rx'] || 'EMPTY',
						'burst-threshold-tx': profile['burst-threshold-tx'] || 'EMPTY',
						'burst-time-rx': profile['burst-time-rx'] || 'EMPTY',
						'burst-time-tx': profile['burst-time-tx'] || 'EMPTY'
					});

					// Check if profile exists
					const [existing] = await conn.execute(
						'SELECT id FROM pppoe_profiles WHERE name = ?',
						[profile.name]
					);

					const exists = Array.isArray(existing) && existing.length > 0;

					if (exists) {
						console.log(`🔄 Update profil yang sudah ada: ${profile.name}`);
						// Update existing profile with rate limiting data
						await conn.execute(`
							UPDATE pppoe_profiles SET 
								remote_address_pool = ?, local_address = ?, dns_server = ?,
								session_timeout = ?, idle_timeout = ?, only_one = ?,
								change_tcp_mss = ?, use_compression = ?, use_encryption = ?,
								use_mpls = ?, use_upnp = ?, comment = ?,
								rate_limit = ?, rate_limit_rx = ?, rate_limit_tx = ?,
								burst_limit_rx = ?, burst_limit_tx = ?,
								burst_threshold_rx = ?, burst_threshold_tx = ?,
								burst_time_rx = ?, burst_time_tx = ?,
								updated_at = NOW()
							WHERE name = ?
						`, [
							profile['remote-address'] || null,
							profile['local-address'] || null,
							profile['dns-server'] || null,
							profile['session-timeout'] || null,
							profile['idle-timeout'] || null,
							profile['only-one'] || null,
							profile['change-tcp-mss'] || null,
							profile['use-compression'] || null,
							profile['use-encryption'] || null,
							profile['use-mpls'] || null,
							profile['use-upnp'] || null,
							profile.comment || null,
							profile['rate-limit'] || null,
							profile['rate-limit-rx'] || null,
							profile['rate-limit-tx'] || null,
							profile['burst-limit-rx'] || null,
							profile['burst-limit-tx'] || null,
							profile['burst-threshold-rx'] || null,
							profile['burst-threshold-tx'] || null,
							profile['burst-time-rx'] || null,
							profile['burst-time-tx'] || null,
							profile.name
						]);
					} else {
						console.log(`➕ Insert profil baru: ${profile.name}`);
						// Insert new profile with rate limiting data
						await conn.execute(`
							INSERT INTO pppoe_profiles 
							(name, remote_address_pool, local_address, dns_server, session_timeout, 
							 idle_timeout, only_one, change_tcp_mss, use_compression, use_encryption, 
							 use_mpls, use_upnp, comment, rate_limit, rate_limit_rx, rate_limit_tx,
							 burst_limit_rx, burst_limit_tx, burst_threshold_rx, burst_threshold_tx,
							 burst_time_rx, burst_time_tx)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						`, [
							profile.name,
							profile['remote-address'] || null,
							profile['local-address'] || null,
							profile['dns-server'] || null,
							profile['session-timeout'] || null,
							profile['idle-timeout'] || null,
							profile['only-one'] || null,
							profile['change-tcp-mss'] || null,
							profile['use-compression'] || null,
							profile['use-encryption'] || null,
							profile['use-mpls'] || null,
							profile['use-upnp'] || null,
							profile.comment || null,
							profile['rate-limit'] || null,
							profile['rate-limit-rx'] || null,
							profile['rate-limit-tx'] || null,
							profile['burst-limit-rx'] || null,
							profile['burst-limit-tx'] || null,
							profile['burst-threshold-rx'] || null,
							profile['burst-threshold-tx'] || null,
							profile['burst-time-rx'] || null,
							profile['burst-time-tx'] || null
						]);
					}
					synced++;
					console.log(`✅ Profil ${profile.name} berhasil di-sync`);
				} catch (error: any) {
					const errorMsg = `Gagal sync profil ${profile.name}: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)}`;
					console.error(`❌ ${errorMsg}`);
					errors.push(errorMsg);
				}
			}

			await conn.commit();
			console.log('✅ Transaksi database berhasil di-commit');
		} catch (error: any) {
			console.error('❌ Error dalam transaksi database, melakukan rollback...');
			await conn.rollback();
			throw error;
		} finally {
			conn.release();
		}

		console.log(`=== SYNC COMPLETED ===`);
		console.log(`✅ Total profil yang berhasil di-sync: ${synced}`);
		console.log(`❌ Total error: ${errors.length}`);
		if (errors.length > 0) {
			console.log('Error details:', errors);
		}

		return { synced, errors };
	} catch (error: any) {
		console.error('❌ Error dalam sinkronisasi profil PPPoE:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error));
		throw error;
	}
}

export async function listProfiles(): Promise<PppoeProfile[]> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(`
			SELECT id, name, local_address, remote_address_pool, dns_server, 
			rate_limit, rate_limit_rx, rate_limit_tx,
			burst_limit_rx, burst_limit_tx, 
			burst_threshold_rx, burst_threshold_tx,
			burst_time_rx, burst_time_tx,
			only_one, change_tcp_mss, use_compression, use_encryption, 
			use_mpls, use_upnp, comment, session_timeout, idle_timeout,
			keepalive_timeout, status, created_at, updated_at
			FROM pppoe_profiles 
			ORDER BY name ASC
		`);
		return Array.isArray(rows) ? rows as PppoeProfile[] : [];
	} finally {
		conn.release();
	}
}

export async function getProfileById(id: number): Promise<PppoeProfile | null> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(
			'SELECT * FROM pppoe_profiles WHERE id = ?',
			[id]
		);
		const result = Array.isArray(rows) && rows.length ? rows[0] as PppoeProfile : null;
		return result;
	} finally {
		conn.release();
	}
}

export async function listPackages(): Promise<PppoePackage[]> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(`
			SELECT p.*,
			pr.name as profile_name,
			pr.remote_address_pool,
			pr.local_address,
			pr.rate_limit_rx as profile_rate_limit_rx,
			pr.rate_limit_tx as profile_rate_limit_tx,
			COUNT(s.id) as current_clients,
			(COUNT(s.id) >= p.max_clients) as is_full
			FROM pppoe_packages p
			LEFT JOIN pppoe_profiles pr ON p.profile_id = pr.id
			LEFT JOIN subscriptions s ON p.id = s.package_id AND s.status = 'active'
			GROUP BY p.id
			ORDER BY p.name ASC
			`);
		const packages = Array.isArray(rows) ? rows as any[] : [];

		// Update rate limit dari profile untuk setiap paket yang punya profile_id
		packages.forEach((pkg: any) => {
			if (pkg.profile_id) {
				// Prioritize Package's own limit. If not set (null/empty), fallback to Profile's limit.
				pkg.rate_limit_rx = pkg.rate_limit_rx || pkg.profile_rate_limit_rx || '0';
				pkg.rate_limit_tx = pkg.rate_limit_tx || pkg.profile_rate_limit_tx || '0';
			}
		});

		return packages;
	} finally {
		conn.release();
	}
}

export async function getPackageById(id: number): Promise<PppoePackage | null> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(`
			SELECT p.*,
			pr.name as profile_name,
			pr.remote_address_pool,
			pr.local_address,
			pr.rate_limit_rx as profile_rate_limit_rx,
			pr.rate_limit_tx as profile_rate_limit_tx,
			pr.burst_limit_rx as profile_burst_limit_rx,
			pr.burst_limit_tx as profile_burst_limit_tx,
			pr.burst_threshold_rx as profile_burst_threshold_rx,
			pr.burst_threshold_tx as profile_burst_threshold_tx,
			pr.burst_time_rx as profile_burst_time_rx,
			pr.burst_time_tx as profile_burst_time_tx
			FROM pppoe_packages p
			LEFT JOIN pppoe_profiles pr ON p.profile_id = pr.id
			WHERE p.id = ?
			`, [id]);
		const result = Array.isArray(rows) && rows.length ? rows[0] as PppoePackage : null;

		// Jika paket punya profile_id, gunakan rate limit dari profile KECUALI paket punya override sendiri
		if (result && (result as any).profile_id) {
			// Update rate limit (Priority: Package > Profile)
			(result as any).rate_limit_rx = (result as any).rate_limit_rx || (result as any).profile_rate_limit_rx || '0';
			(result as any).rate_limit_tx = (result as any).rate_limit_tx || (result as any).profile_rate_limit_tx || '0';

			// Burst limits (Priority: Package > Profile)
			(result as any).burst_limit_rx = (result as any).burst_limit_rx || (result as any).profile_burst_limit_rx || null;
			(result as any).burst_limit_tx = (result as any).burst_limit_tx || (result as any).profile_burst_limit_tx || null;

			(result as any).burst_threshold_rx = (result as any).burst_threshold_rx || (result as any).profile_burst_threshold_rx || null;
			(result as any).burst_threshold_tx = (result as any).burst_threshold_tx || (result as any).profile_burst_threshold_tx || null;

			(result as any).burst_time_rx = (result as any).burst_time_rx || (result as any).profile_burst_time_rx || null;
			(result as any).burst_time_tx = (result as any).burst_time_tx || (result as any).profile_burst_time_tx || null;
		}

		return result;
	} finally {
		conn.release();
	}
}

export async function createPackage(data: {
	name: string;
	profile_id?: number;
	price: number;
	duration_days: number;
	auto_activation?: number;
	status: 'active' | 'inactive';
	description?: string;
	rate_limit_rx?: string;
	rate_limit_tx?: string;
	burst_limit_rx?: string;
	burst_limit_tx?: string;
	burst_threshold_rx?: string;
	burst_threshold_tx?: string;
	burst_time_rx?: string;
	burst_time_tx?: string;
	price_7_days?: number;  // ADDED for prepaid
	price_14_days?: number; // ADDED for prepaid
	price_30_days?: number; // ADDED for prepaid
	is_enabled_7_days?: number;
	is_enabled_14_days?: number;
	is_enabled_30_days?: number;
	max_clients?: number;
	priority?: number;
	limit_at_download?: string;
	limit_at_upload?: string;
}): Promise<number> {
	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction(); // START TRANSACTION EARLY

		// 1. AUTO-CREATE / FIND PROFILE IF NOT PROVIDED
		if (!data.profile_id) {
			// Check if profile exists in DB
			const [existingProfiles] = await conn.execute(
				'SELECT id FROM pppoe_profiles WHERE name = ?',
				[data.name]
			);

			if (Array.isArray(existingProfiles) && existingProfiles.length > 0) {
				// Use existing profile
				data.profile_id = (existingProfiles[0] as any).id;
				console.log(`[PPPoE] Found existing profile for package "${data.name}" (ID: ${data.profile_id})`);
			} else {
				// Create new profile in DB
				const [pResult] = await conn.execute(`
                    INSERT INTO pppoe_profiles (name, created_at, updated_at) 
                    VALUES (?, NOW(), NOW())
                `, [data.name]);

				data.profile_id = (pResult as any).insertId;
				console.log(`[PPPoE] Created new DB profile for package "${data.name}" (ID: ${data.profile_id})`);

				// Ensure it exists in MikroTik (will be handled by sync logic below or created here)
				try {
					const config = await getMikrotikConfig();
					if (config) {
						const { createPppProfile, findPppProfileIdByName } = await import('./mikrotikService');
						const mkId = await findPppProfileIdByName(config, data.name);
						if (!mkId) {
							await createPppProfile(config, { name: data.name });
							console.log(`[PPPoE] Created new MikroTik Profile "${data.name}"`);
						}
					}
				} catch (mkErr: any) {
					console.error(`[PPPoE] Failed to auto-create MikroTik Profile "${data.name}":`, mkErr.message);
				}
			}
		}

		// Insert package to database
		const [result] = await conn.execute(`
			INSERT INTO pppoe_packages
			(name, profile_id, price, duration_days, auto_activation, status, description,
				rate_limit_rx, rate_limit_tx, burst_limit_rx, burst_limit_tx,
				burst_threshold_rx, burst_threshold_tx, burst_time_rx, burst_time_tx,
				price_7_days, price_14_days, price_30_days, 
                is_enabled_7_days, is_enabled_14_days, is_enabled_30_days,
                max_clients, priority, limit_at_upload, limit_at_download)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, [
			data.name,
			data.profile_id || null,
			data.price,
			data.duration_days,
			data.auto_activation || 0,
			data.status,
			data.description || null,
			data.rate_limit_rx || '0',
			data.rate_limit_tx || '0',
			data.burst_limit_rx || null,
			data.burst_limit_tx || null,
			data.burst_threshold_rx || null,
			data.burst_threshold_tx || null,
			data.burst_time_rx || null,
			data.burst_time_tx || null,
			data.price_7_days || null,
			data.price_14_days || null,
			data.price_30_days || null,
			data.is_enabled_7_days || 0,
			data.is_enabled_14_days || 0,
			data.is_enabled_30_days || 0,
			data.max_clients || 1,
			data.priority || 8,
			data.limit_at_upload || null,
			data.limit_at_download || null
		]);

		const insertResult = result as any;
		const packageId = insertResult.insertId;

		// --- SHARED BANDWIDTH CALCULATION (Static IP Concept) ---
		const maxClients = (data.max_clients || 1);
		const parseRateToNum = (val: string) => {
			if (!val) return 0;
			const num = parseFloat(val);
			if (val.toLowerCase().includes('k')) return num * 1000;
			if (val.toLowerCase().includes('m')) return num * 1000000;
			if (val.toLowerCase().includes('g')) return num * 1000000000;
			return num * 1000000; // Default to Mbps if numeric only
		};
		const formatRateFromNum = (val: number) => {
			if (val >= 1000000) return `${Math.floor(val / 1000000)}M`;
			if (val >= 1000) return `${Math.floor(val / 1000)}k`;
			return `${Math.floor(val)}`;
		};

		// For shared packages, individual profile limit = total (to allow burst if others idle)
		// We use Parent Queue + PCQ to handle the sharing.
		let profileRx = data.rate_limit_rx || '10M';
		let profileTx = data.rate_limit_tx || '10M';

		// AUTOMATICALLY MANAGE PARENT QUEUE FOR SHARED PACKAGE
		if (maxClients > 1) {
			try {
				const config = await getMikrotikConfig();
				if (config) {
					const { createSimpleQueue, updateSimpleQueue, findSimpleQueueIdByName } = await import('./mikrotikService');
					// Parent limit is usually the RX/TX limit of the package
					// Mikrotik Simple Queue MaxLimit: target-upload/target-download (RX/TX)
					const parentMaxLimit = `${data.rate_limit_rx || '10M'}/${data.rate_limit_tx || '10M'}`;

					const queueData = {
						name: data.name,
						target: '0.0.0.0/0', // Global target for parent
						maxLimit: parentMaxLimit,

						limitAt: '0/0',
						comment: `[BILLING] PPPOE SHARED PARENT: ${data.name} (Max: ${data.max_clients} Clients)`,
						queue: 'pcq-upload-default/pcq-download-default', // Use PCQ for fair sharing
						priority: `${data.priority || 8}/${data.priority || 8}`
					};

					// Use findSimpleQueueIdByName for better performance and reliability
					const existingId = await findSimpleQueueIdByName(config, data.name);

					if (existingId) {
						await updateSimpleQueue(config, existingId, queueData);
						console.log(`✅ Updated existing shared parent queue: ${data.name}`);
					} else {
						await createSimpleQueue(config, queueData);
						console.log(`✅ Created new shared parent queue: ${data.name}`);
					}
				}
			} catch (e: any) {
				console.error(`[PPPOE] Shared Queue setup failed:`, e.message);
			}
		}

		// ALWAYS SYNC PROFILE SETTINGS (EVEN FOR NON-SHARED)
		try {
			const config = await getMikrotikConfig();
			if (config && data.profile_id) {
				const [profRows] = await conn.execute('SELECT name FROM pppoe_profiles WHERE id = ?', [data.profile_id]);
				const profile = (profRows as any)[0];
				if (profile) {
					const { findPppProfileIdByName, updatePppProfile } = await import('./mikrotikService');
					const mikrotikId = await findPppProfileIdByName(config, profile.name);
					if (mikrotikId) {
						// Profile individual limit should be the same as package limit 
						// so they can use up to that bandwidth if shared group is idle.
						const updateData: any = {
							'parent-queue': maxClients > 1 ? data.name : 'none',
							'rate-limit-rx': profileRx,
							'rate-limit-tx': profileTx,
							'burst-limit-rx': data.burst_limit_rx || '',
							'burst-limit-tx': data.burst_limit_tx || '',
							'burst-threshold-rx': data.burst_threshold_rx || '',
							'burst-threshold-tx': data.burst_threshold_tx || '',
							'burst-time-rx': data.burst_time_rx || '',
							'burst-time-tx': data.burst_time_tx || '',
							'limit-at-rx': data.limit_at_download || '',
							'limit-at-tx': data.limit_at_upload || '',
							'priority': data.priority || 8
						};

						// AUTO-CALCULATE LIMIT-AT for shared if not provided
						if ((data.max_clients || 1) > 1 && (!data.limit_at_download || !data.limit_at_upload)) {
							const parseRate = (val: string) => {
								if (!val) return 0;
								const num = parseFloat(val);
								if (val.toLowerCase().includes('k')) return num * 1000;
								if (val.toLowerCase().includes('m')) return num * 1000000;
								return num;
							};
							const formatRate = (val: number) => {
								if (val >= 1000000) return `${Math.floor(val / 1000000)}M`;
								if (val >= 1000) return `${Math.floor(val / 1000)}k`;
								return `${Math.floor(val)}`;
							};

							const rxBytes = parseRate(data.rate_limit_rx || '10M');
							const txBytes = parseRate(data.rate_limit_tx || '10M');

							if (!data.limit_at_download && rxBytes > 0) {
								updateData['limit-at-rx'] = formatRate(rxBytes / (data.max_clients || 1));
							}
							if (!data.limit_at_upload && txBytes > 0) {
								updateData['limit-at-tx'] = formatRate(txBytes / (data.max_clients || 1));
							}
						}

						await updatePppProfile(config, mikrotikId, updateData);
						console.log(`✅ Profile ${profile.name} synced: Parent=${updateData['parent-queue']}, Limit=${updateData['rate-limit-rx']}/${updateData['rate-limit-tx']}`);
					}
				}
			}
		} catch (e: any) {
			console.error(`[PPPOE] Profile sync failed:`, e.message);
		}

		await conn.commit();
		return packageId;
	} catch (error: any) {
		await conn.rollback();
		throw error;
	} finally {
		conn.release();
	}
}

export async function updatePackage(id: number, data: {
	name?: string;
	profile_id?: number;
	price?: number;
	duration_days?: number;
	status?: 'active' | 'inactive';
	description?: string;
	rate_limit_rx?: string;
	rate_limit_tx?: string;
	burst_limit_rx?: string;
	burst_limit_tx?: string;
	burst_threshold_rx?: string;
	burst_threshold_tx?: string;
	burst_time_rx?: string;
	burst_time_tx?: string;
	price_7_days?: number;
	price_14_days?: number;
	price_30_days?: number;
	is_enabled_7_days?: number;
	is_enabled_14_days?: number;
	is_enabled_30_days?: number;
	max_clients?: number;
	priority?: number;
	limit_at_download?: string;
	limit_at_upload?: string;
}): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		// Get current package data BEFORE update
		const [packageRows] = await conn.execute(
			'SELECT * FROM pppoe_packages WHERE id = ?',
			[id]
		);
		const currentPackage = Array.isArray(packageRows) && packageRows.length ? packageRows[0] as any : null;
		if (!currentPackage) throw new Error('Package not found');

		const oldPackageName = currentPackage.name;
		const oldProfileId = currentPackage.profile_id;
		const newPackageName = data.name || oldPackageName;
		const newProfileId = data.profile_id || oldProfileId;

		// Update database
		await conn.execute(`
			UPDATE pppoe_packages SET
			name = COALESCE(?, name),
			profile_id = COALESCE(?, profile_id),
			price = ?,
			duration_days = ?,
			status = COALESCE(?, status),
			description = COALESCE(?, description),
			rate_limit_rx = ?,
			rate_limit_tx = ?,
			burst_limit_rx = ?,
			burst_limit_tx = ?,
			burst_threshold_rx = ?,
			burst_threshold_tx = ?,
			burst_time_rx = ?,
			burst_time_tx = ?,
			price_7_days = ?,
            price_14_days = ?,
			price_30_days = ?,
            is_enabled_7_days = ?,
            is_enabled_14_days = ?,
            is_enabled_30_days = ?,
			max_clients = ?,
			priority = ?,
			limit_at_download = ?,
			limit_at_upload = ?,
			updated_at = NOW()
			WHERE id = ?
			`, [
			data.name || null,
			data.profile_id || null,
			data.price !== undefined ? data.price : null,
			data.duration_days !== undefined ? data.duration_days : null,
			data.status || null,
			data.description || null,
			data.rate_limit_rx !== undefined ? data.rate_limit_rx : null,
			data.rate_limit_tx !== undefined ? data.rate_limit_tx : null,
			data.burst_limit_rx !== undefined ? data.burst_limit_rx : null,
			data.burst_limit_tx !== undefined ? data.burst_limit_tx : null,
			data.burst_threshold_rx !== undefined ? data.burst_threshold_rx : null,
			data.burst_threshold_tx !== undefined ? data.burst_threshold_tx : null,
			data.burst_time_rx !== undefined ? data.burst_time_rx : null,
			data.burst_time_tx !== undefined ? data.burst_time_tx : null,
			data.price_7_days !== undefined ? data.price_7_days : null,
			data.price_14_days !== undefined ? data.price_14_days : null,
			data.price_30_days !== undefined ? data.price_30_days : null,
			data.is_enabled_7_days !== undefined ? data.is_enabled_7_days : 0,
			data.is_enabled_14_days !== undefined ? data.is_enabled_14_days : 0,
			data.is_enabled_30_days !== undefined ? data.is_enabled_30_days : 0,
			data.max_clients !== undefined ? data.max_clients : (currentPackage.max_clients || 1),
			data.priority !== undefined ? data.priority : (currentPackage.priority || 8),
			data.limit_at_download !== undefined ? data.limit_at_download : null,
			data.limit_at_upload !== undefined ? data.limit_at_upload : null,
			id
		]);

		// --- MIKROTIK SYNC LOGIC (Aligned with Static IP Concept) ---
		const finalMaxClients = (data.max_clients !== undefined) ? data.max_clients : (currentPackage.max_clients || 1);

		const parseRateToNumUpdate = (val: string) => {
			if (!val) return 0;
			const num = parseFloat(val);
			if (val.toLowerCase().includes('k')) return num * 1000;
			if (val.toLowerCase().includes('m')) return num * 1000000;
			if (val.toLowerCase().includes('g')) return num * 1000000000;
			return num * 1000000;
		};
		const formatRateFromNumUpdate = (val: number) => {
			if (val >= 1000000) return `${Math.floor(val / 1000000)}M`;
			if (val >= 1000) return `${Math.floor(val / 1000)}k`;
			return `${Math.floor(val)}`;
		};

		try {
			const config = await getMikrotikConfig();
			if (config) {
				const {
					createSimpleQueue,
					updateSimpleQueue,
					deleteSimpleQueue,
					findSimpleQueueIdByName,
					findPppProfileIdByName,
					updatePppProfile
				} = await import('./mikrotikService');

				const rateLimitRx = data.rate_limit_rx !== undefined ? data.rate_limit_rx : currentPackage.rate_limit_rx;
				const rateLimitTx = data.rate_limit_tx !== undefined ? data.rate_limit_tx : currentPackage.rate_limit_tx;

				// 1. MANAGE SHARED PARENT QUEUE (Simple Queue)
				if (finalMaxClients > 1) {
					const parentMaxLimit = `${rateLimitRx || '10M'}/${rateLimitTx || '10M'}`;

					const queueData = {
						name: newPackageName,
						target: '0.0.0.0/0',
						maxLimit: parentMaxLimit,
						limitAt: '0/0',
						comment: `[BILLING] PPPOE SHARED PARENT: ${newPackageName} (Max: ${finalMaxClients} Clients)`,
						queue: 'pcq-upload-default/pcq-download-default',
						priority: '8/8'
					};

					let existingQueueId = await findSimpleQueueIdByName(config, oldPackageName);
					if (!existingQueueId && newPackageName !== oldPackageName) {
						existingQueueId = await findSimpleQueueIdByName(config, newPackageName);
					}

					if (existingQueueId) {
						await updateSimpleQueue(config, existingQueueId, queueData);
						console.log(`✅ Updated Shared Parent Queue: ${newPackageName}`);
					} else {
						await createSimpleQueue(config, queueData);
						console.log(`✅ Created Shared Parent Queue: ${newPackageName}`);
					}
				} else {
					// Clean up if no longer shared
					const existingQueueId = await findSimpleQueueIdByName(config, oldPackageName);
					if (existingQueueId) {
						await deleteSimpleQueue(config, existingQueueId);
						console.log(`🗑️ Deleted Shared Parent Queue (max_clients=1): ${oldPackageName}`);
					}
				}

				// 2. SYNC PPP PROFILE SETTINGS
				const targetProfileId = newProfileId || oldProfileId;
				if (targetProfileId) {
					const [profRows] = await conn.execute('SELECT name FROM pppoe_profiles WHERE id = ?', [targetProfileId]);
					const profile = (profRows as any)[0];
					if (profile) {
						const mikrotikId = await findPppProfileIdByName(config, profile.name);
						if (mikrotikId) {
							// Individual Cap should be full speed to allow burst within the shared pool
							let profileRxCap = rateLimitRx || '10M';
							let profileTxCap = rateLimitTx || '10M';

							const updateData: any = {
								'parent-queue': finalMaxClients > 1 ? newPackageName : 'none',
								'rate-limit-rx': profileRxCap,
								'rate-limit-tx': profileTxCap,
								'burst-limit-rx': data.burst_limit_rx !== undefined ? data.burst_limit_rx : currentPackage.burst_limit_rx || '',
								'burst-limit-tx': data.burst_limit_tx !== undefined ? data.burst_limit_tx : currentPackage.burst_limit_tx || '',
								'burst-threshold-rx': data.burst_threshold_rx !== undefined ? data.burst_threshold_rx : currentPackage.burst_threshold_rx || '',
								'burst-threshold-tx': data.burst_threshold_tx !== undefined ? data.burst_threshold_tx : currentPackage.burst_threshold_tx || '',
								'burst-time-rx': data.burst_time_rx !== undefined ? data.burst_time_rx : currentPackage.burst_time_rx || '',
								'burst-time-tx': data.burst_time_tx !== undefined ? data.burst_time_tx : currentPackage.burst_time_tx || '',
								'limit-at-rx': data.limit_at_download !== undefined ? data.limit_at_download : currentPackage.limit_at_download || '',
								'limit-at-tx': data.limit_at_upload !== undefined ? data.limit_at_upload : currentPackage.limit_at_upload || '',
								'priority': data.priority !== undefined ? data.priority : currentPackage.priority || 8
							};

							// Auto-calculate limit-at if still empty
							if (finalMaxClients > 1 && (!updateData['limit-at-rx'] || !updateData['limit-at-tx'])) {
								const rxB = parseRateToNumUpdate(rateLimitRx);
								const txB = parseRateToNumUpdate(rateLimitTx);
								if (rxB > 0) updateData['limit-at-rx'] = formatRateFromNumUpdate(rxB / finalMaxClients);
								if (txB > 0) updateData['limit-at-tx'] = formatRateFromNumUpdate(txB / finalMaxClients);
							}

							await updatePppProfile(config, mikrotikId, updateData);
							console.log(`✅ Synced Profile: ${profile.name} (Parent=${updateData['parent-queue']}, Cap=${profileRxCap}/${profileTxCap})`);
						}
					}
				}
			}
		} catch (e: any) {
			console.error(`[PPPOE] MikroTik Sync Error (Update):`, e.message);
		}
		await conn.commit();
	} catch (error: any) {
		await conn.rollback();
		throw error;
	} finally {
		conn.release();
	}
}

export async function deletePackage(id: number): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();

		// Get package info to find associated profile
		const [pkgRows] = await conn.execute('SELECT name, profile_id FROM pppoe_packages WHERE id = ?', [id]);
		const pkg = (pkgRows as any)[0];

		if (!pkg) {
			await conn.rollback();
			return;
		}

		// Delete the package
		await conn.execute('DELETE FROM pppoe_packages WHERE id = ?', [id]);

		// Manage MikroTik cleanup
		try {
			const config = await getMikrotikConfig();
			if (config) {
				const { deleteSimpleQueue, findSimpleQueueIdByName, deletePppProfile, findPppProfileIdByName } = await import('./mikrotikService');

				// 1. Delete Parent Queue if exists
				const queueId = await findSimpleQueueIdByName(config, pkg.name);
				if (queueId) {
					await deleteSimpleQueue(config, queueId);
					console.log(`🗑️ Deleted Parent Queue: ${pkg.name}`);
				}

				// 2. Delete Profile if not used by other packages
				if (pkg.profile_id) {
					const [usageRows] = await conn.execute('SELECT COUNT(*) as count FROM pppoe_packages WHERE profile_id = ?', [pkg.profile_id]);
					const usageCount = (usageRows as any)[0].count;

					if (usageCount === 0) {
						const [profRows] = await conn.execute('SELECT name FROM pppoe_profiles WHERE id = ?', [pkg.profile_id]);
						const profile = (profRows as any)[0];

						if (profile) {
							// Delete from MikroTik
							const mkProfId = await findPppProfileIdByName(config, profile.name);
							if (mkProfId) {
								await deletePppProfile(config, mkProfId);
								console.log(`🗑️ Deleted MikroTik Profile: ${profile.name}`);
							}

							// Delete from DB
							await conn.execute('DELETE FROM pppoe_profiles WHERE id = ?', [pkg.profile_id]);
							console.log(`🗑️ Deleted DB Profile: ${profile.name}`);
						}
					}
				}
			}
		} catch (cleanupErr: any) {
			console.error(`⚠️ MikroTik cleanup failed during package deletion:`, cleanupErr.message);
		}

		await conn.commit();
	} catch (error) {
		await conn.rollback();
		throw error;
	} finally {
		conn.release();
	}
}

// =====================================================================
// PROFILE CRUD OPERATIONS (Manual Management)
// =====================================================================

export async function createProfile(data: {
	name: string;
	local_address?: string;
	remote_address_pool?: string;
	dns_server?: string;
	rate_limit_rx?: string;
	rate_limit_tx?: string;
	burst_limit_rx?: string;
	burst_limit_tx?: string;
	burst_threshold_rx?: string;
	burst_threshold_tx?: string;
	burst_time_rx?: string;
	burst_time_tx?: string;
	comment?: string;
}): Promise<number> {
	const conn = await databasePool.getConnection();
	try {
		const [result] = await conn.execute(`
			INSERT INTO pppoe_profiles
			(name, local_address, remote_address_pool, dns_server,
				rate_limit_rx, rate_limit_tx, burst_limit_rx, burst_limit_tx,
				burst_threshold_rx, burst_threshold_tx, burst_time_rx, burst_time_tx, comment)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, [
			data.name,
			data.local_address || null,
			data.remote_address_pool || null,
			data.dns_server || null,
			data.rate_limit_rx || '0',
			data.rate_limit_tx || '0',
			data.burst_limit_rx || null,
			data.burst_limit_tx || null,
			data.burst_threshold_rx || null,
			data.burst_threshold_tx || null,
			data.burst_time_rx || null,
			data.burst_time_tx || null,
			data.comment || null
		]);

		const insertResult = result as any;

		// Auto sync to MikroTik
		try {
			const config = await getMikrotikConfig();
			if (config) {
				await createPppProfile(config, {
					name: data.name,
					'local-address': data.local_address,
					'remote-address': data.remote_address_pool,
					'dns-server': data.dns_server,
					comment: data.comment,
					'rate-limit-rx': data.rate_limit_rx || '0',
					'rate-limit-tx': data.rate_limit_tx || '0',
					'burst-limit-rx': data.burst_limit_rx,
					'burst-limit-tx': data.burst_limit_tx,
					'burst-threshold-rx': data.burst_threshold_rx,
					'burst-threshold-tx': data.burst_threshold_tx,
					'burst-time-rx': data.burst_time_rx,
					'burst-time-tx': data.burst_time_tx
				});
				console.log(`✅ Profile ${data.name} berhasil di - sync ke MikroTik`);
			}
		} catch (syncError: any) {
			console.error(`⚠️ Gagal sync profile ${data.name} ke MikroTik: `, syncError.message);
			// Don't throw - profile was created in DB, sync failure is logged
		}

		return insertResult.insertId;
	} finally {
		conn.release();
	}
}

export async function updateProfile(id: number, data: {
	name?: string;
	local_address?: string;
	remote_address_pool?: string;
	dns_server?: string;
	rate_limit_rx?: string;
	rate_limit_tx?: string;
	burst_limit_rx?: string;
	burst_limit_tx?: string;
	burst_threshold_rx?: string;
	burst_threshold_tx?: string;
	burst_time_rx?: string;
	burst_time_tx?: string;
	comment?: string;
}): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		// Get current profile data BEFORE update to get the OLD name
		const [profileRows] = await conn.execute(
			'SELECT name FROM pppoe_profiles WHERE id = ?',
			[id]
		);
		const currentProfile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] as any : null;
		const oldProfileName = currentProfile?.name; // Nama LAMA sebelum update
		const newProfileName = data.name || oldProfileName; // Nama BARU setelah update

		// Prepare update values - handle empty strings properly
		const updateValues: any = {};
		if (data.name !== undefined) updateValues.name = data.name;
		if (data.local_address !== undefined) updateValues.local_address = data.local_address || null;
		if (data.remote_address_pool !== undefined) updateValues.remote_address_pool = data.remote_address_pool || null;
		if (data.dns_server !== undefined) updateValues.dns_server = data.dns_server || null;
		if (data.rate_limit_rx !== undefined) updateValues.rate_limit_rx = data.rate_limit_rx || '0';
		if (data.rate_limit_tx !== undefined) updateValues.rate_limit_tx = data.rate_limit_tx || '0';
		if (data.burst_limit_rx !== undefined) updateValues.burst_limit_rx = data.burst_limit_rx || null;
		if (data.burst_limit_tx !== undefined) updateValues.burst_limit_tx = data.burst_limit_tx || null;
		if (data.burst_threshold_rx !== undefined) updateValues.burst_threshold_rx = data.burst_threshold_rx || null;
		if (data.burst_threshold_tx !== undefined) updateValues.burst_threshold_tx = data.burst_threshold_tx || null;
		if (data.burst_time_rx !== undefined) updateValues.burst_time_rx = data.burst_time_rx || null;
		if (data.burst_time_tx !== undefined) updateValues.burst_time_tx = data.burst_time_tx || null;
		if (data.comment !== undefined) updateValues.comment = data.comment || null;

		// Build dynamic UPDATE query
		const setClauses: string[] = [];
		const setValues: any[] = [];

		Object.entries(updateValues).forEach(([key, value]) => {
			setClauses.push(`${key} = ?`);
			setValues.push(value);
		});

		setClauses.push('updated_at = NOW()');

		if (setClauses.length > 1) {
			await conn.execute(`
				UPDATE pppoe_profiles SET 
					${setClauses.join(', ')}
				WHERE id = ?
			`, [...setValues, id]);
		}

		// Auto sync to MikroTik
		if (oldProfileName) {
			try {
				const config = await getMikrotikConfig();
				if (!config) {
					console.warn(`⚠️ MikroTik config tidak ditemukan, skip sync untuk profile ${oldProfileName} `);
					return;
				}

				// Cari profile di MikroTik menggunakan NAMA LAMA (sebelum update)
				let mikrotikId = await findPppProfileIdByName(config, oldProfileName);

				// Jika tidak ketemu dengan nama lama, coba dengan nama baru (untuk kasus profile sudah diubah manual)
				if (!mikrotikId && newProfileName !== oldProfileName) {
					mikrotikId = await findPppProfileIdByName(config, newProfileName);
				}

				// Get updated profile data from database
				const [updatedRows] = await conn.execute(
					'SELECT * FROM pppoe_profiles WHERE id = ?',
					[id]
				);
				const updatedProfile = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] as any : null;

				if (!updatedProfile) {
					console.error(`⚠️ Profile dengan ID ${id} tidak ditemukan setelah update`);
					return;
				}

				// Gunakan nilai dari data yang di-update, bukan dari database (untuk memastikan nilai terbaru)
				// Jika tidak ada di data, gunakan dari database
				let rateLimitRx = (data.rate_limit_rx !== undefined && data.rate_limit_rx && data.rate_limit_rx.trim() !== '')
					? data.rate_limit_rx.trim()
					: ((updatedProfile.rate_limit_rx && updatedProfile.rate_limit_rx.trim() !== '')
						? updatedProfile.rate_limit_rx.trim()
						: '0');
				let rateLimitTx = (data.rate_limit_tx !== undefined && data.rate_limit_tx && data.rate_limit_tx.trim() !== '')
					? data.rate_limit_tx.trim()
					: ((updatedProfile.rate_limit_tx && updatedProfile.rate_limit_tx.trim() !== '')
						? updatedProfile.rate_limit_tx.trim()
						: '0');

				// Pastikan format benar - jika hanya angka, tambahkan 'M'
				// Jika sudah ada unit (M, K, G), biarkan saja
				if (rateLimitRx && rateLimitRx !== '0' && !/[KMGT]/.test(rateLimitRx.toUpperCase())) {
					rateLimitRx = rateLimitRx + 'M';
				}
				if (rateLimitTx && rateLimitTx !== '0' && !/[KMGT]/.test(rateLimitTx.toUpperCase())) {
					rateLimitTx = rateLimitTx + 'M';
				}

				console.log(`📊[updateProfile] Final rate limit values - RX: ${rateLimitRx}, TX: ${rateLimitTx} `);

				if (mikrotikId) {
					// Profile ditemukan di MikroTik, UPDATE
					console.log(`🔄[updateProfile] Updating profile di MikroTik: ${oldProfileName} -> ${newProfileName} (ID: ${mikrotikId})`);
					console.log(`📊[updateProfile] Rate Limit RX: ${rateLimitRx}, TX: ${rateLimitTx} `);
					console.log(`📊[updateProfile] Data yang akan dikirim: `, {
						rate_limit_rx: data.rate_limit_rx,
						rate_limit_tx: data.rate_limit_tx,
						name: data.name
					});

					// Gunakan nilai dari data jika tersedia, jika tidak gunakan dari database
					const finalName = data.name !== undefined ? data.name : updatedProfile.name;
					const finalLocalAddress = data.local_address !== undefined ? data.local_address : updatedProfile.local_address;
					const finalRemoteAddress = data.remote_address_pool !== undefined ? data.remote_address_pool : updatedProfile.remote_address_pool;
					const finalDnsServer = data.dns_server !== undefined ? data.dns_server : updatedProfile.dns_server;
					const finalComment = data.comment !== undefined ? data.comment : updatedProfile.comment;

					// --- FULL SYNC & FIELD CLEARING ---
					console.log(`📤[updateProfile] Syncing fields to MikroTik for profile "${finalName}"`);

					await updatePppProfile(config, mikrotikId, {
						name: finalName,
						'local-address': finalLocalAddress || '', // Force clear if empty
						'remote-address': finalRemoteAddress || '', // Force clear if empty
						'dns-server': finalDnsServer || '',
						comment: finalComment || '',
						'rate-limit-rx': rateLimitRx,
						'rate-limit-tx': rateLimitTx,
						'burst-limit-rx': (data.burst_limit_rx !== undefined) ? (data.burst_limit_rx || '') : (updatedProfile.burst_limit_rx || ''),
						'burst-limit-tx': (data.burst_limit_tx !== undefined) ? (data.burst_limit_tx || '') : (updatedProfile.burst_limit_tx || ''),
						'burst-threshold-rx': (data.burst_threshold_rx !== undefined) ? (data.burst_threshold_rx || '') : (updatedProfile.burst_threshold_rx || ''),
						'burst-threshold-tx': (data.burst_threshold_tx !== undefined) ? (data.burst_threshold_tx || '') : (updatedProfile.burst_threshold_tx || ''),
						'burst-time-rx': (data.burst_time_rx !== undefined) ? (data.burst_time_rx || '') : (updatedProfile.burst_time_rx || ''),
						'burst-time-tx': (data.burst_time_tx !== undefined) ? (data.burst_time_tx || '') : (updatedProfile.burst_time_tx || '')
					});

					console.log(`✅ Profile "${updatedProfile.name}" fully updated and fields cleared where necessary.`);
				} else {
					// Profile tidak ditemukan di MikroTik, CREATE baru
					console.log(`➕ Profile "${oldProfileName}" tidak ditemukan di MikroTik, membuat profile baru...`);

					await createPppProfile(config, {
						name: updatedProfile.name,
						'local-address': updatedProfile.local_address || '',
						'remote-address': updatedProfile.remote_address_pool || '',
						'dns-server': updatedProfile.dns_server || '',
						comment: updatedProfile.comment || '',
						'rate-limit-rx': rateLimitRx,
						'rate-limit-tx': rateLimitTx,
						'burst-limit-rx': updatedProfile.burst_limit_rx || '',
						'burst-limit-tx': updatedProfile.burst_limit_tx || '',
						'burst-threshold-rx': updatedProfile.burst_threshold_rx || '',
						'burst-threshold-tx': updatedProfile.burst_threshold_tx || '',
						'burst-time-rx': updatedProfile.burst_time_rx || '',
						'burst-time-tx': updatedProfile.burst_time_tx || ''
					});

					console.log(`✅ Profile "${updatedProfile.name}" created in MikroTik.`);
				}
			} catch (syncError: any) {
				console.error(`❌ Profile Sync Failed:`, syncError.message);
				throw new Error(`Gagal sinkronisasi ke MikroTik: ${syncError?.message}`);
			}
		}
	} finally {
		conn.release();
	}
}

export async function deleteProfile(id: number): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();

		// 1. Check if profile is used by any package
		const [packages] = await conn.execute(
			'SELECT COUNT(*) as count FROM pppoe_packages WHERE profile_id = ?',
			[id]
		);

		const count = (packages as any)[0]?.count || 0;
		if (count > 0) {
			throw new Error(`Profil tidak dapat dihapus karena masih digunakan oleh ${count} paket`);
		}

		// 2. Get profile name for MikroTik cleanup
		const [profRows] = await conn.execute('SELECT name FROM pppoe_profiles WHERE id = ?', [id]);
		const profile = (profRows as any)[0];

		if (profile) {
			try {
				const config = await getMikrotikConfig();
				if (config) {
					const { findPppProfileIdByName, deletePppProfile } = await import('./mikrotikService');
					const mkId = await findPppProfileIdByName(config, profile.name);
					if (mkId) {
						await deletePppProfile(config, mkId);
						console.log(`🗑️ Deleted MikroTik Profile: ${profile.name}`);
					}
				}
			} catch (mkErr: any) {
				console.warn(`⚠️ Gagal hapus profile "${profile.name}" di MikroTik (diabaikan agar DB tetap terhapus):`, mkErr.message);
			}

			// 3. Delete from DB
			await conn.execute('DELETE FROM pppoe_profiles WHERE id = ?', [id]);
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}
