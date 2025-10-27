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
import { WhatsAppWebService } from './services/whatsapp/WhatsAppWebService';
import PrepaidSchedulerService from './services/prepaid/PrepaidSchedulerServiceComplete';
import TelegramAdminService from './services/telegram/TelegramAdminService';
import { createServer } from 'http';
import { db } from './db/pool';
import { AuthController } from './controllers/authController';
import { companyInfoMiddleware } from './middlewares/companyInfoMiddleware';

// Load .env but don't override existing environment variables (e.g., from PM2)
dotenv.config({ override: false });

const app = express();
const port = Number(process.env.PORT ?? 3000);

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
                "https://cdnjs.cloudflare.com"
            ],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdn.tailwindcss.com",
                "https://cdnjs.cloudflare.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                "https://cdn.tailwindcss.com"
            ],
            upgradeInsecureRequests: null
        }
    },
    hsts: false
}));
app.use(compression());
app.use(morgan('dev'));

// Session
app.use(session({
	secret: process.env.SESSION_SECRET || 'billing-secret-key',
	resave: false,
	saveUninitialized: false,
	cookie: { secure: false }
}));

// Flash messages
app.use(flash());

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

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
	} catch {}
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

// Root router
app.use('/', router);

// Payment routes
import paymentRoutes from './routes/payment';
app.use('/payment', paymentRoutes);

// 404 handler
app.use((req, res, next) => {
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
		await ensureInitialSchema();
		await checkDatabaseConnection();
		
		// Initialize billing scheduler
		SchedulerService.initialize();
		console.log('Billing scheduler initialized');
		
		// Initialize invoice auto-generation scheduler
		await InvoiceSchedulerService.initialize();
		console.log('Invoice auto-generation scheduler initialized');
		
		// Initialize Prepaid Scheduler
		await PrepaidSchedulerService.initialize();
		console.log('Prepaid scheduler initialized');
		
		// Initialize WhatsApp Web Service (non-blocking)
		WhatsAppWebService.initialize().catch(err => {
			console.error('WhatsApp Web Service initialization error (non-critical):', err);
		});
		
		// Initialize Telegram Bot Service (non-blocking)
		console.log('Telegram Bot Admin Service initialized');
		// Note: TelegramAdminService is auto-initialized on import via singleton pattern
		
		// Initialize default users
		const authController = new AuthController();
		await authController.initializeDefaultUsers();
		console.log('Default users initialized');
		
		// Create HTTP server
		const server = createServer(app);
		
		
		server.listen(port, () => {
			console.log(`Server running on http://localhost:${port}`);
			console.log(`WebSocket available at ws://localhost:${port}/ws`);
			
		});
	} catch (err) {
		console.error('Failed to start server:', err);
		process.exit(1);
	}
}

start();


