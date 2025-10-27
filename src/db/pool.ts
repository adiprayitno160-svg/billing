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
	connectionLimit: 10,
	queueLimit: 0
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
			customer_code VARCHAR(191) UNIQUE NULL,
			name VARCHAR(191) NOT NULL,
			phone VARCHAR(50) NULL,
			email VARCHAR(191) NULL,
			address TEXT NULL,
			odc_id INT NULL,
			odp_id INT NULL,
			connection_type ENUM('pppoe','static_ip','prepaid') DEFAULT 'pppoe',
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

		// Create telegram_settings table
		await conn.query(`CREATE TABLE IF NOT EXISTS telegram_settings (
			id INT AUTO_INCREMENT PRIMARY KEY,
			bot_token VARCHAR(500) NOT NULL COMMENT 'Token bot dari BotFather',
			auto_start TINYINT(1) DEFAULT 1 COMMENT 'Auto start bot saat server dimulai',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Pengaturan Telegram Bot'`);

		// Ensure prepaid_package_subscriptions has last_notified_at column
		await addCol(`ALTER TABLE prepaid_package_subscriptions ADD COLUMN last_notified_at TIMESTAMP NULL AFTER expiry_date`);

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

	} finally {
		conn.release();
	}
}


