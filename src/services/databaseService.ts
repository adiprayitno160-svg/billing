import { databasePool } from '../db/pool';

export interface DatabaseStatus {
    connected: boolean;
    version: string;
    uptime: string;
    totalTables: number;
    totalRows: number;
    lastBackup?: string;
}

export interface SchemaIssue {
    table: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    fixCommand: string;
}

// Check database connection and basic status
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
    const conn = await databasePool.getConnection();
    try {
        // Test connection
        const [versionResult] = await conn.execute('SELECT VERSION() as version');
        const version = Array.isArray(versionResult) ? (versionResult[0] as any).version : 'Unknown';
        
        // Get table count
        const [tablesResult] = await conn.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        `);
        const totalTables = Array.isArray(tablesResult) ? (tablesResult[0] as any).count : 0;
        
        // Get total rows across all tables
        const [rowsResult] = await conn.execute(`
            SELECT SUM(table_rows) as total_rows
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        `);
        const totalRows = Array.isArray(rowsResult) ? (rowsResult[0] as any).total_rows || 0 : 0;
        
        return {
            connected: true,
            version,
            uptime: 'Active',
            totalTables,
            totalRows
        };
    } catch (error) {
        return {
            connected: false,
            version: 'Unknown',
            uptime: 'Disconnected',
            totalTables: 0,
            totalRows: 0
        };
    } finally {
        conn.release();
    }
}

// Helper function to safely extract error message
function getErrorMessage(error: any): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error?.message) {
        return String(error.message);
    }
    if (error?.sqlMessage) {
        return String(error.sqlMessage);
    }
    return String(error);
}

// Check for schema issues
export async function checkDatabaseSchema(): Promise<SchemaIssue[]> {
    const issues: SchemaIssue[] = [];
    const conn = await databasePool.getConnection();
    
    try {
        // Check for missing columns in ftth_odc
        try {
            await conn.execute('SELECT olt_card FROM ftth_odc LIMIT 1');
        } catch (error: any) {
            const errorMsg = getErrorMessage(error);
            if (errorMsg.includes('Unknown column')) {
                issues.push({
                    table: 'ftth_odc',
                    issue: 'Missing column olt_card',
                    severity: 'high',
                    description: 'Kolom olt_card tidak ditemukan di tabel ftth_odc',
                    fixCommand: 'ALTER TABLE ftth_odc ADD COLUMN olt_card INT NULL DEFAULT NULL AFTER used_ports'
                });
            }
        }
        
        // Check for missing columns in ftth_odp
        try {
            await conn.execute('SELECT olt_card FROM ftth_odp LIMIT 1');
        } catch (error: any) {
            const errorMsg = getErrorMessage(error);
            if (errorMsg.includes('Unknown column')) {
                issues.push({
                    table: 'ftth_odp',
                    issue: 'Missing column olt_card',
                    severity: 'high',
                    description: 'Kolom olt_card tidak ditemukan di tabel ftth_odp',
                    fixCommand: 'ALTER TABLE ftth_odp ADD COLUMN olt_card INT NULL DEFAULT NULL AFTER used_ports'
                });
            }
        }
        
        // Check for missing columns olt_port
        try {
            await conn.execute('SELECT olt_port FROM ftth_odc LIMIT 1');
        } catch (error: any) {
            const errorMsg = getErrorMessage(error);
            if (errorMsg.includes('Unknown column')) {
                issues.push({
                    table: 'ftth_odc',
                    issue: 'Missing column olt_port',
                    severity: 'high',
                    description: 'Kolom olt_port tidak ditemukan di tabel ftth_odc',
                    fixCommand: 'ALTER TABLE ftth_odc ADD COLUMN olt_port INT NULL DEFAULT NULL AFTER olt_card'
                });
            }
        }
        
        try {
            await conn.execute('SELECT olt_port FROM ftth_odp LIMIT 1');
        } catch (error: any) {
            const errorMsg = getErrorMessage(error);
            if (errorMsg.includes('Unknown column')) {
                issues.push({
                    table: 'ftth_odp',
                    issue: 'Missing column olt_port',
                    severity: 'high',
                    description: 'Kolom olt_port tidak ditemukan di tabel ftth_odp',
                    fixCommand: 'ALTER TABLE ftth_odp ADD COLUMN olt_port INT NULL DEFAULT NULL AFTER olt_card'
                });
            }
        }
        
        // Check for missing static_ip_clients table
        try {
            await conn.execute('SELECT COUNT(*) FROM static_ip_clients LIMIT 1');
        } catch (error: any) {
            const errorMsg = getErrorMessage(error);
            if (errorMsg.includes("doesn't exist")) {
                issues.push({
                    table: 'static_ip_clients',
                    issue: 'Missing table',
                    severity: 'critical',
                    description: 'Tabel static_ip_clients tidak ditemukan',
                    fixCommand: `CREATE TABLE static_ip_clients (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        package_id INT NOT NULL,
                        client_name VARCHAR(191) NOT NULL,
                        ip_address VARCHAR(45) NOT NULL,
                        status ENUM('active','inactive') DEFAULT 'active',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        CONSTRAINT fk_static_ip_client_package FOREIGN KEY (package_id) REFERENCES static_ip_packages(id) ON DELETE CASCADE
                    )`
                });
            }
        }
        
        // Check for missing max_clients column in static_ip_packages
        try {
            await conn.execute('SELECT max_clients FROM static_ip_packages LIMIT 1');
        } catch (error: any) {
            const errorMsg = getErrorMessage(error);
            if (errorMsg.includes('Unknown column')) {
                issues.push({
                    table: 'static_ip_packages',
                    issue: 'Missing column max_clients',
                    severity: 'high',
                    description: 'Kolom max_clients tidak ditemukan di tabel static_ip_packages',
                    fixCommand: 'ALTER TABLE static_ip_packages ADD COLUMN max_clients INT DEFAULT 1 AFTER max_limit_download'
                });
            }
        }
        
    } finally {
        conn.release();
    }
    
    return issues;
}

// Fix missing columns
export async function fixMissingColumns(): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        await conn.beginTransaction();
        
        // Fix ftth_odc table
        try {
            await conn.execute('ALTER TABLE ftth_odc ADD COLUMN olt_card INT NULL DEFAULT NULL AFTER used_ports');
        } catch (error: any) {
            if (String(error).includes('Duplicate column name')) {
                throw error;
            }
        }
        
        try {
            await conn.execute('ALTER TABLE ftth_odc ADD COLUMN olt_port INT NULL DEFAULT NULL AFTER olt_card');
        } catch (error: any) {
            if (String(error).includes('Duplicate column name')) {
                throw error;
            }
        }
        
        // Fix ftth_odp table
        try {
            await conn.execute('ALTER TABLE ftth_odp ADD COLUMN olt_card INT NULL DEFAULT NULL AFTER used_ports');
        } catch (error: any) {
            if (String(error).includes('Duplicate column name')) {
                throw error;
            }
        }
        
        try {
            await conn.execute('ALTER TABLE ftth_odp ADD COLUMN olt_port INT NULL DEFAULT NULL AFTER olt_card');
        } catch (error: any) {
            if (String(error).includes('Duplicate column name')) {
                throw error;
            }
        }
        
        // Fix static_ip_packages table
        try {
            await conn.execute('ALTER TABLE static_ip_packages ADD COLUMN max_clients INT DEFAULT 1 AFTER max_limit_download');
        } catch (error: any) {
            if (String(error).includes('Duplicate column name')) {
                throw error;
            }
        }
        
        // Create static_ip_clients table if not exists
        try {
            await conn.execute(`
                CREATE TABLE IF NOT EXISTS static_ip_clients (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    package_id INT NOT NULL,
                    client_name VARCHAR(191) NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    status ENUM('active','inactive') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_static_ip_client_package FOREIGN KEY (package_id) REFERENCES static_ip_packages(id) ON DELETE CASCADE
                )
            `);
        } catch (error: any) {
            if (String(error).includes('already exists')) {
                throw error;
            }
        }
        
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Run database migration
export async function runMigration(migrationType?: string): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        await conn.beginTransaction();
        
        // Run all necessary migrations
        await fixMissingColumns();
        
        // Create missing indexes
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_ftth_odc_olt_card ON ftth_odc (olt_card)',
            'CREATE INDEX IF NOT EXISTS idx_ftth_odc_olt_port ON ftth_odc (olt_port)',
            'CREATE INDEX IF NOT EXISTS idx_ftth_odp_olt_card ON ftth_odp (olt_card)',
            'CREATE INDEX IF NOT EXISTS idx_ftth_odp_olt_port ON ftth_odp (olt_port)',
            'CREATE INDEX IF NOT EXISTS idx_static_ip_clients_package ON static_ip_clients (package_id)',
            'CREATE INDEX IF NOT EXISTS idx_static_ip_clients_status ON static_ip_clients (status)'
        ];
        
        for (const index of indexes) {
            try {
                await conn.execute(index);
            } catch (error: any) {
                if (String(error).includes('Duplicate key name')) {
                    console.log(`Index creation warning: ${getErrorMessage(error)}`);
                }
            }
        }
        
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}
