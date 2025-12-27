import * as dotenv from 'dotenv';
import * as mysql from 'mysql2/promise';

// Don't override environment variables from PM2/system
dotenv.config({ override: false });

const databaseHost = process.env.DB_HOST ?? 'localhost';
const databasePort = Number(process.env.DB_PORT ?? 3306);
const databaseUser = process.env.DB_USER ?? 'root';
const databasePassword = process.env.DB_PASSWORD ?? '';
const databaseName = process.env.DB_NAME ?? 'billing';

export const databasePool = mysql.createPool({
	host: databaseHost,
	port: databasePort,
	user: databaseUser,
	password: databasePassword,
	database: databaseName,
	waitForConnections: true,
	connectionLimit: 20, // Increased from 10 for better concurrency
	queueLimit: 0,
	enableKeepAlive: true,
	keepAliveInitialDelay: 0,
	// Connection pool optimization
	idleTimeout: 300000, // 5 minutes
	maxIdle: 10
});

export async function checkDatabaseConnection(): Promise<void> {
	const connection = await databasePool.getConnection();
	try {
		await connection.ping();
	} finally {
		connection.release();
	}
}

// Export database pool as db for compatibility
export const db = databasePool;

// Default export for common usage
export default databasePool;

export async function ensureInitialSchema(): Promise<void> {
	// Create database if not exists using a connection without default DB
	const rootConnection = await mysql.createConnection({
		host: databaseHost,
		port: databasePort,
		user: databaseUser,
		password: databasePassword
	});
	try {
		await rootConnection.query(
			`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
		);
	} finally {
		await rootConnection.end();
	}

	// Ensure essential table exists
	const conn = await databasePool.getConnection();
	try {
		// Create customers table first (many other tables reference this)
		await conn.query(`CREATE TABLE IF NOT EXISTS customers (
			id INT AUTO_INCREMENT PRIMARY KEY,
			customer_code VARCHAR(191) UNIQUE,
			name VARCHAR(191) NOT NULL,
			phone VARCHAR(50) NULL,
			email VARCHAR(191) NULL,
			address TEXT NULL,
			odc_id INT NULL,
			odp_id INT NULL,
			connection_type ENUM('pppoe','static_ip') DEFAULT 'pppoe',
			status ENUM('active','inactive','suspended') DEFAULT 'active',
			latitude DECIMAL(10,7) NULL,
			longitude DECIMAL(10,7) NULL,
			pppoe_username VARCHAR(191) NULL,
			area VARCHAR(191) NULL,
			odc_location VARCHAR(191) NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_customer_code (customer_code),
			INDEX idx_status (status),
			INDEX idx_connection_type (connection_type),
			INDEX idx_pppoe_username (pppoe_username)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		await conn.query(`CREATE TABLE IF NOT EXISTS mikrotik_settings (
			id INT AUTO_INCREMENT PRIMARY KEY,
			host VARCHAR(191) NOT NULL,
			port INT NOT NULL DEFAULT 8728,
			username VARCHAR(191) NOT NULL,
			password VARCHAR(191) NOT NULL,
			use_tls TINYINT(1) NOT NULL DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`);

		// Create static_ip_packages table with correct structure
		await conn.query(`CREATE TABLE IF NOT EXISTS static_ip_packages (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(191) NOT NULL,
			parent_upload_name VARCHAR(191) NULL,
			parent_download_name VARCHAR(191) NULL,
			max_limit_upload VARCHAR(50) NOT NULL,
			max_limit_download VARCHAR(50) NOT NULL,
			price DECIMAL(12,2) DEFAULT 0,
			duration_days INT DEFAULT 30,
			status ENUM('active','inactive') DEFAULT 'active',
			description TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`);

		// Ensure static_ip_packages has parent_upload_name and parent_download_name columns
		try {
			await conn.query(`ALTER TABLE static_ip_packages
				ADD COLUMN parent_upload_name VARCHAR(191) NULL AFTER name`);
		} catch (err: any) {
			if (!err.message.includes('Duplicate column name')) {
				throw err;
			}
		}
		try {
			await conn.query(`ALTER TABLE static_ip_packages
				ADD COLUMN parent_download_name VARCHAR(191) NULL AFTER parent_upload_name`);
		} catch (err: any) {
			if (!err.message.includes('Duplicate column name')) {
				throw err;
			}
		}

		// Ensure additional columns exist on static_ip_packages (used by app)
		const addCol = async (sql: string) => {
			try { await conn.query(sql); } catch (err: any) {
				if (!('message' in err) || (!err.message.includes('Duplicate column name') && !err.message.includes("check that column/key exists"))) {
					throw err;
				}
			}
		};

		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN max_clients INT DEFAULT 1 AFTER max_limit_download`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_upload_name VARCHAR(191) NULL AFTER max_clients`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_download_name VARCHAR(191) NULL AFTER child_upload_name`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_upload_limit VARCHAR(50) NULL AFTER child_download_name`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_download_limit VARCHAR(50) NULL AFTER child_upload_limit`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_limit_at_upload VARCHAR(50) NULL AFTER child_download_limit`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_limit_at_download VARCHAR(50) NULL AFTER child_limit_at_upload`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_burst_upload VARCHAR(50) NULL AFTER child_limit_at_download`);
		await addCol(`ALTER TABLE static_ip_packages ADD COLUMN child_burst_download VARCHAR(50) NULL AFTER child_burst_upload`);

		// Remove old parent_queue_name column if it exists
		try {
			await conn.query(`ALTER TABLE static_ip_packages DROP COLUMN parent_queue_name`);
		} catch (err: any) {
			// Column might not exist, ignore error (older MySQL/MariaDB doesn't support DROP COLUMN IF EXISTS)
			if (!err.message.includes("doesn't exist") && !err.message.includes("check that") && !err.message.includes("Can't DROP")) {
				throw err;
			}
		}

		// Ensure static_ip_clients table exists
		await conn.query(`CREATE TABLE IF NOT EXISTS static_ip_clients (
			id INT AUTO_INCREMENT PRIMARY KEY,
			package_id INT NOT NULL,
			client_name VARCHAR(191) NOT NULL,
			ip_address VARCHAR(45) NOT NULL,
			status ENUM('active','inactive') DEFAULT 'active',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_static_ip_client_package FOREIGN KEY (package_id) REFERENCES static_ip_packages(id) ON DELETE CASCADE
		)`);

		// Create FTTH tables
		await conn.query(`CREATE TABLE IF NOT EXISTS ftth_olt (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(191) NOT NULL,
			location VARCHAR(191) NULL,
			latitude DECIMAL(10,7) NULL,
			longitude DECIMAL(10,7) NULL,
			total_ports INT NOT NULL DEFAULT 0,
			used_ports INT NOT NULL DEFAULT 0,
			notes TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`);

		await conn.query(`CREATE TABLE IF NOT EXISTS ftth_odc (
			id INT AUTO_INCREMENT PRIMARY KEY,
			olt_id INT NOT NULL,
			name VARCHAR(191) NOT NULL,
			location VARCHAR(191) NULL,
			latitude DECIMAL(10,7) NULL,
			longitude DECIMAL(10,7) NULL,
			total_ports INT NOT NULL DEFAULT 0,
			used_ports INT NOT NULL DEFAULT 0,
			notes TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_odc_olt FOREIGN KEY (olt_id) REFERENCES ftth_olt(id) ON DELETE CASCADE
		)`);

		await conn.query(`CREATE TABLE IF NOT EXISTS ftth_odp (
			id INT AUTO_INCREMENT PRIMARY KEY,
			odc_id INT NOT NULL,
			name VARCHAR(191) NOT NULL,
			location VARCHAR(191) NULL,
			latitude DECIMAL(10,7) NULL,
			longitude DECIMAL(10,7) NULL,
			total_ports INT NOT NULL DEFAULT 0,
			used_ports INT NOT NULL DEFAULT 0,
			notes TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_odp_odc FOREIGN KEY (odc_id) REFERENCES ftth_odc(id) ON DELETE CASCADE
		)`);

		// Create network_devices table for unified network monitoring
		await conn.query(`CREATE TABLE IF NOT EXISTS network_devices (
			id INT AUTO_INCREMENT PRIMARY KEY,
			device_type ENUM('customer', 'ont', 'olt', 'odc', 'odp', 'router', 'switch', 'access_point') NOT NULL,
			name VARCHAR(191) NOT NULL,
			ip_address VARCHAR(45) NULL,
			mac_address VARCHAR(17) NULL,
			genieacs_id VARCHAR(191) NULL,
			genieacs_serial VARCHAR(191) NULL,
			customer_id INT NULL,
			olt_id INT NULL,
			odc_id INT NULL,
			odp_id INT NULL,
			latitude DECIMAL(10,8) NULL,
			longitude DECIMAL(11,8) NULL,
			address TEXT NULL,
			status ENUM('online', 'offline', 'warning', 'unknown') DEFAULT 'unknown',
			last_seen DATETIME NULL,
			last_check DATETIME NULL,
			latency_ms INT NULL,
			packet_loss_percent DECIMAL(5,2) NULL,
			uptime_percent DECIMAL(5,2) NULL,
			metadata JSON NULL,
			icon VARCHAR(50) NULL,
			color VARCHAR(20) NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_device_type (device_type),
			INDEX idx_status (status),
			INDEX idx_customer_id (customer_id),
			INDEX idx_genieacs_id (genieacs_id),
			INDEX idx_olt_id (olt_id),
			INDEX idx_odc_id (odc_id),
			INDEX idx_odp_id (odp_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		// Create network_links table for topology connections
		await conn.query(`CREATE TABLE IF NOT EXISTS network_links (
			id INT AUTO_INCREMENT PRIMARY KEY,
			source_device_id INT NOT NULL,
			target_device_id INT NOT NULL,
			link_type VARCHAR(50) DEFAULT 'fiber',
			bandwidth_mbps INT NULL,
			status VARCHAR(20) DEFAULT 'up',
			color VARCHAR(20) NULL,
			width INT DEFAULT 1,
			style VARCHAR(20) DEFAULT 'solid',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_source (source_device_id),
			INDEX idx_target (target_device_id),
			CONSTRAINT fk_link_source FOREIGN KEY (source_device_id) REFERENCES network_devices(id) ON DELETE CASCADE,
			CONSTRAINT fk_link_target FOREIGN KEY (target_device_id) REFERENCES network_devices(id) ON DELETE CASCADE
		)`);

		// Create address_lists table for MikroTik address list management
		await conn.query(`CREATE TABLE IF NOT EXISTS address_lists (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(191) NOT NULL UNIQUE,
			description TEXT NULL,
			addresses TEXT NULL,
			status ENUM('active','inactive') DEFAULT 'active',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)`);

		// Create address_list_items table for individual addresses
		await conn.query(`CREATE TABLE IF NOT EXISTS address_list_items (
			id INT AUTO_INCREMENT PRIMARY KEY,
			address_list_id INT NOT NULL,
			address VARCHAR(45) NOT NULL,
			comment VARCHAR(255) NULL,
			disabled TINYINT(1) DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_address_list_item FOREIGN KEY (address_list_id) REFERENCES address_lists(id) ON DELETE CASCADE,
			UNIQUE KEY unique_address_per_list (address_list_id, address)
		)`);



		// Ensure mikrotik_address_list_items has required columns
		await addCol(`ALTER TABLE mikrotik_address_list_items ADD COLUMN customer_id INT NULL AFTER id`);
		await addCol(`ALTER TABLE mikrotik_address_list_items ADD COLUMN list_name VARCHAR(191) NULL AFTER customer_id`);

		// Create maintenance_schedules table for trouble monitoring
		await conn.query(`CREATE TABLE IF NOT EXISTS maintenance_schedules (
			id INT AUTO_INCREMENT PRIMARY KEY,
			customer_id INT NOT NULL,
			issue_type VARCHAR(191) NULL,
			description TEXT NULL,
			status ENUM('scheduled','in_progress','completed','cancelled') DEFAULT 'scheduled',
			scheduled_date DATETIME NULL,
			completed_date DATETIME NULL,
			technician_name VARCHAR(191) NULL,
			notes TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_maintenance_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
			INDEX idx_status (status),
			INDEX idx_scheduled_date (scheduled_date)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		// Add new columns for maintenance scheduling system (if not exist)
		// Check what columns exist in the table - handle gracefully if table doesn't exist yet
		let columnNames: string[] = [];
		try {
			const [allColumns] = await conn.query(`SHOW COLUMNS FROM maintenance_schedules`);
			columnNames = Array.isArray(allColumns) ? allColumns.map((col: any) => col.Field) : [];
		} catch (err: any) {
			// Table might not exist yet, that's OK - will be created above
			console.log('[DB] maintenance_schedules table columns check failed, will use defaults');
		}

		// Helper function to safely add column with AFTER clause
		const addColAfter = async (columnName: string, columnDef: string, afterColumn?: string) => {
			if (afterColumn && columnNames.includes(afterColumn)) {
				await addCol(`ALTER TABLE maintenance_schedules ADD COLUMN ${columnName} ${columnDef} AFTER ${afterColumn}`);
				// Update columnNames after adding
				if (!columnNames.includes(columnName)) columnNames.push(columnName);
			} else {
				await addCol(`ALTER TABLE maintenance_schedules ADD COLUMN ${columnName} ${columnDef}`);
				if (!columnNames.includes(columnName)) columnNames.push(columnName);
			}
		};

		await addColAfter('title', 'VARCHAR(255) NULL', 'id');

		// Add start_time - find a suitable position
		if (columnNames.includes('scheduled_date')) {
			await addColAfter('start_time', 'DATETIME NULL', 'scheduled_date');
		} else if (columnNames.includes('completed_date')) {
			await addColAfter('start_time', 'DATETIME NULL', 'completed_date');
		} else if (columnNames.includes('status')) {
			await addColAfter('start_time', 'DATETIME NULL', 'status');
		} else {
			await addColAfter('start_time', 'DATETIME NULL');
		}

		// Add end_time after start_time (will be added after start_time is created)
		if (columnNames.includes('start_time')) {
			await addColAfter('end_time', 'DATETIME NULL', 'start_time');
		} else {
			await addColAfter('end_time', 'DATETIME NULL');
		}

		// Add other columns
		await addColAfter('affected_customers', 'JSON NULL', columnNames.includes('customer_id') ? 'customer_id' : undefined);
		await addColAfter('created_by', 'INT NULL', columnNames.includes('notes') ? 'notes' : undefined);
		await addColAfter('maintenance_type', 'VARCHAR(50) NULL', (columnNames.includes('title') ? 'title' : undefined));
		await addColAfter('affected_area', 'VARCHAR(191) NULL', (columnNames.includes('maintenance_type') ? 'maintenance_type' : undefined));
		await addColAfter('estimated_duration_minutes', 'INT NULL', (columnNames.includes('end_time') ? 'end_time' : undefined));
		await addColAfter('notification_sent', 'TINYINT(1) DEFAULT 0', (columnNames.includes('created_by') ? 'created_by' : undefined));
		await addColAfter('notification_sent_at', 'TIMESTAMP NULL', (columnNames.includes('notification_sent') ? 'notification_sent' : undefined));

		// Make customer_id nullable since we're using affected_customers JSON now
		if (columnNames.includes('customer_id')) {
			await addCol(`ALTER TABLE maintenance_schedules MODIFY COLUMN customer_id INT NULL`);
		}

		// Add index for start_time if not exists
		try {
			await conn.query(`CREATE INDEX idx_start_time ON maintenance_schedules(start_time)`);
		} catch (err: any) {
			if (!err.message.includes('Duplicate key name')) {
				throw err;
			}
		}

		// Add custom payment deadline columns to customers table
		await addCol(`ALTER TABLE customers ADD COLUMN custom_payment_deadline TINYINT NULL COMMENT 'Tanggal deadline custom (1-31), NULL untuk pakai default' AFTER odc_location`);
		await addCol(`ALTER TABLE customers ADD COLUMN custom_isolate_days_after_deadline TINYINT DEFAULT 1 COMMENT 'Jumlah hari setelah deadline custom untuk isolasi (default 1)' AFTER custom_payment_deadline`);

		// Add pppoe_password column to customers table (for storing PPPoE password)
		await addCol(`ALTER TABLE customers ADD COLUMN pppoe_password VARCHAR(255) NULL COMMENT 'Password untuk koneksi PPPoE' AFTER pppoe_username`);

		// Create notification_logs table for notification channels
		await conn.query(`CREATE TABLE IF NOT EXISTS notification_logs (
			id INT AUTO_INCREMENT PRIMARY KEY,
			customer_id INT NULL,
			channel VARCHAR(50) NOT NULL DEFAULT 'telegram',
			recipient VARCHAR(50) NOT NULL,
			template VARCHAR(191) NULL,
			message TEXT NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			error_message TEXT NULL,
			sent_at TIMESTAMP NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_customer_id (customer_id),
			INDEX idx_channel (channel),
			INDEX idx_status (status),
			INDEX idx_created_at (created_at),
			INDEX idx_recipient (recipient),
			CONSTRAINT fk_notification_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		// Create customer_notifications_log table for customer-specific notifications
		await conn.query(`CREATE TABLE IF NOT EXISTS customer_notifications_log (
			id INT AUTO_INCREMENT PRIMARY KEY,
			customer_id INT NOT NULL,
			channel VARCHAR(50) NOT NULL,
			notification_type VARCHAR(50) NOT NULL,
			message TEXT NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			recipient VARCHAR(255) NULL,
			error_message TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_customer_id (customer_id),
			INDEX idx_channel (channel),
			INDEX idx_type (notification_type),
			INDEX idx_status (status),
			INDEX idx_created_at (created_at),
			CONSTRAINT fk_customer_notif_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		// Create notification_templates table for customizable notification templates
		await conn.query(`CREATE TABLE IF NOT EXISTS notification_templates (
			id INT AUTO_INCREMENT PRIMARY KEY,
			template_code VARCHAR(100) NOT NULL UNIQUE,
			template_name VARCHAR(255) NOT NULL,
			notification_type VARCHAR(100) NOT NULL,
			channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
			title_template TEXT NOT NULL,
			message_template TEXT NOT NULL,
			variables TEXT NULL COMMENT 'JSON array of available variables',
			is_active BOOLEAN DEFAULT TRUE,
			priority VARCHAR(20) DEFAULT 'normal',
			schedule_days_before INT NULL COMMENT 'Days before event to send (for scheduled notifications)',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_template_code (template_code),
			INDEX idx_notification_type (notification_type),
			INDEX idx_channel (channel),
			INDEX idx_is_active (is_active)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		// Create unified_notifications_queue table for all notification types
		await conn.query(`CREATE TABLE IF NOT EXISTS unified_notifications_queue (
			id INT AUTO_INCREMENT PRIMARY KEY,
			customer_id INT NULL,
			subscription_id INT NULL,
			invoice_id INT NULL,
			payment_id INT NULL,
			notification_type VARCHAR(100) NOT NULL,
			template_code VARCHAR(100) NULL,
			channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
			title TEXT NOT NULL,
			message TEXT NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			priority VARCHAR(20) DEFAULT 'normal',
			retry_count INT DEFAULT 0,
			max_retries INT DEFAULT 3,
			error_message TEXT NULL,
			scheduled_for TIMESTAMP NULL,
			sent_at TIMESTAMP NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_customer_id (customer_id),
			INDEX idx_status (status),
			INDEX idx_channel (channel),
			INDEX idx_notification_type (notification_type),
			INDEX idx_scheduled_for (scheduled_for),
			INDEX idx_created_at (created_at),
			CONSTRAINT fk_unified_notif_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
			CONSTRAINT fk_unified_notif_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

		// Insert default notification templates
		await conn.query(`INSERT IGNORE INTO notification_templates 
			(template_code, template_name, notification_type, channel, title_template, message_template, variables, priority) VALUES
			('invoice_created', 'Invoice Dibuat', 'invoice_created', 'whatsapp', 
			 'Invoice Baru - {invoice_number}', 
			 'Halo {customer_name},\n\nInvoice baru telah dibuat untuk Anda:\n\n📄 Invoice: {invoice_number}\n💰 Jumlah: Rp {amount}\n📅 Jatuh Tempo: {due_date}\n\nSilakan lakukan pembayaran sebelum jatuh tempo.\n\nTerima kasih.', 
			 '["customer_name", "invoice_number", "amount", "due_date", "period"]', 'normal'),
			('invoice_overdue', 'Invoice Terlambat', 'invoice_overdue', 'whatsapp',
			 'Peringatan: Invoice Terlambat - {invoice_number}',
			 'Halo {customer_name},\n\n⚠️ Invoice Anda telah melewati jatuh tempo:\n\n📄 Invoice: {invoice_number}\n💰 Jumlah: Rp {amount}\n📅 Jatuh Tempo: {due_date}\n⏰ Terlambat: {days_overdue} hari\n\nSilakan segera lakukan pembayaran untuk menghindari gangguan layanan.\n\nTerima kasih.',
			 '["customer_name", "invoice_number", "amount", "due_date", "days_overdue"]', 'high'),
			('payment_received', 'Pembayaran Diterima', 'payment_received', 'whatsapp',
			 'Pembayaran Diterima - {invoice_number}',
			 'Halo {customer_name},\n\n✅ Pembayaran Anda telah diterima:\n\n📄 Invoice: {invoice_number}\n💰 Jumlah: Rp {amount}\n💳 Metode: {payment_method}\n📅 Tanggal: {payment_date}\n\nTerima kasih atas pembayaran Anda.',
			 '["customer_name", "invoice_number", "amount", "payment_method", "payment_date"]', 'normal'),
			('payment_partial', 'Pembayaran Sebagian', 'payment_partial', 'whatsapp',
			 'Pembayaran Sebagian Diterima - {invoice_number}',
			 'Halo {customer_name},\n\n✅ Pembayaran sebagian telah diterima:\n\n📄 Invoice: {invoice_number}\n💰 Dibayar: Rp {paid_amount}\n💵 Sisa: Rp {remaining_amount}\n\nSilakan lakukan pelunasan untuk invoice ini.',
			 '["customer_name", "invoice_number", "paid_amount", "remaining_amount"]', 'normal'),

			('customer_created', 'Pelanggan Baru', 'customer_created', 'whatsapp',
			 'Selamat Datang - {customer_code}',
			 '🎉 *Selamat Datang!*\n\nHalo {customer_name},\n\nTerima kasih telah bergabung dengan layanan internet kami!\n\n📋 *Informasi Akun Anda:*\n🆔 Kode Pelanggan: {customer_code}\n🔌 Tipe Koneksi: {connection_type}{package_info}{pppoe_info}{ip_info}\n\n💡 *Tips:*\n• Simpan informasi ini dengan aman\n• Hubungi kami jika ada pertanyaan\n• Nikmati layanan internet Anda!\n\nTerima kasih,\nTim Support',
			 '["customer_name", "customer_code", "connection_type", "package_info", "pppoe_info", "ip_info"]', 'normal'),
			('service_blocked', 'Layanan Diblokir', 'service_blocked', 'whatsapp',
			 'Layanan Internet Diblokir',
			 '⚠️ *Layanan Internet Diblokir*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diblokir karena:\n\n📋 *Alasan:*\n{reason}\n\n📄 *Detail:*\n{details}\n\n💡 *Cara Mengaktifkan Kembali:*\n• Lakukan pembayaran tagihan yang tertunggak\n• Hubungi customer service untuk informasi lebih lanjut\n• Setelah pembayaran, layanan akan otomatis diaktifkan kembali\n\nTerima kasih,\nTim Support',
			 '["customer_name", "reason", "details"]', 'high'),
			('service_unblocked', 'Layanan Diaktifkan Kembali', 'service_unblocked', 'whatsapp',
			 'Layanan Internet Diaktifkan Kembali',
			 '✅ *Layanan Internet Diaktifkan Kembali*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diaktifkan kembali!\n\n📋 *Informasi:*\n{details}\n\n💡 *Terima Kasih:*\nTerima kasih telah melakukan pembayaran. Nikmati layanan internet Anda kembali!\n\nJika ada pertanyaan, jangan ragu untuk menghubungi kami.\n\nTerima kasih,\nTim Support',
			 '["customer_name", "details"]', 'normal')
		`);

		// Ensure customer_created template exists (additional check)
		await conn.query(`INSERT IGNORE INTO notification_templates 
			(template_code, template_name, notification_type, channel, title_template, message_template, variables, priority, is_active) VALUES
			('customer_created', 'Pelanggan Baru', 'customer_created', 'whatsapp', 
			 'Selamat Datang - {customer_code}', 
			 '🎉 *Selamat Datang!*\n\nHalo {customer_name},\n\nTerima kasih telah bergabung dengan layanan internet kami!\n\n📋 *Informasi Akun Anda:*\n🆔 Kode Pelanggan: {customer_code}\n🔌 Tipe Koneksi: {connection_type}{package_info}{pppoe_info}{ip_info}\n\n💡 *Tips:*\n• Simpan informasi ini dengan aman\n• Hubungi kami jika ada pertanyaan\n• Nikmati layanan internet Anda!\n\nTerima kasih,\nTim Support', 
			 '["customer_name", "customer_code", "connection_type", "package_info", "pppoe_info", "ip_info"]', 'normal', TRUE),
			('service_blocked', 'Layanan Diblokir', 'service_blocked', 'whatsapp',
			 'Layanan Internet Diblokir',
			 '⚠️ *Layanan Internet Diblokir*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diblokir karena:\n\n📋 *Alasan:*\n{reason}\n\n📄 *Detail:*\n{details}\n\n💡 *Cara Mengaktifkan Kembali:*\n• Lakukan pembayaran tagihan yang tertunggak\n• Hubungi customer service untuk informasi lebih lanjut\n• Setelah pembayaran, layanan akan otomatis diaktifkan kembali\n\nTerima kasih,\nTim Support',
			 '["customer_name", "reason", "details"]', 'high', TRUE),
			('service_unblocked', 'Layanan Diaktifkan Kembali', 'service_unblocked', 'whatsapp',
			 'Layanan Internet Diaktifkan Kembali',
			 '✅ *Layanan Internet Diaktifkan Kembali*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diaktifkan kembali!\n\n📋 *Informasi:*\n{details}\n\n💡 *Terima Kasih:*\nTerima kasih telah melakukan pembayaran. Nikmati layanan internet Anda kembali!\n\nJika ada pertanyaan, jangan ragu untuk menghubungi kami.\n\nTerima kasih,\nTim Support',
			 '["customer_name", "details"]', 'normal', TRUE)`);

	} finally {
		conn.release();
	}

	// Ensure new templates exist (run after schema creation)
	try {
		const { ensureNotificationTemplates } = await import('../utils/ensureNotificationTemplates');
		await ensureNotificationTemplates();
		console.log('✅ Additional notification templates ensured');
	} catch (error) {
		console.error('⚠️ Error ensuring additional templates (non-critical):', error);
		// Non-critical, continue
	}
}


