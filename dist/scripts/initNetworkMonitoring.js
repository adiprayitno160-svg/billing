"use strict";
/**
 * Initialize Network Monitoring System
 * Run this script to setup database tables and sync initial data
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
const NetworkMonitoringService_1 = require("../services/monitoring/NetworkMonitoringService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function runMigration() {
    console.log('🚀 Starting Network Monitoring System Setup...\n');
    try {
        // Read and execute SQL migration
        console.log('📋 Step 1: Creating database tables...');
        const sqlPath = path.join(__dirname, '..', 'db', 'migrations', 'create_network_monitoring_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        for (const statement of statements) {
            try {
                await pool_1.databasePool.query(statement);
            }
            catch (error) {
                // Ignore "table already exists" errors
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }
        console.log('✅ Database tables created successfully\n');
        // Initialize service
        console.log('📋 Step 2: Initializing monitoring service...');
        await NetworkMonitoringService_1.NetworkMonitoringService.initialize();
        console.log('✅ Service initialized\n');
        // Sync FTTH infrastructure
        console.log('📋 Step 3: Syncing FTTH infrastructure (OLT, ODC, ODP)...');
        const ftthResult = await NetworkMonitoringService_1.NetworkMonitoringService.syncFTTHInfrastructure();
        console.log(`✅ Synced ${ftthResult.added} new, ${ftthResult.updated} updated\n`);
        // Sync customers
        console.log('📋 Step 4: Syncing customer devices...');
        const customerResult = await NetworkMonitoringService_1.NetworkMonitoringService.syncCustomerDevices();
        console.log(`✅ Synced ${customerResult.added} new, ${customerResult.updated} updated\n`);
        // Sync GenieACS devices
        console.log('📋 Step 5: Syncing GenieACS devices (ONTs)...');
        try {
            const genieacsResult = await NetworkMonitoringService_1.NetworkMonitoringService.syncDevicesFromGenieACS();
            console.log(`✅ Synced ${genieacsResult.added} new, ${genieacsResult.updated} updated\n`);
        }
        catch (error) {
            console.log('⚠️  GenieACS sync failed (this is OK if GenieACS is not configured)\n');
        }
        // Auto-create links
        console.log('📋 Step 6: Auto-creating network links...');
        const linksCreated = await NetworkMonitoringService_1.NetworkMonitoringService.autoCreateLinks();
        console.log(`✅ Created ${linksCreated} network links\n`);
        console.log('🎉 Network Monitoring System setup completed successfully!\n');
        console.log('📍 Access the monitoring page at: http://localhost:3000/monitoring/public/network-map\n');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}
runMigration();
//# sourceMappingURL=initNetworkMonitoring.js.map