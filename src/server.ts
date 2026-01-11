import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';
import flash from 'connect-flash';
import { checkDatabaseConnection, ensureInitialSchema } from './db/pool';
import expressLayouts from 'express-ejs-layouts';
import router from './routes/index';
import { errorHandler } from './middlewares/errorHandler';
import { SchedulerService } from './services/scheduler';
import { InvoiceSchedulerService } from './services/billing/invoiceSchedulerService';

// Use Baileys (pure JS, no Chromium) instead of whatsapp-web.js (Puppeteer/Chromium)
// Compatible with old CPUs (Intel Atom D2500, etc)
import { WhatsAppServiceBaileys } from './services/whatsapp/WhatsAppServiceBaileys';
import { createServer } from 'http';
import { db } from './db/pool';
import { AuthController } from './controllers/authController';
import { companyInfoMiddleware } from './middlewares/companyInfoMiddleware';
import { autoLogoutMiddleware } from './middlewares/autoLogoutMiddleware';
import { injectAppVersion } from './middlewares/versionMiddleware';
import {
	autoFixInvoicesAndPaymentsTables
} from './utils/autoFixDatabase';
import { loggingMiddleware, errorLoggingMiddleware } from './middlewares/loggingMiddleware';
import { BillingLogService } from './services/billing/BillingLogService';
import { AIAnomalyDetectionService } from './services/billing/AIAnomalyDetectionService';
import { pppoeStatsMiddleware } from './middlewares/pppoeStatsMiddleware';

// Load .env but don't override existing environment variables (e.g., from PM2)
dotenv.config({ override: false });

const app = express();
// AntiGravity: Force 3001 if 3000 is detected (conflict with GenieACS), otherwise respect env
const envPort = process.env.PORT ? Number(process.env.PORT) : 3001;
const port = envPort === 3000 ? 3001 : envPort;

// CommonJS build: __dirname is available from TS transpilation

// Security & perf
app.use(helmet({
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
app.use(compression());
app.use(morgan('dev'));
app.use(loggingMiddleware);

// Session with MySQL store (persists across server restarts)
// Using require for express-mysql-session due to its CommonJS nature
const MySQLStore = require('express-mysql-session')(session);

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

app.use(session({
	secret: process.env.SESSION_SECRET || 'billing-secret-key',
	resave: false,
	saveUninitialized: false,
	store: sessionStore,
	cookie: {
		secure: false,
		maxAge: 5 * 60 * 1000 // 5 minutes inactivity timeout
	},
	rolling: true // Reset expiry time on each request
}));

// Flash messages
app.use(flash());

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Expose variables to all views
app.use((req, res, next) => {
	(res.locals as any).query = req.query;
	(res.locals as any).flash = {
		success: req.flash('success'),
		error: req.flash('error')
	};
	(res.locals as any).currentPath = req.path || '/';
	(res.locals as any).recentRequests = [];
	(res.locals as any).chart = { labels: [], data: [] };
	// Expose authenticated user (if any) to views
	try {
		(res.locals as any).user = (req as any).user || null;
	} catch { }
	// Feature flags / UI toggles
	(res.locals as any).hideBillingCustomersMenu = String(process.env.HIDE_BILLING_CUSTOMERS_MENU).toLowerCase() === 'true';
	// Set default title
	(res.locals as any).title = 'Billing';
	next();
});

// Views
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
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
app.use(companyInfoMiddleware);

// Auto logout middleware - provides auto logout setting to all views
app.use(autoLogoutMiddleware);

// Version middleware - provides app version to all views
app.use(injectAppVersion);

// Logging middleware - moved up
// app.use(loggingMiddleware);

// PPPoE Stats middleware - for sidebar
app.use(pppoeStatsMiddleware);

// Network monitoring routes (public - no auth required)
import networkMonitoringRoutes from './routes/networkMonitoring';
app.use('/monitoring', networkMonitoringRoutes);

// Root router
app.use('/', router);

// Error logging middleware - must be after routes but before error handler
app.use(errorLoggingMiddleware);

// Payment routes
import paymentRoutes from './routes/payment';
app.use('/payment', paymentRoutes);

// General API routes
import apiRoutes from './routes/api';
app.use('/api', apiRoutes);

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
app.use(errorHandler);

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
		console.log(`🔄 Restarting server due to code updates (AntiGravity trigger) at ${new Date().toISOString()}...`);
		console.log(`Database config: host=${process.env.DB_HOST ?? 'localhost'}, port=${process.env.DB_PORT ?? 3306}, user=${process.env.DB_USER ?? 'root'}, db=${process.env.DB_NAME ?? 'billing'}`);
		console.log(`📂 Express Views Directory: ${app.get('views')}`); // Debug path views

		console.log('Ensuring initial schema...');
		await ensureInitialSchema();
		console.log('Schema ensured');

		// Ensure AI settings table exists
		try {
			console.log('Ensuring AI settings table...');
			const { AISettingsService } = await import('./services/payment/AISettingsService');
			await AISettingsService.ensureAISettingsTable();
			console.log('✅ AI settings table ensured');
		} catch (error) {
			console.error('⚠️ Error ensuring AI settings table (non-critical):', error);
			// Non-critical, continue startup
		}

		// Ensure notification templates exist
		try {
			console.log('Ensuring notification templates...');
			const { ensureNotificationTemplates } = await import('./utils/ensureNotificationTemplates');
			await ensureNotificationTemplates();
			console.log('✅ Notification templates ensured');
		} catch (error) {
			console.error('⚠️ Error ensuring notification templates (non-critical):', error);
			// Non-critical, continue startup
		}

		console.log('Checking database connection...');
		await checkDatabaseConnection();
		console.log('Database connection OK');

		// Initialize logging system
		console.log('Initializing logging system...');
		await BillingLogService.initialize();
		const anomalyDetector = new AIAnomalyDetectionService();
		await anomalyDetector.initialize();
		console.log('✅ Logging system initialized');





		// Ensure invoices and payments tables exist (CRITICAL for bookkeeping)
		try {
			await autoFixInvoicesAndPaymentsTables();
			console.log('✅ Invoices and payments tables ensured');
		} catch (error) {
			console.error('⚠️ Error ensuring invoices and payments tables (non-critical):', error);
		}

		// Initialize WiFi management database (auto-create tables)
		try {
			console.log('Initializing WiFi management database...');
			const { WiFiDatabaseSetup } = await import('./services/genieacs/WiFiDatabaseSetup');
			await WiFiDatabaseSetup.initialize();
			console.log('✅ WiFi management database initialized');
		} catch (error) {
			console.error('⚠️ Error initializing WiFi database (non-critical):', error);
			// Non-critical, continue startup
		}

		// Initialize billing scheduler
		SchedulerService.initialize();
		console.log('Billing scheduler initialized');

		// Initialize invoice auto-generation scheduler
		await InvoiceSchedulerService.initialize();

		// Initialize prepaid scheduler (auto-disable expired customers)
		try {
			const { PrepaidScheduler } = await import('./services/billing/PrepaidScheduler');
			PrepaidScheduler.initialize();
			console.log('✅ Prepaid scheduler initialized');
		} catch (error) {
			console.error('⚠️ Error initializing prepaid scheduler (non-critical):', error);
		}


		// Initialize Notification Scheduler
		const { NotificationScheduler } = await import('./services/notification/NotificationScheduler');
		const { ensureNotificationTemplates } = await import('./utils/ensureNotificationTemplates');
		await ensureNotificationTemplates();
		NotificationScheduler.initialize();
		console.log('Notification scheduler initialized');

		// Initialize Backup Scheduler
		const { BackupScheduler } = await import('./services/backup/BackupScheduler');
		BackupScheduler.init();

		// Initialize Media Cleanup Service
		const { MediaCleanupService } = await import('./services/cron/MediaCleanupService');
		MediaCleanupService.startScheduler(90); // 90 days retention

		// Initialize WhatsApp Business service
		// Can be disabled via DISABLE_WHATSAPP=true environment variable
		if (process.env.DISABLE_WHATSAPP === 'true') {
			console.log('⚠️ WhatsApp service DISABLED (DISABLE_WHATSAPP=true)');
		} else {
			// Initialize WhatsApp Business service (non-blocking)
			// Using Baileys (pure JS, no Chromium) - compatible with old CPUs
			WhatsAppServiceBaileys.initialize()
				.then(() => console.log('✅ WhatsApp Business service initialized (Baileys)'))
				.catch(error => {
					console.error('❌ Failed to initialize WhatsApp service:', error);
					console.log('⚠️ WhatsApp notifications will not be available until service is initialized');
				});
			console.log('📱 WhatsApp service (Baileys) initialization started in background');
		}

		// Initialize default users
		const authController = new AuthController();
		await authController.initializeDefaultUsers();
		console.log('Default users initialized');


		// Create HTTP server
		const server = createServer(app);


		// Listen on all interfaces (IPv4 and IPv6)
		server.listen(port, () => {
			console.log(`Server running on http://localhost:${port}`);
			console.log(`Server also accessible on http://0.0.0.0:${port}`);
			console.log(`WebSocket available at ws://localhost:${port}/ws`);

			// Signal PM2 that the app is ready (satisfied wait_ready: true)
			if (process.send) {
				process.send('ready');
			}
		});
	} catch (err) {
		console.error('Failed to start server:', err);
		if (err instanceof Error) {
			console.error('Error message:', err.message);
			console.error('Error stack:', err.stack);
		}
		process.exit(1);
	}
}

start();


