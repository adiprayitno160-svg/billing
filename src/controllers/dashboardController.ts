import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { getMikrotikInfo, getInterfaces, MikroTikConfig } from '../services/mikrotikService';

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
		// Check if maintenance_schedules table exists
		const [tables] = await databasePool.query(
			"SHOW TABLES LIKE 'maintenance_schedules'"
		);
		
		if (!tables || (Array.isArray(tables) && tables.length === 0)) {
			// Table doesn't exist, return empty array
			return [];
		}

		// Table exists, get trouble customers
		const [rows] = await databasePool.query(`
			SELECT c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
				   m.status as maintenance_status, m.issue_type, m.created_at as trouble_since
			FROM customers c
			LEFT JOIN maintenance_schedules m ON c.id = m.customer_id AND m.status IN ('scheduled', 'in_progress')
			WHERE c.status IN ('active', 'suspended')
			ORDER BY m.created_at DESC
			LIMIT 10
		`);
		
		return rows as any[];
	} catch (error) {
		console.error('Error fetching trouble customers:', error);
		return [];
	}
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
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
		prepaidCustomersP,
		activeSubscriptionsP
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
		databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1'),
		getTroubleCustomers(),
		databasePool.query("SELECT COUNT(*) AS cnt FROM customers WHERE billing_mode='prepaid'"),
		databasePool.query("SELECT COUNT(*) AS cnt FROM prepaid_package_subscriptions WHERE status='active' AND expiry_date > NOW()")
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
	const troubleCustomers = troubleCustomersP ?? [];
	const prepaidCustomers = (prepaidCustomersP[0] as any)[0]?.cnt ?? 0;
	const activeSubscriptions = (activeSubscriptionsP[0] as any)[0]?.cnt ?? 0;

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
			const config: MikroTikConfig = {
				host: mtSettings.host,
				port: mtSettings.port,
				username: mtSettings.username,
				password: mtSettings.password,
				use_tls: mtSettings.use_tls
			};
			
			mikrotikInfo = await getMikrotikInfo(config);
			interfaces = await getInterfaces(config);
			connectionStatus = { connected: true, error: null };
		} catch (error: any) {
			connectionStatus = { connected: false, error: error?.message || 'Gagal mengambil data MikroTik' };
		}
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
		prepaidStats: {
			totalPrepaid: prepaidCustomers,
			activeSubscriptions: activeSubscriptions
		},
		recentRequests,
		troubleCustomers,
		chart: { labels, data: dataPoints },
		settings: mtSettings,
		mikrotikInfo,
		interfaces,
		connectionStatus
	});
}

export async function getInterfaceStats(req: Request, res: Response): Promise<void> {
	try {
		const [mtSettingsRows] = await databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
		const mtSettings = Array.isArray(mtSettingsRows) && mtSettingsRows.length ? (mtSettingsRows as any[])[0] : null;

		if (!mtSettings) {
			res.json([]);
			return;
		}

		const config: MikroTikConfig = {
			host: mtSettings.host,
			port: mtSettings.port,
			username: mtSettings.username,
			password: mtSettings.password,
			use_tls: mtSettings.use_tls
		};

		const interfaces = await getInterfaces(config);
		res.json(interfaces);
	} catch (error: any) {
		console.error('Error fetching interface stats:', error);
		res.json([]);
	}
}


