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
const WhatsAppService_1 = require("./services/whatsapp/WhatsAppService");
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
const port = Number(process.env.PORT ?? 3000);
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
                "https://unpkg.com"
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
                "https://router.project-osrm.org"
            ],
            upgradeInsecureRequests: null
        }
    },
    hsts: false
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('dev'));
// Session with 10 minute inactivity timeout
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'billing-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 5 * 60 * 1000 // 5 minutes in milliseconds
    },
    rolling: true // Reset expiry time on each request
}));
// Flash messages
app.use((0, connect_flash_1.default)());
// Body parsing
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// Static files
app.use('/assets', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'assets')));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'uploads')));
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
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
// Logging middleware - must be before routes
app.use(loggingMiddleware_1.loggingMiddleware);
// PPPoE Stats middleware - for sidebar
app.use(pppoeStatsMiddleware_1.pppoeStatsMiddleware);
// Network monitoring routes (public - no auth required)
const networkMonitoring_1 = __importDefault(require("./routes/networkMonitoring"));
app.use('/monitoring', networkMonitoring_1.default);
// Root router
app.use('/', index_1.default);
// Error logging middleware - must be after routes but before error handler
app.use(loggingMiddleware_1.errorLoggingMiddleware);
// Payment routes
const payment_1 = __importDefault(require("./routes/payment"));
app.use('/payment', payment_1.default);
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
        console.log('Starting server initialization...');
        console.log(`Database config: host=${process.env.DB_HOST ?? 'localhost'}, port=${process.env.DB_PORT ?? 3306}, user=${process.env.DB_USER ?? 'root'}, db=${process.env.DB_NAME ?? 'billing'}`);
        console.log('Ensuring initial schema...');
        await (0, pool_1.ensureInitialSchema)();
        console.log('Schema ensured');
        // Ensure AI settings table exists
        try {
            console.log('Ensuring AI settings table...');
            const { AISettingsService } = await Promise.resolve().then(() => __importStar(require('./services/payment/AISettingsService')));
            await AISettingsService.ensureAISettingsTable();
            console.log('✅ AI settings table ensured');
        }
        catch (error) {
            console.error('⚠️ Error ensuring AI settings table (non-critical):', error);
            // Non-critical, continue startup
        }
        // Ensure notification templates exist
        try {
            console.log('Ensuring notification templates...');
            const { ensureNotificationTemplates } = await Promise.resolve().then(() => __importStar(require('./utils/ensureNotificationTemplates')));
            await ensureNotificationTemplates();
            console.log('✅ Notification templates ensured');
        }
        catch (error) {
            console.error('⚠️ Error ensuring notification templates (non-critical):', error);
            // Non-critical, continue startup
        }
        console.log('Checking database connection...');
        await (0, pool_1.checkDatabaseConnection)();
        console.log('Database connection OK');
        // Initialize logging system
        console.log('Initializing logging system...');
        await BillingLogService_1.BillingLogService.initialize();
        const anomalyDetector = new AIAnomalyDetectionService_1.AIAnomalyDetectionService();
        await anomalyDetector.initialize();
        console.log('✅ Logging system initialized');
        // Ensure invoices and payments tables exist (CRITICAL for bookkeeping)
        try {
            await (0, autoFixDatabase_1.autoFixInvoicesAndPaymentsTables)();
            console.log('✅ Invoices and payments tables ensured');
        }
        catch (error) {
            console.error('⚠️ Error ensuring invoices and payments tables (non-critical):', error);
        }
        // Initialize WiFi management database (auto-create tables)
        try {
            console.log('Initializing WiFi management database...');
            const { WiFiDatabaseSetup } = await Promise.resolve().then(() => __importStar(require('./services/genieacs/WiFiDatabaseSetup')));
            await WiFiDatabaseSetup.initialize();
            console.log('✅ WiFi management database initialized');
        }
        catch (error) {
            console.error('⚠️ Error initializing WiFi database (non-critical):', error);
            // Non-critical, continue startup
        }
        // Initialize billing scheduler
        scheduler_1.SchedulerService.initialize();
        console.log('Billing scheduler initialized');
        // Initialize invoice auto-generation scheduler
        await invoiceSchedulerService_1.InvoiceSchedulerService.initialize();
        // Initialize Notification Scheduler
        const { NotificationScheduler } = await Promise.resolve().then(() => __importStar(require('./services/notification/NotificationScheduler')));
        NotificationScheduler.initialize();
        console.log('Notification scheduler initialized');
        // Initialize WhatsApp Business service
        // Initialize WhatsApp Business service (non-blocking)
        WhatsAppService_1.WhatsAppService.initialize()
            .then(() => console.log('WhatsApp Business service initialized'))
            .catch(error => {
            console.error('Failed to initialize WhatsApp service:', error);
            console.log('⚠️ WhatsApp notifications will not be available until service is initialized');
        });
        console.log('WhatsApp service initialization started in background');
        // Initialize default users
        const authController = new authController_1.AuthController();
        await authController.initializeDefaultUsers();
        console.log('Default users initialized');
        // Create HTTP server
        const server = (0, http_1.createServer)(app);
        server.listen(port, '0.0.0.0', () => {
            console.log(`Server running on http://localhost:${port}`);
            console.log(`Server also accessible on http://0.0.0.0:${port}`);
            console.log(`WebSocket available at ws://localhost:${port}/ws`);
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
start();
//# sourceMappingURL=server.js.map