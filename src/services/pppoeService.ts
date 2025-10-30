import { databasePool } from '../db/pool';
import { getPppProfiles, createPppProfile, updatePppProfile, deletePppProfile, PppProfile, MikroTikConfig } from './mikrotikService';

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
	created_at: Date;
	updated_at: Date;
	profile?: PppoeProfile;
};

export async function getMikrotikConfig(): Promise<MikroTikConfig | null> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
		const settings = Array.isArray(rows) && rows.length ? rows[0] as any : null;
		if (!settings) return null;
		
		return {
			host: settings.host,
			port: settings.port,
			username: settings.username,
			password: settings.password,
			use_tls: Boolean(settings.use_tls)
		};
	} finally {
		conn.release();
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
			SELECT id, name, local_address, remote_address, remote_address_pool, dns_server, 
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
			SELECT p.*, pr.name as profile_name, pr.remote_address_pool, pr.local_address
			FROM pppoe_packages p
			LEFT JOIN pppoe_profiles pr ON p.profile_id = pr.id
			ORDER BY p.name ASC
		`);
		return Array.isArray(rows) ? rows as PppoePackage[] : [];
	} finally {
		conn.release();
	}
}

export async function getPackageById(id: number): Promise<PppoePackage | null> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(`
			SELECT p.*, pr.name as profile_name, pr.remote_address_pool, pr.local_address
			FROM pppoe_packages p
			LEFT JOIN pppoe_profiles pr ON p.profile_id = pr.id
			WHERE p.id = ?
		`, [id]);
		const result = Array.isArray(rows) && rows.length ? rows[0] as PppoePackage : null;
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
}): Promise<number> {
	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();
		
		// Insert package to database
		const [result] = await conn.execute(`
			INSERT INTO pppoe_packages 
			(name, profile_id, price, duration_days, auto_activation, status, description,
			 rate_limit_rx, rate_limit_tx, burst_limit_rx, burst_limit_tx,
			 burst_threshold_rx, burst_threshold_tx, burst_time_rx, burst_time_tx)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, [
			data.name,
			data.profile_id || null,
			data.price,
			data.duration_days,
			data.auto_activation || 0,
			data.status,
			data.description || null,
			data.rate_limit_rx || '0',  // Default '0' (unlimited) jika tidak diisi
			data.rate_limit_tx || '0',  // Default '0' (unlimited) jika tidak diisi
			data.burst_limit_rx || null,
			data.burst_limit_tx || null,
			data.burst_threshold_rx || null,
			data.burst_threshold_tx || null,
			data.burst_time_rx || null,
			data.burst_time_tx || null
		]);
		
		const insertResult = result as any;
		await conn.commit();
		return insertResult.insertId;
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
}): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		await conn.execute(`
			UPDATE pppoe_packages SET 
				name = COALESCE(?, name),
				profile_id = COALESCE(?, profile_id),
				price = COALESCE(?, price),
				duration_days = COALESCE(?, duration_days),
				status = COALESCE(?, status),
				description = COALESCE(?, description),
				rate_limit_rx = COALESCE(?, rate_limit_rx),
				rate_limit_tx = COALESCE(?, rate_limit_tx),
				burst_limit_rx = COALESCE(?, burst_limit_rx),
				burst_limit_tx = COALESCE(?, burst_limit_tx),
				burst_threshold_rx = COALESCE(?, burst_threshold_rx),
				burst_threshold_tx = COALESCE(?, burst_threshold_tx),
				burst_time_rx = COALESCE(?, burst_time_rx),
				burst_time_tx = COALESCE(?, burst_time_tx),
				updated_at = NOW()
			WHERE id = ?
		`, [
			data.name || null, data.profile_id || null, data.price || null, data.duration_days || null, data.status || null,
			data.description || null, data.rate_limit_rx || null, data.rate_limit_tx || null, data.burst_limit_rx || null,
			data.burst_limit_tx || null, data.burst_threshold_rx || null, data.burst_threshold_tx || null,
			data.burst_time_rx || null, data.burst_time_tx || null, id
		]);
	} finally {
		conn.release();
	}
}

export async function deletePackage(id: number): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		await conn.execute('DELETE FROM pppoe_packages WHERE id = ?', [id]);
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
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
		await conn.execute(`
			UPDATE pppoe_profiles SET 
				name = COALESCE(?, name),
				local_address = COALESCE(?, local_address),
				remote_address_pool = COALESCE(?, remote_address_pool),
				dns_server = COALESCE(?, dns_server),
				rate_limit_rx = COALESCE(?, rate_limit_rx),
				rate_limit_tx = COALESCE(?, rate_limit_tx),
				burst_limit_rx = COALESCE(?, burst_limit_rx),
				burst_limit_tx = COALESCE(?, burst_limit_tx),
				burst_threshold_rx = COALESCE(?, burst_threshold_rx),
				burst_threshold_tx = COALESCE(?, burst_threshold_tx),
				burst_time_rx = COALESCE(?, burst_time_rx),
				burst_time_tx = COALESCE(?, burst_time_tx),
				comment = COALESCE(?, comment),
				updated_at = NOW()
			WHERE id = ?
		`, [
			data.name || null,
			data.local_address || null,
			data.remote_address_pool || null,
			data.dns_server || null,
			data.rate_limit_rx || null,
			data.rate_limit_tx || null,
			data.burst_limit_rx || null,
			data.burst_limit_tx || null,
			data.burst_threshold_rx || null,
			data.burst_threshold_tx || null,
			data.burst_time_rx || null,
			data.burst_time_tx || null,
			data.comment || null,
			id
		]);
	} finally {
		conn.release();
	}
}

export async function deleteProfile(id: number): Promise<void> {
	const conn = await databasePool.getConnection();
	try {
		// Check if profile is used by any package
		const [packages] = await conn.execute(
			'SELECT COUNT(*) as count FROM pppoe_packages WHERE profile_id = ?',
			[id]
		);
		
		const count = (packages as any)[0]?.count || 0;
		if (count > 0) {
			throw new Error(`Profil tidak dapat dihapus karena masih digunakan oleh ${count} paket`);
		}
		
		await conn.execute('DELETE FROM pppoe_profiles WHERE id = ?', [id]);
	} finally {
		conn.release();
	}
}
