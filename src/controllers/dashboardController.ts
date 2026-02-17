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


export async function getTroubleCustomers(): Promise<any[]> {
	try {
		// Query Maintenance Schedules
		let maintenance: any[] = [];
		try {
			// Check if customer_id column exists in maintenance_schedules
			const [cols] = await databasePool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_schedules' AND COLUMN_NAME = 'customer_id'") as any;

			if (cols.length > 0) {
				const [rows] = await databasePool.query(`
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
				maintenance = rows;
			} else {
				// If no customer_id, maintenance is likely area-based or uses JSON field. 
				// For now, we return empty or handle area-based if needed.
				console.log('[Dashboard] Skipping maintenance-customer join: customer_id column missing.');
			}
		} catch (err: any) {
			console.error('[Dashboard] Error in maintenance query:', err.message);
		}

		// Query Network Devices (Unified PPPoE & Static IP Monitoring)
		// Shows Offline first, then Online (limit 50 total)
		// Query Network Devices using AdvancedMonitoringService
		const { AdvancedMonitoringService } = await import('../services/monitoring/AdvancedMonitoringService');
		const monitoringData = await AdvancedMonitoringService.getAllCustomersWithStatus(false);

		const monitoringMap = new Map();
		monitoringData.customers.forEach((c: any) => monitoringMap.set(c.id, c));

		// Map Maintenance with live status
		const maintenanceMapped = maintenance.map((m: any) => {
			const live = monitoringMap.get(m.id);
			return {
				...m,
				device_status: live ? live.status : 'unknown',
				last_offline_at: live ? live.last_offline_at : null,
				last_check: live ? live.last_check : null
			};
		});

		// Map Monitoring Devices
		const devices = monitoringData.customers
			.filter((c: any) => c.status === 'offline' || c.status === 'degraded' || c.status === 'isolated')
			.map((c: any) => ({
				id: c.id,
				name: c.name,
				customer_code: c.customer_code,
				pppoe_username: c.pppoe_username,
				customer_status: c.status === 'isolated' ? 'suspended' : 'active',
				connection_type: c.connection_type,
				maintenance_status: null,
				issue_type: c.status === 'offline' ? 'Offline' : (c.status === 'isolated' ? 'Isolir' : 'Degraded'),
				trouble_since: c.status === 'offline' ? (c.last_offline_at || c.last_check || new Date()) : null,
				trouble_type: 'monitoring',
				device_status: c.status,
				phone: c.phone
			}));

		// Combine
		const result = [
			...maintenanceMapped,
			...devices
		];

		// Unique by ID (Maintenance details override monitoring if duplicate)
		const unique = new Map();
		result.forEach(r => {
			if (!unique.has(r.id)) {
				unique.set(r.id, r);
			} else if (r.trouble_type === 'maintenance') {
				// Maintenance record has more priority info, but preserve device_status
				const existing = unique.get(r.id);
				unique.set(r.id, { ...r, device_status: r.device_status || existing.device_status });
			}
		});

		return Array.from(unique.values()).sort((a, b) => {
			const getScore = (item: any) => {
				if (item.device_status === 'offline') return 1;
				if (item.trouble_type === 'maintenance') return 2;
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
			latePaymentWarning4P,
			verifyingJobsP,
			pendingPaymentsP
		] = await Promise.all([
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE status='active' AND is_isolated=0"),
			databasePool.query('SELECT COUNT(*) AS cnt FROM customers'),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE status='inactive'"),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE is_isolated=1 AND status='active'"),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE connection_type='pppoe' AND status='active'"),
			databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE connection_type='static_ip' AND status='active'"),
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
			})(),
			databasePool.query("SELECT j.*, c.name as customer_name, c.customer_code FROM technician_jobs j LEFT JOIN customers c ON j.customer_id = c.id WHERE j.status = 'verifying' ORDER BY j.created_at DESC"),
			databasePool.query("SELECT v.*, c.name as customer_name, c.customer_code FROM manual_payment_verifications v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.status = 'pending' ORDER BY v.created_at DESC LIMIT 5")
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
		const verifyingJobs = Array.isArray(verifyingJobsP[0]) ? (verifyingJobsP[0] as any[]) : [];
		const pendingPaymentVerifications = (pendingPaymentsP[0] as any)[0]?.cnt ?? 0;

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

		// Attempt to fetch interfaces for Live Traffic widget (Timeout 2s to prevent dashboard lag)
		if (mtSettings) {
			try {
				const config: MikroTikConfig = {
					host: mtSettings.host,
					port: mtSettings.port,
					username: mtSettings.username,
					password: mtSettings.password,
					use_tls: mtSettings.use_tls
				};

				// Fast timeout 2s
				const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Dashboard interface fetch timeout')), 2000));
				const fetchPromise = getInterfaces(config);

				interfaces = await Promise.race([fetchPromise, timeoutPromise]) as any[];
			} catch (err) {
				console.warn('[Dashboard] Skipping interface fetch (slow network/offline):', err);
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
				odpCount,
				pendingPaymentVerifications: Array.isArray(pendingPaymentsP[0]) ? (pendingPaymentsP[0] as any[]).length : 0
			},
			latePaymentStats: {
				highRisk: latePaymentHighRisk,
				warning4: latePaymentWarning4
			},
			verifyingJobs,
			pendingPaymentVerifications: Array.isArray(pendingPaymentsP[0]) ? (pendingPaymentsP[0] as any[]) : [],
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


