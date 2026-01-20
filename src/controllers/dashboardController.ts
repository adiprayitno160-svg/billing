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

// Cache schema capabilities to avoid expensive INFORMATION_SCHEMA queries on every request
let schemaCache: {
	checked: boolean;
	hasMaintenance: boolean;
	hasConnectionLogs: boolean;
	hasStaticIpStatus: boolean;
	hasSlaIncidents: boolean;
	hasIsolated: boolean;
	hasIssueType: boolean;
	hasCustomerId: boolean;
} | null = null;

// function getRecentAlerts() removed to clean logs

async function getTroubleCustomers(): Promise<any[]> {
	try {
		// Query Maintenance Schedules
		const [maintenance] = await databasePool.query(`
            SELECT 
                c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                m.status as maintenance_status, 
                COALESCE(m.issue_type, 'Maintenance') as issue_type, 
                m.created_at as trouble_since,
                'maintenance' as trouble_type
            FROM maintenance_schedules m
            JOIN customers c ON m.customer_id = c.id
            WHERE m.status IN ('scheduled', 'in_progress', 'ongoing')
              AND c.status = 'active'
        `) as any[];

		// Query Network Devices (Unified PPPoE & Static IP Monitoring)
		// Shows Offline first, then Online (limit 50 total)
		const [devices] = await databasePool.query(`
            SELECT 
                c.id, c.name, c.customer_code, c.pppoe_username, c.status as customer_status, c.connection_type,
                NULL as maintenance_status,
                CONCAT(UCASE(LEFT(d.status, 1)), SUBSTRING(d.status, 2)) as issue_type, -- Online/Offline
                d.last_seen as trouble_since,
                'monitoring' as trouble_type,
                d.status as device_status
            FROM network_devices d
            JOIN customers c ON d.customer_id = c.id
            WHERE d.device_type = 'customer'
              AND c.status = 'active'
            ORDER BY 
                CASE WHEN d.status = 'offline' THEN 1 ELSE 2 END ASC,
                d.last_seen DESC
            LIMIT 50
        `) as any[];

		// Combine
		// Maintenance takes precedence
		const result = [
			...(Array.isArray(maintenance) ? maintenance : []),
			...(Array.isArray(devices) ? devices : [])
		];

		// Unique by ID (Maintenance details override monitoring if duplicate)
		const unique = new Map();
		result.forEach(r => {
			if (!unique.has(r.id)) {
				unique.set(r.id, r);
			}
		});

		return Array.from(unique.values()).sort((a, b) => {
			// Sorot Priority: Maintenance > Offline > Online
			const getScore = (item: any) => {
				if (item.trouble_type === 'maintenance') return 1;
				if (item.device_status === 'offline') return 2;
				return 3;
			};
			return getScore(a) - getScore(b);
		}).slice(0, 50);

	} catch (error) {
		console.error('Error fetching trouble customers:', error);
		return [];
	}
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
	try {
		// Check if late_payment_count column exists (using cache if available)
		let hasLatePaymentCount = false;
		if (schemaCache && (schemaCache as any).hasLatePaymentCount !== undefined) {
			hasLatePaymentCount = (schemaCache as any).hasLatePaymentCount;
		} else {
			try {
				const [cols] = await databasePool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'late_payment_count'") as any;
				hasLatePaymentCount = cols.length > 0;
				// Update cache
				if (schemaCache) {
					(schemaCache as any).hasLatePaymentCount = hasLatePaymentCount;
				}
			} catch {
				hasLatePaymentCount = false;
			}
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
		const recentAlerts: any[] = []; // Forced empty
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

		// Client-side loading for Mikrotik Info (Faster dashboard load)
		let mikrotikInfo: any = null;
		let interfaces: any[] = [];
		let connectionStatus = { connected: false, error: null }; // Default status

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
			recentAlerts,
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


