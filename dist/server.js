"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_session_1 = __importDefault(require("express-session"));
const connect_flash_1 = __importDefault(require("connect-flash"));
const pool_1 = require("./db/pool");
const express_ejs_layouts_1 = __importDefault(require("express-ejs-layouts"));
const index_1 = __importDefault(require("./routes/index"));
const errorHandler_1 = require("./middlewares/errorHandler");
const scheduler_1 = require("./services/scheduler");
const invoiceSchedulerService_1 = require("./services/billing/invoiceSchedulerService");
// WhatsApp Service Import Removed
const http_1 = require("http");
const authController_1 = require("./controllers/authController");
const companyInfoMiddleware_1 = require("./middlewares/companyInfoMiddleware");
const autoLogoutMiddleware_1 = require("./middlewares/autoLogoutMiddleware");
const versionMiddleware_1 = require("./middlewares/versionMiddleware");
const autoFixDatabase_1 = require("./utils/autoFixDatabase");
const loggingMiddleware_1 = require("./middlewares/loggingMiddleware");
const BillingLogService_1 = require("./services/billing/BillingLogService");
const AIAnomalyDetectionService_1 = require("./services/billing/AIAnomalyDetectionService");
const pppoeStatsMiddleware_1 = require("./middlewares/pppoeStatsMiddleware");
// Load .env but don't override existing environment variables (e.g., from PM2)
dotenv_1.default.config({ override: false });
const app = (0, express_1.default)();
const rawPort = process.env.PORT ? String(process.env.PORT).trim() : '3001';
const port = !isNaN(Number(rawPort)) && Number(rawPort) > 0 ? Number(rawPort) : 3001;
// CommonJS build: __dirname is available from TS transpilation
// Security & perf
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://unpkg.com",
                "https://cdn.tailwindcss.com"
            ],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdn.tailwindcss.com",
                "https://cdnjs.cloudflare.com",
                "https://unpkg.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
            connectSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                "https://cdn.tailwindcss.com",
                "https://unpkg.com",
                "https://*.tile.openstreetmap.org",
                "https://*.basemaps.cartocdn.com",
                "https://router.project-osrm.org",
                "https://nominatim.openstreetmap.org"
            ],
            upgradeInsecureRequests: null
        }
    },
    hsts: false
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('dev'));
// Static files (Must be BEFORE logging and session to prevent extreme slowdowns)
app.use('/assets', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'assets')));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'uploads')));
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.use(loggingMiddleware_1.loggingMiddleware);
// Session with MySQL store (persists across server restarts)
// Using require for express-mysql-session due to its CommonJS nature
const MySQLStore = require('express-mysql-session')(express_session_1.default);
const sessionStoreOptions = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billing',
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
};
const sessionStore = new MySQLStore(sessionStoreOptions);
// Enable trust proxy for persistent sessions behind proxies (Laragon/Nginx)
app.set('trust proxy', 1);
app.use((0, express_session_1.default)({
    name: 'billing_sid', // Unique name to avoid conflicts with other apps
    secret: process.env.SESSION_SECRET || 'billing-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: false, // Set to true if using HTTPS only
        httpOnly: true, // Prevent JS access to cookie
        maxAge: 24 * 60 * 60 * 1000 // 24 hours session
    },
    rolling: true // Reset expiry time on each request
}));
// Flash messages
app.use((0, connect_flash_1.default)());
// Body parsing
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// Static files moved to top to avoid blocking logs
// Expose variables to all views
app.use((req, res, next) => {
    res.locals.query = req.query;
    res.locals.flash = {
        success: req.flash('success'),
        error: req.flash('error')
    };
    res.locals.currentPath = req.path || '/';
    res.locals.recentRequests = [];
    res.locals.chart = { labels: [], data: [] };
    // Expose authenticated user (if any) to views
    try {
        res.locals.user = req.user || null;
        res.locals.userId = req.session?.userId || null;
    }
    catch { }
    // Feature flags / UI toggles
    res.locals.hideBillingCustomersMenu = String(process.env.HIDE_BILLING_CUSTOMERS_MENU).toLowerCase() === 'true';
    // Set default title
    res.locals.title = 'Billing';
    next();
});
// Views
app.set('views', path_1.default.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.disable('view cache');
app.use(express_ejs_layouts_1.default);
app.set('layout', 'layouts/main');
// Middleware to ensure layout variables are available
app.use((req, res, next) => {
    // Ensure title is always available
    if (!res.locals.title) {
        res.locals.title = 'Billing';
    }
    next();
});
// Company info middleware - provides company settings to all views
app.use(companyInfoMiddleware_1.companyInfoMiddleware);
// Auto logout middleware - provides auto logout setting to all views
app.use(autoLogoutMiddleware_1.autoLogoutMiddleware);
// Version middleware - provides app version to all views
app.use(versionMiddleware_1.injectAppVersion);
// Logging middleware - moved up
// app.use(loggingMiddleware);
// PPPoE Stats middleware - for sidebar
app.use(pppoeStatsMiddleware_1.pppoeStatsMiddleware);
// Root router
app.use('/', index_1.default);
// Error logging middleware - must be after routes but before error handler
app.use(loggingMiddleware_1.errorLoggingMiddleware);
// Payment routes
const payment_1 = __importDefault(require("./routes/payment"));
app.use('/payment', payment_1.default);
// Proxy for IP Location (Using Client IP for better estimation)
app.get('/api/proxy/ip-location', async (req, res) => {
    try {
        // Ambil IP pengunjung (handle proxy/cloudflare jika ada)
        const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        // Jika local atau IPv6 loopback, gunakan default (IP Server)
        const query = (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1') ? `/${clientIp}` : '';
        const response = await axios_1.default.get(`http://ip-api.com/json${query}`);
        res.json(response.data);
    }
    catch (error) {
        console.error('Error fetching IP location:', error);
        res.status(500).json({ status: 'fail', message: error.message });
    }
});
// General API routes
const api_1 = __importDefault(require("./routes/api"));
app.use('/api', api_1.default);
// 404 handler
app.use((req, res, next) => {
    // Check if this is an API request (JSON expected)
    const acceptsJson = req.headers.accept?.includes('application/json') ||
        req.headers['content-type']?.includes('application/json');
    if (acceptsJson || req.method === 'DELETE' || req.method === 'PUT' || req.method === 'PATCH' || req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Endpoint tidak ditemukan',
            status: 404,
            path: req.path,
            method: req.method
        });
    }
    res.status(404).render('error', {
        title: 'Halaman Tidak Ditemukan',
        status: 404,
        message: 'Halaman yang Anda cari tidak ditemukan'
    });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
async function start() {
    try {
        console.log(`[Startup] 🔄 Initializing server... Time: ${new Date().toISOString()}`);
        console.log(`[Startup] Target Port: ${port}`);
        console.log(`[Startup] Database config: host=${process.env.DB_HOST ?? 'localhost'}, port=${process.env.DB_PORT ?? 3306}, user=${process.env.DB_USER ?? 'root'}, db=${process.env.DB_NAME ?? 'billing'}`);
        const isMainInstanceEarly = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;
        if (isMainInstanceEarly) {
            console.log('[Startup] 🚀 Main instance detected (Instance 0). Performing database initialization...');
            console.log('[Startup] Step 1: Ensuring initial schema...');
            await (0, pool_1.ensureInitialSchema)();
            console.log('[Startup] ✅ Schema ensured.');
            // Ensure AI settings table exists
            try {
                console.log('[Startup] Step 2: Ensuring AI settings table...');
                const { AISettingsService } = await Promise.resolve().then(() => __importStar(require('./services/payment/AISettingsService')));
                await AISettingsService.ensureAISettingsTable();
                console.log('✅ AI settings table ensured');
            }
            catch (error) {
                console.error('⚠️ Error ensuring AI settings table (non-critical):', error);
            }
            // Ensure notification templates exist
            try {
                console.log('Ensuring notification templates...');
                const { ensureNotificationTemplates } = await Promise.resolve().then(() => __importStar(require('./utils/ensureNotificationTemplates')));
                await ensureNotificationTemplates();
                console.log('[Startup] ✅ Notification templates ensured');
            }
            catch (error) {
                console.error('[Startup] ⚠️ Error ensuring notification templates (non-critical):', error);
            }
            // Ensure invoices and payments tables exist (CRITICAL for bookkeeping)
            try {
                console.log('[Startup] Step 3: Checking invoices/payments/whatsapp tables...');
                await (0, autoFixDatabase_1.autoFixInvoicesAndPaymentsTables)();
                await (0, autoFixDatabase_1.autoFixWhatsAppTables)();
                await (0, autoFixDatabase_1.autoFixCustomerColumns)();
                await (0, autoFixDatabase_1.autoFixPPPoEActivationTables)();
                console.log('[Startup] ✅ Invoices, payments, WhatsApp, Customer and PPPoE tables ensured');
            }
            catch (error) {
                console.error('⚠️ Error ensuring bookkeeping/whatsapp tables (non-critical):', error);
            }
        }
        else {
            console.log(`[Startup] ⏭️ Skipping database initialization on cluster instance ${process.env.NODE_APP_INSTANCE}`);
        }
        console.log('[Startup] Step 4: Checking database connection...');
        await (0, pool_1.checkDatabaseConnection)();
        console.log('[Startup] ✅ Database connection OK');
        // Initialize logging system
        console.log('[Startup] Step 5: Initializing logging system...');
        await BillingLogService_1.BillingLogService.initialize();
        const anomalyDetector = new AIAnomalyDetectionService_1.AIAnomalyDetectionService();
        await anomalyDetector.initialize();
        if (isMainInstanceEarly) {
            console.log('[Startup] 🚀 Starting Monitoring Scheduler (Prioritized)...');
            const { monitoringScheduler } = await Promise.resolve().then(() => __importStar(require('./schedulers/monitoringScheduler')));
            monitoringScheduler.start();
        }
        else {
            console.log('[Startup] Skipping Monitoring Scheduler on non-main instance');
        }
        // Initialize default users
        const authController = new authController_1.AuthController();
        await authController.initializeDefaultUsers();
        console.log('Default users initialized');
        // Create HTTP server
        const server = (0, http_1.createServer)(app);
        // Initialize Socket.IO
        console.log('[Startup] Importing Socket.IO...');
        const { Server } = await Promise.resolve().then(() => __importStar(require('socket.io')));
        console.log('[Startup] Initializing Socket.IO...');
        const io = new Server(server, {
            cors: {
                origin: "*", // Adjust for production security
                methods: ["GET", "POST"]
            }
        });
        // BACKGROUND SERVICES (Only run on main instance if in PM2 Cluster Mode)
        console.log(`[Startup] NODE_APP_INSTANCE: ${process.env.NODE_APP_INSTANCE}`);
        const isMainInstance = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;
        console.log(`[Startup] isMainInstance: ${isMainInstance}`);
        if (isMainInstance) {
            console.log('[Startup] 🛠️ Initializing background services (Main Instance)...');
            // 4. Initialize Schedulers
            scheduler_1.SchedulerService.initialize();
            invoiceSchedulerService_1.InvoiceSchedulerService.initialize();
            // 5. Initialize System Settings Table & Defaults
            try {
                const { SystemSettingsController } = await Promise.resolve().then(() => __importStar(require('./controllers/settings/SystemSettingsController')));
                await SystemSettingsController.ensureSystemSettingsTable();
                console.log('✅ System Settings initialized');
            }
            catch (error) {
                console.error('⚠️ Error initializing System Settings:', error);
            }
            // Startup Catch-Up: Isolir customer yang terlewat saat server down
            // Delay 30 detik agar semua service siap (WhatsApp, MikroTik, dll)
            setTimeout(async () => {
                try {
                    console.log('[Startup] 🔄 Running catch-up isolation check...');
                    const { IsolationService } = await Promise.resolve().then(() => __importStar(require('./services/billing/isolationService')));
                    const result = await IsolationService.startupCatchUpIsolation();
                    console.log(`[Startup] ✅ Catch-up isolation done: ${result.isolated} isolated, ${result.failed} failed`);
                }
                catch (error) {
                    console.error('[Startup] ❌ Error in catch-up isolation:', error);
                }
            }, 30000); // 30 detik delay
            // Initialize invoice auto-generation scheduler
            console.log('[Startup] Step 7: Initializing schedulers...');
            await invoiceSchedulerService_1.InvoiceSchedulerService.initialize();
            // Initialize prepaid scheduler (auto-disable expired customers)
            try {
                const { PrepaidScheduler } = await Promise.resolve().then(() => __importStar(require('./services/billing/PrepaidScheduler')));
                PrepaidScheduler.initialize();
                console.log('✅ Prepaid scheduler initialized');
            }
            catch (error) {
                console.error('⚠️ Error initializing prepaid scheduler (non-critical):', error);
            }
            // Initialize Notification Scheduler
            const { NotificationScheduler } = await Promise.resolve().then(() => __importStar(require('./services/notification/NotificationScheduler')));
            const { ensureNotificationTemplates } = await Promise.resolve().then(() => __importStar(require('./utils/ensureNotificationTemplates')));
            await ensureNotificationTemplates();
            NotificationScheduler.initialize();
            console.log('Notification scheduler initialized');
            // Initialize Backup Scheduler
            const { BackupScheduler } = await Promise.resolve().then(() => __importStar(require('./services/backup/BackupScheduler')));
            BackupScheduler.init();
            // Initialize Media Cleanup Service
            const { MediaCleanupService } = await Promise.resolve().then(() => __importStar(require('./services/cron/MediaCleanupService')));
            MediaCleanupService.startScheduler(90); // 90 days retention
            // Initialize PPPoE Static IP Monitor (checks every 10 minutes)
            try {
                const { pppoeStaticMonitor } = await Promise.resolve().then(() => __importStar(require('./services/monitoring/PPPoEStaticMonitor')));
                pppoeStaticMonitor.startScheduler();
                console.log('✅ PPPoE Static IP Monitor initialized');
            }
            catch (error) {
                console.error('⚠️ Error initializing PPPoE Static IP Monitor (non‑critical):', error);
            }
            // Initialize WhatsApp Auth Cleanup Service (remove old JSON files > 2 weeks)
            try {
                const { startWhatsAppCleanupScheduler } = await Promise.resolve().then(() => __importStar(require('./services/cron/WhatsAppCleanupService')));
                startWhatsAppCleanupScheduler();
                console.log('✅ WhatsApp Auth Cleanup Scheduler initialized (daily 03:00)');
            }
            catch (error) {
                console.error('⚠️ Error initializing WhatsApp Cleanup Scheduler (non-critical):', error);
            }
            // Initialize Log Cleanup Service (Daily 02:00)
            try {
                const { startLogCleanupScheduler } = await Promise.resolve().then(() => __importStar(require('./services/cron/LogCleanupService')));
                startLogCleanupScheduler();
                console.log('✅ Log Cleanup Scheduler initialized (daily 02:00)');
            }
            catch (error) {
                console.error('⚠️ Error initializing Log Cleanup Scheduler (non-critical):', error);
            }
            // Initialize Invoice PDF Cleanup Service (Daily)
            try {
                const { InvoiceCleanupService } = await Promise.resolve().then(() => __importStar(require('./services/cron/InvoiceCleanupService')));
                InvoiceCleanupService.startScheduler();
                console.log('✅ Invoice PDF Cleanup Scheduler initialized');
            }
            catch (error) {
                console.error('⚠️ Error initializing Invoice Cleanup Scheduler:', error);
            }
            // Initialize New Robust WhatsApp Service
            if (process.env.DISABLE_WHATSAPP !== 'true') {
                try {
                    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./services/whatsapp')));
                    await whatsappService.initialize();
                    console.log('✅ WhatsApp Service (Baileys) initialized');
                }
                catch (waError) {
                    console.error('❌ Failed to init WhatsApp:', waError);
                }
            }
            // Initialize Realtime Monitoring Service
            // const { RealtimeMonitoringService } = await import('./services/monitoring/RealtimeMonitoringService');
            // const monitoringService = new RealtimeMonitoringService(io);
            // monitoringService.start();
            // Initialize Monitoring Scheduler (Crucial for Static IP & Data Collection)
            // console.log('[Startup] 🚀 Starting Monitoring Scheduler...');
            // const { monitoringScheduler } = await import('./schedulers/monitoringScheduler');
            // monitoringScheduler.start(); // Wait for explicit start if needed, or let it run
            // monitoringScheduler.start();
        }
        else {
            console.log(`[Startup] ⏭️ Skipping background services on cluster instance ${process.env.NODE_APP_INSTANCE}`);
        }
        // Start server on fixed port
        server.listen(port, '0.0.0.0', () => {
            console.log(`\n🚀 SERVER SUCCESSFULLY STARTED!`);
            console.log(`   - Local:    http://localhost:${port}`);
            console.log(`   - Network:  http://0.0.0.0:${port}`);
            console.log(`   - Time:     ${new Date().toISOString()}`);
            // Signal PM2 that the app is ready
            if (process.send) {
                process.send('ready');
                console.log(`   - PM2:      Signal 'ready' sent.`);
            }
        }).on('error', (err) => {
            console.error('❌ CRITICAL: Failed to start server:', err);
            process.exit(1);
        });
    }
    catch (err) {
        console.error('Failed to start server:', err);
        if (err instanceof Error) {
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
        }
        process.exit(1);
    }
}
console.log('[System] Force Restart Triggered at ' + new Date().toISOString());
start();
// Graceful Shutdown Handler - Prevents zombie Puppeteer processes
const gracefulShutdown = async (signal) => {
    console.log(`\n[System] 🛑 ${signal} received. Starting graceful shutdown...`);
    try {
        // Destroy WhatsApp client first (this closes Puppeteer browser)
        // Baileys doesn't need explicit destroy but we can log
        console.log('[System] ✅ WhatsApp client stopping (Baileys)');
    }
    catch (e) {
        console.error('[System] Error during shutdown:', e);
    }
    console.log('[System] 👋 Goodbye!');
    process.exit(0);
};
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('beforeExit', () => gracefulShutdown('beforeExit'));
//# sourceMappingURL=server.js.map