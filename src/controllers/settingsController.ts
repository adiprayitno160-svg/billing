import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { testMikrotikConnection, getMikrotikInfo } from '../services/mikrotikService';
// import { SSHService } from '../services/sshService';

type MikroTikSettings = {
	id?: number;
	host: string;
	port: number;
	username: string;
	password: string;
	use_tls: boolean;
};

type SSHOLTSettings = {
	id?: number;
	olt_host: string;
	olt_username: string;
	olt_password: string;
	olt_ssh_port: number;
	connection_timeout: number;
	command_timeout: number;
	ssh_enabled: boolean;
};

export async function getMikrotikSettingsForm(req: Request, res: Response): Promise<void> {
	const [rows] = await databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
	const settings = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : null;

	// Don't auto-test connection on page load to prevent timeout and socket exhaustion
	// User can manually test using the "Test Connection" button
	const status: { connected: boolean; info?: any; error?: string } | undefined = undefined;

	res.render('settings/mikrotik', { title: 'Pengaturan MikroTik', settings, status });
}

export async function postMikrotikSettings(req: Request, res: Response): Promise<void> {
	const payload: MikroTikSettings = {
		host: String(req.body.host ?? ''),
		port: Number(req.body.port ?? 8728),
		username: String(req.body.username ?? ''),
		password: String(req.body.password ?? ''),
		use_tls: Boolean(req.body.use_tls)
	};

	// Check if is_active column exists
	const [columnCheck] = await databasePool.query<RowDataPacket[]>(
		`SELECT COLUMN_NAME 
		 FROM INFORMATION_SCHEMA.COLUMNS 
		 WHERE TABLE_SCHEMA = DATABASE() 
		   AND TABLE_NAME = 'mikrotik_settings' 
		   AND COLUMN_NAME = 'is_active'`
	);

	const hasIsActiveColumn = Array.isArray(columnCheck) && columnCheck.length > 0;

	const [rows] = await databasePool.query('SELECT id FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
	const exists = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any).id : null;

	if (exists) {
		// Set all to inactive first (if column exists), then set current to active
		if (hasIsActiveColumn) {
			await databasePool.query('UPDATE mikrotik_settings SET is_active = 0 WHERE is_active = 1');
			await databasePool.query(
				'UPDATE mikrotik_settings SET host=?, port=?, username=?, password=?, use_tls=?, is_active=1 WHERE id=?',
				[payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0, exists]
			);
		} else {
			await databasePool.query(
				'UPDATE mikrotik_settings SET host=?, port=?, username=?, password=?, use_tls=? WHERE id=?',
				[payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0, exists]
			);
		}
	} else {
		// Insert new with is_active=1 if column exists
		if (hasIsActiveColumn) {
			await databasePool.query(
				'INSERT INTO mikrotik_settings (host, port, username, password, use_tls, is_active) VALUES (?, ?, ?, ?, ?, 1)',
				[payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0]
			);
		} else {
			await databasePool.query(
				'INSERT INTO mikrotik_settings (host, port, username, password, use_tls) VALUES (?, ?, ?, ?, ?)',
				[payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0]
			);
		}
	}

	// Setelah simpan, langsung uji koneksi untuk memberi notifikasi terhubung atau tidak
	try {
		const testResult = await testMikrotikConnection(payload);
		if (testResult.connected) {
			res.redirect('/settings/mikrotik?connected=1');
		} else {
			const errMsg = encodeURIComponent(testResult.error || 'Gagal terhubung');
			res.redirect(`/settings/mikrotik?connected=0&error=${errMsg}`);
		}
		return;
	} catch (e: any) {
		const errMsg = encodeURIComponent(e?.message || 'Gagal terhubung');
		res.redirect(`/settings/mikrotik?connected=0&error=${errMsg}`);
		return;
	}
}

// Export this function to be used by the API route
export async function getMikrotikInfoApi(req: Request, res: Response): Promise<void> {
	try {
		const [rows] = await databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
		const settings = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : null;

		if (!settings) {
			res.status(404).json({ ok: false, error: 'Mikrotik settings not found' });
			return;
		}

		const cfg: MikroTikSettings = {
			host: settings.host,
			port: settings.port,
			username: settings.username,
			password: settings.password,
			use_tls: settings.use_tls === 1
		};

		// Add timeout (5 seconds)
		const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000));
		const infoPromise = getMikrotikInfo(cfg);

		const info = await Promise.race([infoPromise, timeoutPromise]);

		res.json({ ok: true, info });
	} catch (error: any) {
		console.error('[API] Error fetching Mikrotik info:', error);
		res.status(500).json({ ok: false, error: error.message || 'Failed to fetch Mikrotik info' });
	}
}

export async function postMikrotikTest(req: Request, res: Response): Promise<void> {
	const cfg: MikroTikSettings = {
		host: String(req.body.host ?? process.env.MT_HOST ?? '127.0.0.1'),
		port: Number(req.body.port ?? process.env.MT_PORT ?? 8728),
		username: String(req.body.username ?? process.env.MT_USER ?? ''),
		password: String(req.body.password ?? process.env.MT_PASSWORD ?? ''),
		use_tls: Boolean(req.body.use_tls ?? (process.env.MT_TLS === 'true'))
	};

	try {
		const testResult = await testMikrotikConnection(cfg);
		if (testResult.connected) {
			let info: any = undefined;
			try {
				info = await getMikrotikInfo(cfg);
			} catch { }
			res.status(200).json({ ok: true, info });
		} else {
			res.status(500).json({ ok: false, error: testResult.error || 'Failed to connect' });
		}
	} catch (err: any) {
		res.status(500).json({ ok: false, error: err?.message ?? 'Failed to connect' });
	}
}

// SSH OLT Settings Functions
export async function getSSHOLTSettingsForm(req: Request, res: Response): Promise<void> {
	try {
		// Get settings from database or use defaults
		const [rows] = await databasePool.query('SELECT * FROM ssh_olt_settings ORDER BY id DESC LIMIT 1');
		let settings = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : null;

		// If no settings in database, use environment variables or defaults
		if (!settings) {
			settings = {
				olt_host: process.env.OLT_HOST || '10.11.104.2',
				olt_username: process.env.OLT_USERNAME || 'root',
				olt_password: process.env.OLT_PASSWORD || 'admin',
				olt_ssh_port: parseInt(process.env.OLT_SSH_PORT || '22'),
				connection_timeout: 10000,
				command_timeout: 3000,
				ssh_enabled: process.env.SSH_ENABLED !== 'false'
			};
		}

		res.render('settings/ssh-olt', {
			title: 'Pengaturan SSH OLT',
			settings
		});
	} catch (error: any) {
		console.error('Error getting SSH OLT settings:', error);
		res.render('settings/ssh-olt', {
			title: 'Pengaturan SSH OLT',
			settings: null,
			error: error.message
		});
	}
}

export async function postSSHOLTSettings(req: Request, res: Response): Promise<void> {
	try {
		const payload: SSHOLTSettings = {
			olt_host: String(req.body.olt_host ?? '10.11.104.2'),
			olt_username: String(req.body.olt_username ?? 'admin'),
			olt_password: String(req.body.olt_password ?? ''),
			olt_ssh_port: Number(req.body.olt_ssh_port ?? 22),
			connection_timeout: Number(req.body.connection_timeout ?? 30000),
			command_timeout: Number(req.body.command_timeout ?? 10000),
			ssh_enabled: Boolean(req.body.ssh_enabled)
		};

		// Check if settings already exist
		const [existingRows] = await databasePool.query('SELECT id FROM ssh_olt_settings ORDER BY id DESC LIMIT 1');
		const existingSettings = Array.isArray(existingRows) && existingRows.length > 0 ? (existingRows[0] as any) : null;

		if (existingSettings) {
			// Update existing settings
			await databasePool.execute(
				`UPDATE ssh_olt_settings SET 
					olt_host = ?, olt_username = ?, olt_password = ?, olt_ssh_port = ?, 
					connection_timeout = ?, command_timeout = ?, ssh_enabled = ?, updated_at = NOW()
				 WHERE id = ?`,
				[
					payload.olt_host, payload.olt_username, payload.olt_password, payload.olt_ssh_port,
					payload.connection_timeout, payload.command_timeout, payload.ssh_enabled, existingSettings.id
				]
			);
		} else {
			// Insert new settings
			await databasePool.execute(
				`INSERT INTO ssh_olt_settings (olt_host, olt_username, olt_password, olt_ssh_port, connection_timeout, command_timeout, ssh_enabled, created_at, updated_at) 
				 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
				[
					payload.olt_host, payload.olt_username, payload.olt_password, payload.olt_ssh_port,
					payload.connection_timeout, payload.command_timeout, payload.ssh_enabled
				]
			);
		}

		// Update environment variables (optional - for immediate effect)
		process.env.OLT_HOST = payload.olt_host;
		process.env.OLT_USERNAME = payload.olt_username;
		process.env.OLT_PASSWORD = payload.olt_password;
		process.env.OLT_SSH_PORT = payload.olt_ssh_port.toString();
		process.env.SSH_ENABLED = payload.ssh_enabled.toString();

		res.redirect('/settings/ssh-olt?success=1');
	} catch (error: any) {
		console.error('Error saving SSH OLT settings:', error);
		const errMsg = encodeURIComponent(error?.message || 'Gagal menyimpan pengaturan');
		res.redirect(`/settings/ssh-olt?error=${errMsg}`);
	}
}

export async function testSSHOLTConnection(req: Request, res: Response): Promise<void> {
	try {
		// SSHService temporarily disabled
		res.status(500).json({
			success: false,
			message: 'SSH Service tidak tersedia'
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: error?.message || 'Gagal menguji koneksi SSH'
		});
	}
}

export async function getSSHOLTStatus(req: Request, res: Response): Promise<void> {
	try {
		// SSHService temporarily disabled
		res.status(200).json({
			success: true,
			data: {
				enabled: false,
				status: 'disabled'
			}
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: error?.message || 'Gagal mendapatkan status SSH'
		});
	}
}

export async function getSSHOLTStatistics(req: Request, res: Response): Promise<void> {
	try {
		// SSHService temporarily disabled
		res.status(500).json({
			success: false,
			message: 'SSH Service tidak tersedia'
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: error?.message || 'Gagal mendapatkan statistik OLT'
		});
	}
}


