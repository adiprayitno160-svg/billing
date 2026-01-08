import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { getMikrotikInfo, getInterfaces, MikroTikConfig } from '../services/mikrotikService';
import { ServerMonitoringService } from '../services/serverMonitoringService';

function getLastNDatesLabels(days: number): string[] {
	const labels: string[] = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(now.getDate() - i);
		labels.push(d.toISOString().slice(0, 10));
	}
	return labels;
}

async function getTroubleCustomers(): Promise<any[]> {
	try {
		// Check which tables exist
		const [tables] = await databasePool.query(
			"SHOW TABLES"
		) as any[];

		const tableNames = Array.isArray(tables) ? tables.map((t: any) => Object.values(t)[0]) : [];
		const hasMaintenance = tableNames.includes('maintenance_schedules');
		const hasConnectionLogs = tableNames.includes('connection_logs');
		const hasStaticIpStatus = tableNames.includes('static_ip_ping_status');
		const hasSlaIncidents = tableNames.includes('sla_incidents');

		// Check if is_isolated column exists
		let hasIsolated = false;
		try {
			const [cols] = await databasePool.query(
				"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_isolated'"
			) as any[];
			hasIsolated = Array.isArray(cols) && cols.length > 0;
		} catch {
			hasIsolated = false;
		}

		// Check if issue_type and customer_id columns exist in maintenance_schedules
		let hasIssueType = false;
		let hasCustomerId = false;
		if (hasMaintenance) {
			try {
				const [cols] = await databasePool.query(
					"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_schedules' AND COLUMN_NAME IN ('issue_type', 'customer_id')"
				) as any[];
				const columnNames = (cols as any[]).map(c => c.COLUMN_NAME);
				hasIssueType = columnNames.includes('issue_type');
				hasCustomerId = columnNames.includes('customer_id');
			} catch {
				hasIssueType = false;
				hasCustomerId = false;
			}
		}

		// Build UNION query for all trouble sources
		const queries: string[] = [];
		const isolatedFilter = hasIsolated ? 'AND (c.is_isolated = 0 OR c.is_isolated IS NULL)' : '';

		// 1. Customers with maintenance schedules
		if (hasMaintenance) {
			const issueTypeColumn = hasIssueType ? "COALESCE(m.issue_type, 'Maintenance')" : "'Maintenance'";

			// If customer_id exists, use simple JOIN. If not, use JSON_CONTAINS on affected_customers
			if (hasCustomerId) {
				queries.push(`
					SELECT DISTINCT
						c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
						m.status as maintenance_status, 
						${issueTypeColumn} as issue_type, 
						m.created_at as trouble_since,
						'maintenance' as trouble_type
					FROM customers c
					INNER JOIN maintenance_schedules m ON c.id = m.customer_id 
					WHERE m.status IN ('scheduled', 'in_progress', 'ongoing')
						AND c.status IN ('active', 'suspended')
				`);
			} else {
				// Fallback if table uses affected_customers (JSON) instead of customer_id
				queries.push(`
					SELECT DISTINCT
						c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
						m.status as maintenance_status, 
						${issueTypeColumn} as issue_type, 
						m.created_at as trouble_since,
						'maintenance' as trouble_type
					FROM customers c
					INNER JOIN maintenance_schedules m ON (
						JSON_CONTAINS(m.affected_customers, CAST(c.id AS JSON))
						OR m.affected_area = c.address
					)
					WHERE m.status IN ('scheduled', 'in_progress', 'ongoing')
						AND c.status IN ('active', 'suspended')
				`);
			}
		}

		// 2. Static IP customers who are offline (not isolated)
		if (hasStaticIpStatus) {
			queries.push(`
				SELECT DISTINCT
					c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
					NULL as maintenance_status,
					'Offline' as issue_type,
					COALESCE(sips.last_offline_at, sips.last_check) as trouble_since,
					'offline' as trouble_type
				FROM customers c
				INNER JOIN static_ip_ping_status sips ON c.id = sips.customer_id
				WHERE c.connection_type = 'static_ip'
					AND sips.status = 'offline'
					AND c.status IN ('active', 'suspended')
					${isolatedFilter}
					AND sips.last_check >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
			`);
		}

		// 3. PPPoE customers who are offline (from connection_logs, not isolated)
		if (hasConnectionLogs) {
			queries.push(`
				SELECT DISTINCT
					c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
					NULL as maintenance_status,
					'Offline' as issue_type,
					cl_latest.timestamp as trouble_since,
					'offline' as trouble_type
				FROM customers c
				INNER JOIN (
					SELECT customer_id, MAX(timestamp) as max_timestamp
					FROM connection_logs
					WHERE service_type = 'pppoe'
						AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
					GROUP BY customer_id
				) cl_max ON c.id = cl_max.customer_id
				INNER JOIN connection_logs cl_latest ON c.id = cl_latest.customer_id 
					AND cl_latest.timestamp = cl_max.max_timestamp
					AND cl_latest.service_type = 'pppoe'
				WHERE c.connection_type = 'pppoe'
					AND cl_latest.status = 'offline'
					AND c.status IN ('active', 'suspended')
					${isolatedFilter}
					AND NOT EXISTS (
						SELECT 1 FROM connection_logs cl2
						WHERE cl2.customer_id = c.id
							AND cl2.status = 'online'
							AND cl2.timestamp > cl_latest.timestamp
							AND cl2.timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
					)
			`);
		}

		// 4. Customers with ongoing SLA incidents
		if (hasSlaIncidents) {
			queries.push(`
				SELECT DISTINCT
					c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
					NULL as maintenance_status,
					CONCAT('SLA: ', si.incident_type) as issue_type,
					si.start_time as trouble_since,
					'sla_incident' as trouble_type
				FROM customers c
				INNER JOIN sla_incidents si ON c.id = si.customer_id
				WHERE si.status = 'ongoing'
					AND c.status IN ('active', 'suspended')
			`);
		}

		if (queries.length === 0) {
			return [];
		}

		// Combine all queries with UNION and get unique customers (prioritize maintenance, then offline, then SLA)
		// Use GROUP BY to get only one record per customer (prioritize by trouble_type)
		const unionQuery = `
			SELECT 
				trouble.id, trouble.name, trouble.customer_code, trouble.pppoe_username, 
				trouble.status, trouble.connection_type,
				COALESCE(
					MAX(CASE WHEN trouble.trouble_type = 'maintenance' THEN trouble.maintenance_status END),
					MAX(trouble.maintenance_status)
				) as maintenance_status,
				COALESCE(
					MAX(CASE WHEN trouble.trouble_type = 'maintenance' THEN trouble.issue_type END),
					MAX(CASE WHEN trouble.trouble_type = 'offline' THEN trouble.issue_type END),
					MAX(CASE WHEN trouble.trouble_type = 'sla_incident' THEN trouble.issue_type END),
					MAX(trouble.issue_type)
				) as issue_type,
				MAX(trouble.trouble_since) as trouble_since,
				MIN(CASE trouble.trouble_type
					WHEN 'maintenance' THEN 1
					WHEN 'offline' THEN 2
					WHEN 'sla_incident' THEN 3
					ELSE 4
				END) as priority_type
			FROM (
				${queries.join(' UNION ALL ')}
			) as trouble
			GROUP BY trouble.id, trouble.name, trouble.customer_code, trouble.pppoe_username, trouble.status, trouble.connection_type
			ORDER BY 
				priority_type,
				MAX(trouble.trouble_since) DESC
			LIMIT 20
		`;

		const [rows] = await databasePool.query(unionQuery);

		return rows as any[];
	} catch (error) {
		console.error('Error fetching trouble customers:', error);
		return [];
	}
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
	try {
		// Check if late_payment_count column exists once (optimization)
		let hasLatePaymentCount = false;
		try {
			const [cols] = await databasePool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'late_payment_count'") as any;
			hasLatePaymentCount = cols.length > 0;
		} catch {
			hasLatePaymentCount = false;
		}

		// Parallel queries
		const [
			activeCustomersP,
			totalCustomersP,
			inactiveCustomersP,
			suspendedCustomersP,
			pppoeCustomersP,
			staticIpCustomersP,
			pppoePackagesP,
			pppoeProfilesP,
			newRequests7dP,
			recentRequestsP,
			chartRawP,
			oltCountP,
			odcCountP,
			odpCountP,
			mtSettingsP,
			troubleCustomersP,
			latePaymentHighRiskP,
			latePaymentWarning4P
		] = await Promise.all([
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE status='active'"),
			databasePool.query('SELECT COUNT(*) AS cnt FROM customers'),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE status='inactive'"),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE status='suspended'"),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE connection_type='pppoe'"),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE connection_type='static_ip'"),
			databasePool.query('SELECT COUNT(*) AS cnt FROM pppoe_packages'),
			databasePool.query('SELECT COUNT(*) AS cnt FROM pppoe_profiles'),
			databasePool.query('SELECT COUNT(*) AS cnt FROM pppoe_new_requests WHERE created_at >= (CURDATE() - INTERVAL 7 DAY)'),
			databasePool.query('SELECT customer_name, phone, package_id, created_at FROM pppoe_new_requests ORDER BY created_at DESC LIMIT 5'),
			databasePool.query("SELECT DATE(created_at) AS d, COUNT(*) AS c FROM pppoe_new_requests WHERE created_at >= (CURDATE() - INTERVAL 6 DAY) GROUP BY DATE(created_at)"),
			databasePool.query('SELECT COUNT(*) AS cnt FROM ftth_olt'),
			databasePool.query('SELECT COUNT(*) AS cnt FROM ftth_odc'),
			databasePool.query('SELECT COUNT(*) AS cnt FROM ftth_odp'),
			databasePool.query('SELECT id, host, port, username, password, use_tls, created_at, updated_at FROM mikrotik_settings ORDER BY id DESC LIMIT 1'),
			getTroubleCustomers(),
			(async () => {
				if (!hasLatePaymentCount) return [[{ cnt: 0 }]];
				try {
					const [result] = await databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE COALESCE(late_payment_count, 0) >= 3") as any;
					return result;
				} catch { return [[{ cnt: 0 }]]; }
			})(),
			(async () => {
				if (!hasLatePaymentCount) return [[{ cnt: 0 }]];
				try {
					const [result] = await databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE COALESCE(late_payment_count, 0) >= 4") as any;
					return result;
				} catch { return [[{ cnt: 0 }]]; }
			})()
		]);

		const activeCustomers = (activeCustomersP[0] as any)[0]?.cnt ?? 0;
		const pppoePackages = (pppoePackagesP[0] as any)[0]?.cnt ?? 0;
		const pppoeProfiles = (pppoeProfilesP[0] as any)[0]?.cnt ?? 0;
		const totalCustomers = (totalCustomersP[0] as any)[0]?.cnt ?? 0;
		const inactiveCustomers = (inactiveCustomersP[0] as any)[0]?.cnt ?? 0;
		const suspendedCustomers = (suspendedCustomersP[0] as any)[0]?.cnt ?? 0;
		const pppoeCustomers = (pppoeCustomersP[0] as any)[0]?.cnt ?? 0;
		const staticIpCustomers = (staticIpCustomersP[0] as any)[0]?.cnt ?? 0;
		const oltCount = (oltCountP[0] as any)[0]?.cnt ?? 0;
		const odcCount = (odcCountP[0] as any)[0]?.cnt ?? 0;
		const odpCount = (odpCountP[0] as any)[0]?.cnt ?? 0;
		const newRequests = (newRequests7dP[0] as any)[0]?.cnt ?? 0;
		const recentRequests = (recentRequestsP[0] as any) ?? [];
		// Ensure troubleCustomers is always an array
		const troubleCustomers = Array.isArray(troubleCustomersP) ? troubleCustomersP : [];
		const latePaymentHighRisk = (latePaymentHighRiskP[0] as any)[0]?.cnt ?? 0;
		const latePaymentWarning4 = (latePaymentWarning4P[0] as any)[0]?.cnt ?? 0;

		const labels = getLastNDatesLabels(7);
		const pointsMap: Record<string, number> = Object.create(null);
		for (const row of (chartRawP[0] as any)) {
			const k = new Date(row.d).toISOString().slice(0, 10);
			pointsMap[k] = Number(row.c) || 0;
		}
		const dataPoints = labels.map((label) => pointsMap[label] ?? 0);

		const mtSettings = Array.isArray(mtSettingsP[0]) && (mtSettingsP[0] as any[]).length ? (mtSettingsP[0] as any[])[0] : null;

		// Get MikroTik information if settings exist
		let mikrotikInfo: any = null;
		let interfaces: any[] = [];
		let connectionStatus = { connected: false, error: null };

		if (mtSettings) {
			try {
				// Validate that password exists
				if (!mtSettings.password) {
					throw new Error('Password MikroTik tidak ditemukan. Silakan konfigurasi ulang di Settings > MikroTik');
				}

				const config: MikroTikConfig = {
					host: mtSettings.host,
					port: mtSettings.port,
					username: mtSettings.username,
					password: mtSettings.password,
					use_tls: mtSettings.use_tls
				};

				console.log(`[Dashboard] Attempting to connect to MikroTik at ${config.host}:${config.port}...`);

				// Perform requests in parallel with a short timeout (2s) to prevent blocking page load
				const timeoutMs = 2000; // reduced timeout to avoid long loading times
				const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MikroTik connection timeout')), timeoutMs));

				// Helper to catch errors individually
				const fetchInfo = getMikrotikInfo(config).catch(err => {
					console.error('[Dashboard] MikroTik Info fetch failed:', err.message);
					return null;
				});

				const fetchInterfaces = getInterfaces(config).catch(err => {
					console.error('[Dashboard] MikroTik Interface fetch failed:', err.message);
					return [];
				});

				// Wait for both or timeout
				// We use Promise.all to fire both, but wrap the whole thing in a race with timeout
				// However, individual catches above ensure one failure doesn't stop the other from "completing" (returning null)
				// The timeout protects against BOTH hanging.
				const [infoResult, interfacesResult] = await Promise.race([
					Promise.all([fetchInfo, fetchInterfaces]),
					timeoutPromise
				]) as [any, any[]];

				mikrotikInfo = infoResult;
				interfaces = interfacesResult || [];

				// Check connection status based on info result
				if (mikrotikInfo) {
					console.log(`[Dashboard] ✅ MikroTik info retrieved successfully`);
					connectionStatus = { connected: true, error: null };
				} else {
					console.warn(`[Dashboard] ⚠️ MikroTik info missing (timeout or error)`);
					connectionStatus = { connected: false, error: 'Connection timeout or error' };
				}

				if (interfaces.length > 0) {
					console.log(`[Dashboard] ✅ Retrieved ${interfaces.length} interfaces`);
				} else {
					console.warn(`[Dashboard] ⚠️ No interfaces retrieved (timeout or error)`);
				}

			} catch (error: any) {
				const errorMessage = error?.message || 'Gagal mengambil data MikroTik';
				console.error(`[Dashboard] ❌ Error connecting to MikroTik:`, errorMessage);
				connectionStatus = { connected: false, error: errorMessage };
				// Set empty arrays to prevent undefined errors in view
				mikrotikInfo = null;
				interfaces = [];
			}
		}

		// Get server monitoring status
		let serverMonitoring = null;
		try {
			serverMonitoring = await ServerMonitoringService.getServerStatus();
		} catch (error: any) {
			console.error(`[Dashboard] ❌ Error getting server monitoring:`, error);
		}

		res.render('dashboard/index', {
			title: 'Dashboard',
			stats: {
				activeCustomers,
				inactiveCustomers,
				suspendedCustomers,
				totalCustomers,
				pppoeCustomers,
				staticIpCustomers,
				pppoePackages,
				pppoeProfiles,
				newRequests,
				oltCount,
				odcCount,
				odpCount
			},
			latePaymentStats: {
				highRisk: latePaymentHighRisk,
				warning4: latePaymentWarning4
			},
			recentRequests,
			troubleCustomers,
			chart: { labels, data: dataPoints },
			settings: mtSettings,
			mikrotikInfo,
			interfaces,
			connectionStatus,
			serverMonitoring
		});
	} catch (error: any) {
		console.error('CRITICAL DASHBOARD ERROR:', error);
		// Render fallback dashboard
		res.render('dashboard/index', {
			title: 'Dashboard (Recovery Mode)',
			stats: {
				activeCustomers: 0,
				inactiveCustomers: 0,
				suspendedCustomers: 0,
				totalCustomers: 0,
				pppoeCustomers: 0,
				staticIpCustomers: 0,
				pppoePackages: 0,
				pppoeProfiles: 0,
				newRequests: 0,
				oltCount: 0,
				odcCount: 0,
				odpCount: 0
			},
			latePaymentStats: { highRisk: 0, warning4: 0 },
			recentRequests: [],
			troubleCustomers: [],
			chart: { labels: [], data: [] },
			settings: null,
			mikrotikInfo: null,
			interfaces: [],
			connectionStatus: { connected: false, error: error.message },
			serverMonitoring: null
		});
	}
}

// Cache untuk interface stats (5 detik)
let interfaceStatsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5 detik

export async function getInterfaceStats(req: Request, res: Response): Promise<void> {
	try {
		// Check cache first
		const now = Date.now();
		if (interfaceStatsCache && (now - interfaceStatsCache.timestamp) < CACHE_DURATION) {
			res.json(interfaceStatsCache.data);
			return;
		}

		const [mtSettingsRows] = await databasePool.query('SELECT id, host, port, username, password, use_tls, created_at, updated_at FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
		const mtSettings = Array.isArray(mtSettingsRows) && mtSettingsRows.length ? (mtSettingsRows as any[])[0] : null;

		if (!mtSettings) {
			res.json([]);
			return;
		}

		// Validate password exists
		if (!mtSettings.password) {
			console.error('[getInterfaceStats] ❌ Password MikroTik tidak ditemukan');
			res.status(500).json({ error: 'Password MikroTik tidak ditemukan. Silakan konfigurasi ulang di Settings > MikroTik' });
			return;
		}

		const config: MikroTikConfig = {
			host: mtSettings.host,
			port: mtSettings.port,
			username: mtSettings.username,
			password: mtSettings.password,
			use_tls: mtSettings.use_tls
		};

		// Add timeout protection - max 5 seconds
		const timeoutPromise = new Promise<any[]>((_, reject) => {
			setTimeout(() => reject(new Error('MikroTik request timeout')), 5000);
		});

		const interfacesPromise = getInterfaces(config);
		const interfaces = await Promise.race([interfacesPromise, timeoutPromise]);

		// Update cache
		interfaceStatsCache = {
			data: interfaces,
			timestamp: now
		};

		res.json(interfaces);
	} catch (error: any) {
		console.error('Error fetching interface stats:', error);

		// Return cached data if available, even if expired
		if (interfaceStatsCache) {
			res.json(interfaceStatsCache.data);
		} else {
			res.json([]);
		}
	}
}


