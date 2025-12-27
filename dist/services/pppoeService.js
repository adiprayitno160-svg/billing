"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMikrotikConfig = getMikrotikConfig;
exports.syncProfilesFromMikrotik = syncProfilesFromMikrotik;
exports.listProfiles = listProfiles;
exports.getProfileById = getProfileById;
exports.listPackages = listPackages;
exports.getPackageById = getPackageById;
exports.createPackage = createPackage;
exports.updatePackage = updatePackage;
exports.deletePackage = deletePackage;
exports.createProfile = createProfile;
exports.updateProfile = updateProfile;
exports.deleteProfile = deleteProfile;
const pool_1 = require("../db/pool");
const mikrotikService_1 = require("./mikrotikService");
async function getMikrotikConfig() {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        const settings = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!settings)
            return null;
        return {
            host: settings.host,
            port: settings.port,
            username: settings.username,
            password: settings.password,
            use_tls: Boolean(settings.use_tls)
        };
    }
    finally {
        conn.release();
    }
}
async function syncProfilesFromMikrotik() {
    console.log('=== STARTING PPPoE PROFILES SYNC ===');
    const config = await getMikrotikConfig();
    if (!config) {
        console.error('❌ Konfigurasi MikroTik tidak ditemukan');
        throw new Error('Konfigurasi MikroTik tidak ditemukan');
    }
    console.log('✅ Konfigurasi MikroTik ditemukan:', { host: config.host, port: config.port, username: config.username });
    try {
        console.log('📡 Mengambil profil PPPoE dari MikroTik...');
        const profiles = await (0, mikrotikService_1.getPppProfiles)(config);
        console.log(`✅ Berhasil mengambil ${profiles.length} profil dari MikroTik`);
        const conn = await pool_1.databasePool.getConnection();
        const errors = [];
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
                    const [existing] = await conn.execute('SELECT id FROM pppoe_profiles WHERE name = ?', [profile.name]);
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
                    }
                    else {
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
                }
                catch (error) {
                    const errorMsg = `Gagal sync profil ${profile.name}: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)}`;
                    console.error(`❌ ${errorMsg}`);
                    errors.push(errorMsg);
                }
            }
            await conn.commit();
            console.log('✅ Transaksi database berhasil di-commit');
        }
        catch (error) {
            console.error('❌ Error dalam transaksi database, melakukan rollback...');
            await conn.rollback();
            throw error;
        }
        finally {
            conn.release();
        }
        console.log(`=== SYNC COMPLETED ===`);
        console.log(`✅ Total profil yang berhasil di-sync: ${synced}`);
        console.log(`❌ Total error: ${errors.length}`);
        if (errors.length > 0) {
            console.log('Error details:', errors);
        }
        return { synced, errors };
    }
    catch (error) {
        console.error('❌ Error dalam sinkronisasi profil PPPoE:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error));
        throw error;
    }
}
async function listProfiles() {
    const conn = await pool_1.databasePool.getConnection();
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
        return Array.isArray(rows) ? rows : [];
    }
    finally {
        conn.release();
    }
}
async function getProfileById(id) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT * FROM pppoe_profiles WHERE id = ?', [id]);
        const result = Array.isArray(rows) && rows.length ? rows[0] : null;
        return result;
    }
    finally {
        conn.release();
    }
}
async function listPackages() {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
			SELECT p.*, 
				pr.name as profile_name, 
				pr.remote_address_pool, 
				pr.local_address,
				pr.rate_limit_rx as profile_rate_limit_rx,
				pr.rate_limit_tx as profile_rate_limit_tx
			FROM pppoe_packages p
			LEFT JOIN pppoe_profiles pr ON p.profile_id = pr.id
			ORDER BY p.name ASC
		`);
        const packages = Array.isArray(rows) ? rows : [];
        // Update rate limit dari profile untuk setiap paket yang punya profile_id
        packages.forEach((pkg) => {
            if (pkg.profile_id && pkg.profile_rate_limit_rx !== null) {
                pkg.rate_limit_rx = pkg.profile_rate_limit_rx || pkg.rate_limit_rx || '0';
                pkg.rate_limit_tx = pkg.profile_rate_limit_tx || pkg.rate_limit_tx || '0';
            }
        });
        return packages;
    }
    finally {
        conn.release();
    }
}
async function getPackageById(id) {
    const conn = await pool_1.databasePool.getConnection();
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
        const result = Array.isArray(rows) && rows.length ? rows[0] : null;
        // Jika paket punya profile_id, gunakan rate limit dari profile (data terbaru)
        if (result && result.profile_id && result.profile_rate_limit_rx !== null) {
            // Update rate limit dari profile jika ada (prioritas: profile > package)
            result.rate_limit_rx = result.profile_rate_limit_rx || result.rate_limit_rx || '0';
            result.rate_limit_tx = result.profile_rate_limit_tx || result.rate_limit_tx || '0';
            result.burst_limit_rx = result.profile_burst_limit_rx || result.burst_limit_rx || null;
            result.burst_limit_tx = result.profile_burst_limit_tx || result.burst_limit_tx || null;
            result.burst_threshold_rx = result.profile_burst_threshold_rx || result.burst_threshold_rx || null;
            result.burst_threshold_tx = result.profile_burst_threshold_tx || result.burst_threshold_tx || null;
            result.burst_time_rx = result.profile_burst_time_rx || result.burst_time_rx || null;
            result.burst_time_tx = result.profile_burst_time_tx || result.burst_time_tx || null;
        }
        return result;
    }
    finally {
        conn.release();
    }
}
async function createPackage(data) {
    const conn = await pool_1.databasePool.getConnection();
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
            data.rate_limit_rx || '0', // Default '0' (unlimited) jika tidak diisi
            data.rate_limit_tx || '0', // Default '0' (unlimited) jika tidak diisi
            data.burst_limit_rx || null,
            data.burst_limit_tx || null,
            data.burst_threshold_rx || null,
            data.burst_threshold_tx || null,
            data.burst_time_rx || null,
            data.burst_time_tx || null
        ]);
        const insertResult = result;
        await conn.commit();
        return insertResult.insertId;
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
async function updatePackage(id, data) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Get current package data BEFORE update
        const [packageRows] = await conn.execute('SELECT name, profile_id FROM pppoe_packages WHERE id = ?', [id]);
        const currentPackage = Array.isArray(packageRows) && packageRows.length ? packageRows[0] : null;
        const oldPackageName = currentPackage?.name;
        const oldProfileId = currentPackage?.profile_id;
        const newPackageName = data.name || oldPackageName;
        const newProfileId = data.profile_id || oldProfileId;
        // Update database
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
        // Jika nama paket berubah dan ada profile_id, update nama profil di MikroTik
        if (newPackageName && newProfileId && newPackageName !== oldPackageName) {
            try {
                const config = await getMikrotikConfig();
                if (config) {
                    // Get profile data
                    const [profileRows] = await conn.execute('SELECT name FROM pppoe_profiles WHERE id = ?', [newProfileId]);
                    const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;
                    if (profile && profile.name) {
                        // Cari profile di MikroTik dengan nama lama
                        const mikrotikId = await (0, mikrotikService_1.findPppProfileIdByName)(config, profile.name);
                        if (mikrotikId) {
                            // Update nama profil di MikroTik sesuai nama paket baru
                            await (0, mikrotikService_1.updatePppProfile)(config, mikrotikId, {
                                name: newPackageName
                            });
                            // Update nama profil di database juga
                            await conn.execute('UPDATE pppoe_profiles SET name = ? WHERE id = ?', [newPackageName, newProfileId]);
                            console.log(`✅ Nama profil di MikroTik diupdate dari "${profile.name}" ke "${newPackageName}"`);
                        }
                    }
                }
            }
            catch (syncError) {
                console.error(`⚠️ Gagal sync nama profil ke MikroTik untuk paket ${newPackageName}:`, syncError.message);
                // Don't throw - package was updated in DB
            }
        }
    }
    finally {
        conn.release();
    }
}
async function deletePackage(id) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        await conn.execute('DELETE FROM pppoe_packages WHERE id = ?', [id]);
    }
    finally {
        conn.release();
    }
}
// =====================================================================
// PROFILE CRUD OPERATIONS (Manual Management)
// =====================================================================
async function createProfile(data) {
    const conn = await pool_1.databasePool.getConnection();
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
        const insertResult = result;
        // Auto sync to MikroTik
        try {
            const config = await getMikrotikConfig();
            if (config) {
                await (0, mikrotikService_1.createPppProfile)(config, {
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
                console.log(`✅ Profile ${data.name} berhasil di-sync ke MikroTik`);
            }
        }
        catch (syncError) {
            console.error(`⚠️ Gagal sync profile ${data.name} ke MikroTik:`, syncError.message);
            // Don't throw - profile was created in DB, sync failure is logged
        }
        return insertResult.insertId;
    }
    finally {
        conn.release();
    }
}
async function updateProfile(id, data) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Get current profile data BEFORE update to get the OLD name
        const [profileRows] = await conn.execute('SELECT name FROM pppoe_profiles WHERE id = ?', [id]);
        const currentProfile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;
        const oldProfileName = currentProfile?.name; // Nama LAMA sebelum update
        const newProfileName = data.name || oldProfileName; // Nama BARU setelah update
        // Prepare update values - handle empty strings properly
        const updateValues = {};
        if (data.name !== undefined)
            updateValues.name = data.name;
        if (data.local_address !== undefined)
            updateValues.local_address = data.local_address || null;
        if (data.remote_address_pool !== undefined)
            updateValues.remote_address_pool = data.remote_address_pool || null;
        if (data.dns_server !== undefined)
            updateValues.dns_server = data.dns_server || null;
        if (data.rate_limit_rx !== undefined)
            updateValues.rate_limit_rx = data.rate_limit_rx || '0';
        if (data.rate_limit_tx !== undefined)
            updateValues.rate_limit_tx = data.rate_limit_tx || '0';
        if (data.burst_limit_rx !== undefined)
            updateValues.burst_limit_rx = data.burst_limit_rx || null;
        if (data.burst_limit_tx !== undefined)
            updateValues.burst_limit_tx = data.burst_limit_tx || null;
        if (data.burst_threshold_rx !== undefined)
            updateValues.burst_threshold_rx = data.burst_threshold_rx || null;
        if (data.burst_threshold_tx !== undefined)
            updateValues.burst_threshold_tx = data.burst_threshold_tx || null;
        if (data.burst_time_rx !== undefined)
            updateValues.burst_time_rx = data.burst_time_rx || null;
        if (data.burst_time_tx !== undefined)
            updateValues.burst_time_tx = data.burst_time_tx || null;
        if (data.comment !== undefined)
            updateValues.comment = data.comment || null;
        // Build dynamic UPDATE query
        const setClauses = [];
        const setValues = [];
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
                    console.warn(`⚠️ MikroTik config tidak ditemukan, skip sync untuk profile ${oldProfileName}`);
                    return;
                }
                // Cari profile di MikroTik menggunakan NAMA LAMA (sebelum update)
                let mikrotikId = await (0, mikrotikService_1.findPppProfileIdByName)(config, oldProfileName);
                // Jika tidak ketemu dengan nama lama, coba dengan nama baru (untuk kasus profile sudah diubah manual)
                if (!mikrotikId && newProfileName !== oldProfileName) {
                    mikrotikId = await (0, mikrotikService_1.findPppProfileIdByName)(config, newProfileName);
                }
                // Get updated profile data from database
                const [updatedRows] = await conn.execute('SELECT * FROM pppoe_profiles WHERE id = ?', [id]);
                const updatedProfile = Array.isArray(updatedRows) && updatedRows.length ? updatedRows[0] : null;
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
                console.log(`📊 [updateProfile] Final rate limit values - RX: ${rateLimitRx}, TX: ${rateLimitTx}`);
                if (mikrotikId) {
                    // Profile ditemukan di MikroTik, UPDATE
                    console.log(`🔄 [updateProfile] Updating profile di MikroTik: ${oldProfileName} -> ${newProfileName} (ID: ${mikrotikId})`);
                    console.log(`📊 [updateProfile] Rate Limit RX: ${rateLimitRx}, TX: ${rateLimitTx}`);
                    console.log(`📊 [updateProfile] Data yang akan dikirim:`, {
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
                    console.log(`📤 [updateProfile] Calling updatePppProfile with:`, {
                        name: finalName,
                        'rate-limit-rx': rateLimitRx,
                        'rate-limit-tx': rateLimitTx
                    });
                    await (0, mikrotikService_1.updatePppProfile)(config, mikrotikId, {
                        name: finalName, // Update nama jika berubah
                        'local-address': finalLocalAddress || undefined,
                        'remote-address': finalRemoteAddress || undefined,
                        'dns-server': finalDnsServer || undefined,
                        comment: finalComment || undefined,
                        'rate-limit-rx': rateLimitRx, // Pastikan selalu ada nilai
                        'rate-limit-tx': rateLimitTx, // Pastikan selalu ada nilai
                        'burst-limit-rx': (data.burst_limit_rx !== undefined && data.burst_limit_rx && data.burst_limit_rx.trim() !== '')
                            ? data.burst_limit_rx.trim()
                            : ((updatedProfile.burst_limit_rx && updatedProfile.burst_limit_rx.trim() !== '')
                                ? updatedProfile.burst_limit_rx.trim()
                                : undefined),
                        'burst-limit-tx': (data.burst_limit_tx !== undefined && data.burst_limit_tx && data.burst_limit_tx.trim() !== '')
                            ? data.burst_limit_tx.trim()
                            : ((updatedProfile.burst_limit_tx && updatedProfile.burst_limit_tx.trim() !== '')
                                ? updatedProfile.burst_limit_tx.trim()
                                : undefined),
                        'burst-threshold-rx': (data.burst_threshold_rx !== undefined && data.burst_threshold_rx && data.burst_threshold_rx.trim() !== '')
                            ? data.burst_threshold_rx.trim()
                            : ((updatedProfile.burst_threshold_rx && updatedProfile.burst_threshold_rx.trim() !== '')
                                ? updatedProfile.burst_threshold_rx.trim()
                                : undefined),
                        'burst-threshold-tx': (data.burst_threshold_tx !== undefined && data.burst_threshold_tx && data.burst_threshold_tx.trim() !== '')
                            ? data.burst_threshold_tx.trim()
                            : ((updatedProfile.burst_threshold_tx && updatedProfile.burst_threshold_tx.trim() !== '')
                                ? updatedProfile.burst_threshold_tx.trim()
                                : undefined),
                        'burst-time-rx': (data.burst_time_rx !== undefined && data.burst_time_rx && data.burst_time_rx.trim() !== '')
                            ? data.burst_time_rx.trim()
                            : ((updatedProfile.burst_time_rx && updatedProfile.burst_time_rx.trim() !== '')
                                ? updatedProfile.burst_time_rx.trim()
                                : undefined),
                        'burst-time-tx': (data.burst_time_tx !== undefined && data.burst_time_tx && data.burst_time_tx.trim() !== '')
                            ? data.burst_time_tx.trim()
                            : ((updatedProfile.burst_time_tx && updatedProfile.burst_time_tx.trim() !== '')
                                ? updatedProfile.burst_time_tx.trim()
                                : undefined)
                    });
                    console.log(`✅ Profile "${updatedProfile.name}" berhasil di-update di MikroTik dengan rate-limit: ${rateLimitRx}/${rateLimitTx}`);
                }
                else {
                    // Profile tidak ditemukan di MikroTik, CREATE baru
                    console.log(`➕ Profile "${oldProfileName}" tidak ditemukan di MikroTik, membuat profile baru...`);
                    await (0, mikrotikService_1.createPppProfile)(config, {
                        name: updatedProfile.name,
                        'local-address': updatedProfile.local_address || undefined,
                        'remote-address': updatedProfile.remote_address_pool || undefined,
                        'dns-server': updatedProfile.dns_server || undefined,
                        comment: updatedProfile.comment || undefined,
                        'rate-limit-rx': rateLimitRx,
                        'rate-limit-tx': rateLimitTx,
                        'burst-limit-rx': (updatedProfile.burst_limit_rx && updatedProfile.burst_limit_rx.trim() !== '')
                            ? updatedProfile.burst_limit_rx.trim()
                            : undefined,
                        'burst-limit-tx': (updatedProfile.burst_limit_tx && updatedProfile.burst_limit_tx.trim() !== '')
                            ? updatedProfile.burst_limit_tx.trim()
                            : undefined,
                        'burst-threshold-rx': (updatedProfile.burst_threshold_rx && updatedProfile.burst_threshold_rx.trim() !== '')
                            ? updatedProfile.burst_threshold_rx.trim()
                            : undefined,
                        'burst-threshold-tx': (updatedProfile.burst_threshold_tx && updatedProfile.burst_threshold_tx.trim() !== '')
                            ? updatedProfile.burst_threshold_tx.trim()
                            : undefined,
                        'burst-time-rx': (updatedProfile.burst_time_rx && updatedProfile.burst_time_rx.trim() !== '')
                            ? updatedProfile.burst_time_rx.trim()
                            : undefined,
                        'burst-time-tx': (updatedProfile.burst_time_tx && updatedProfile.burst_time_tx.trim() !== '')
                            ? updatedProfile.burst_time_tx.trim()
                            : undefined
                    });
                    console.log(`✅ Profile "${updatedProfile.name}" berhasil di-create di MikroTik dengan rate-limit: ${rateLimitRx}/${rateLimitTx}`);
                }
            }
            catch (syncError) {
                console.error(`❌ Gagal sync profile "${oldProfileName}" ke MikroTik:`, syncError);
                console.error('Error details:', {
                    message: syncError?.message,
                    stack: syncError?.stack,
                    code: syncError?.code
                });
                // Throw error agar user tahu sync gagal
                throw new Error(`Gagal sinkronisasi ke MikroTik: ${syncError?.message || 'Unknown error'}`);
            }
        }
    }
    finally {
        conn.release();
    }
}
async function deleteProfile(id) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Check if profile is used by any package
        const [packages] = await conn.execute('SELECT COUNT(*) as count FROM pppoe_packages WHERE profile_id = ?', [id]);
        const count = packages[0]?.count || 0;
        if (count > 0) {
            throw new Error(`Profil tidak dapat dihapus karena masih digunakan oleh ${count} paket`);
        }
        await conn.execute('DELETE FROM pppoe_profiles WHERE id = ?', [id]);
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=pppoeService.js.map