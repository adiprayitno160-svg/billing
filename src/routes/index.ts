import { Router, Request, Response } from 'express';
import multer from 'multer';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { getDashboard, getInterfaceStats } from '../controllers/dashboardController';
import { getMikrotikSettingsForm, postMikrotikSettings, postMikrotikTest } from '../controllers/settingsController';
import { UserController } from '../controllers/userController';
import { KasirController } from '../controllers/kasirController';
import { AuthMiddleware, isAuthenticated } from '../middlewares/authMiddleware';
import { getOltList, getOltEdit, postOltCreate, postOltDelete, postOltUpdate } from '../controllers/ftth/oltController';
import { getOdcList, getOdcAdd, getOdcEdit, postOdcCreate, postOdcDelete, postOdcUpdate } from '../controllers/ftth/odcController';
import { getOdpList, getOdpAdd, getOdpEdit, postOdpCreate, postOdpDelete, postOdpUpdate } from '../controllers/ftth/odpController';
import {
    getProfileList,
    postSyncProfiles,
    getProfileForm,
    getProfileEdit,
    postProfileCreate,
    postProfileUpdate,
    postProfileDelete,
    getPackageList,
    getPackageForm,
    getPackageEdit,
    postPackageCreate,
    postPackageUpdate,
    postPackageDelete
} from '../controllers/pppoeController';
import { getProfileById, updateProfile, listProfiles } from '../services/pppoeService';
import { getMikrotikConfig } from '../services/pppoeService';
import { findPppProfileIdByName, getPppProfiles, updatePppProfile } from '../services/mikrotikService';
import {
    getStaticIpPackageList,
    getStaticIpPackageAdd,
    getStaticIpPackageEdit,
    postStaticIpPackageCreate,
    postStaticIpPackageUpdate,
    postStaticIpPackageDelete,
    postStaticIpPackageCreateQueues,
    postStaticIpPackageDeleteQueues
} from '../controllers/staticIpPackageController';
import {
    getStaticIpClientList,
    getStaticIpClientAdd,
    postStaticIpClientCreate,
    postStaticIpClientDelete,
    getStaticIpClientEdit,
    postStaticIpClientUpdate,
    testMikrotikIpAdd,
    autoDebugIpStatic
} from '../controllers/staticIpClientController';
import { ReportingController } from '../controllers/reportingController';
import paymentRoutes from './payment';

import authRoutes from './auth';
import kasirRoutes from './kasir';
import addressListRoutes from './addressList';
import billingRoutes from './billing';
import accountingRoutes from './accounting';
import monitoringRoutes from './monitoring';
import slaRoutes from './sla';
import maintenanceRoutes from './maintenance';
import settingsRoutes from './settings';
import whatsappRoutes from './whatsapp';

import { pageRouter as notificationPageRouter, apiRouter as notificationApiRouter } from './notification';
import genieacsRoutes from './genieacs';
import wifiAdminRoutes from './wifi-admin';
import { BulkOperationsController } from '../controllers/bulkOperationsController';
import {
    getAboutPage,
    checkUpdates,
    updateAppVersion,
    updateSettings,
    getUpdateHistoryPage,
    checkHotfix,
    applyHotfixUpdate
} from '../controllers/aboutController';
import {
    getDatabaseManagement,
    fixDatabaseIssues,
    runDatabaseMigration,
    runLatePaymentTrackingMigration,
    getDatabaseLogs
} from '../controllers/databaseController';
import { BackupController } from '../controllers/backupController';
import { CustomerIdGenerator } from '../utils/customerIdGenerator';


// import { BillingDashboardController } from '../controllers/billing/billingDashboardController';
import {
    getCustomerList,
    getCustomerDetail,
    getCustomerEdit,
    updateCustomer,
    // quickCheckCustomer, // TEMPORARILY COMMENTED OUT - not exported from customerController
    // quickFixCustomerByName, // TEMPORARILY COMMENTED OUT - not exported from customerController
    testMikrotikAddressLists
} from '../controllers/customerController';
import {
    exportCustomersToExcel,
    importCustomersFromExcel,
    getImportTemplate
} from '../controllers/excelController';
// import { 
//     getInvoiceList,
//     getInvoiceDetail,
//     getInvoiceCreate,
//     postInvoiceCreate,
//     getInvoiceGenerate,
//     postInvoiceMarkSent,
//     getInvoicePrint,
//     getInvoicePrintThermal,
//     getInvoiceBatchPrint,
//     postInvoiceBulkDelete,
//     deleteInvoice,
//     postInvoiceSendWhatsapp,
//     postPartialPayment
// } from '../controllers/billing/invoiceController';
// import { isolateCustomer, unisolateCustomer } from '../controllers/billing/customerController';
// import { 
//     getPaymentGatewaySettings,
//     postPaymentGatewayCreate,
//     postPaymentGatewayUpdate,
//     postPaymentGatewayTest,
//     postCreatePaymentRequest,
//     postPaymentGatewayCallback,
//     getPaymentGatewayStatus
// } from '../controllers/billing/paymentGatewayController';
// import { 
//     getSchedulerDashboard,
//     postInitializeScheduler,
//     getSchedulerStatus,
//     postTriggerAutoIsolation,
//     postTriggerAutoRestore,
//     postUpdateAutoIsolationSchedule,
//     postUpdateInvoiceSchedule,
//     postUpdateNotificationSettings,
//     getSchedulerSettings
// } from '../controllers/billing/schedulerController';







const router = Router();
const authMiddleware = new AuthMiddleware();

// Configure multer for file uploads with production-ready settings
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1,
        fieldSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        console.log('🔍 Multer fileFilter - Checking file:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            fieldname: file.fieldname
        });

        // More lenient mime type check for production compatibility
        const isExcelMimetype =
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.mimetype === 'application/octet-stream'; // Fallback for some servers

        const isExcelExtension =
            file.originalname.toLowerCase().endsWith('.xlsx') ||
            file.originalname.toLowerCase().endsWith('.xls');

        if (isExcelMimetype || isExcelExtension) {
            console.log('✅ File accepted');
            cb(null, true);
        } else {
            console.log('❌ File rejected - Invalid type');
            cb(new Error('Hanya file Excel (.xlsx, .xls) yang diperbolehkan'));
        }
    }
});

// NOTIFICATION ROUTES - Mount notification page router
// Mount notification page router at /notification BEFORE middleware
router.use('/notification', notificationPageRouter);

// Middleware untuk mencegah kasir mengakses halaman admin
router.use(async (req, res, next) => {
    // Skip untuk route kasir, auth, API routes, dan notification
    if (req.path.startsWith('/kasir') ||
        req.path.startsWith('/auth') ||

        req.path.startsWith('/api') ||
        req.path.startsWith('/notification') ||
        req.path === '/login' ||
        req.path === '/logout') {
        return next();
    }

    // Load user first jika ada session
    const userId = (req.session as any)?.userId;
    if (userId && !req.user) {
        try {
            const { UserService } = await import('../services/userService');
            const userService = new UserService();
            const user = await userService.getUserById(userId);
            if (user && user.is_active) {
                req.user = user;
            }
        } catch (error) {
            console.error('Error loading user:', error);
        }
    }

    // Terapkan requireNonKasir untuk route lainnya
    return authMiddleware.requireNonKasir(req, res, next);
});


// Simple notification check endpoint - HARUS SEBELUM route lain
console.log('[ROUTE] Registering GET /api/check-notification');
router.get('/api/check-notification', async (req, res) => {
    console.log('[ROUTE] GET /api/check-notification HIT!');
    try {
        const connection = await databasePool.getConnection();
        try {
            // Cek recent customer_created notifications
            const [notifications] = await connection.query<RowDataPacket[]>(
                `SELECT 
                    unq.id,
                    unq.customer_id,
                    c.name as customer_name,
                    c.phone,
                    unq.status,
                    unq.error_message,
                    unq.created_at,
                    unq.sent_at,
                    unq.retry_count
                 FROM unified_notifications_queue unq
                 LEFT JOIN customers c ON unq.customer_id = c.id
                 WHERE unq.notification_type = 'customer_created'
                 ORDER BY unq.created_at DESC
                 LIMIT 10`
            );

            // Cek template
            const [templates] = await connection.query<RowDataPacket[]>(
                `SELECT * FROM notification_templates 
                 WHERE notification_type = 'customer_created' AND channel = 'whatsapp'`
            );

            // Cek WhatsApp status
            let whatsappStatus = { ready: false, error: 'Not checked' };
            try {
                const { WhatsAppService } = await import('../services/whatsapp/WhatsAppService');
                whatsappStatus = WhatsAppService.getStatus();
            } catch (e: any) {
                whatsappStatus = { ready: false, error: e.message };
            }

            // Stats
            const [stats] = await connection.query<RowDataPacket[]>(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                 FROM unified_notifications_queue
                 WHERE notification_type = 'customer_created'
                 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
            );

            res.json({
                success: true,
                data: {
                    notifications: notifications,
                    template: templates[0] || null,
                    whatsapp: whatsappStatus,
                    stats: stats[0] || {},
                    summary: {
                        totalNotifications: notifications.length,
                        templateExists: templates.length > 0,
                        templateActive: templates.length > 0 && templates[0].is_active === 1,
                        whatsappReady: whatsappStatus.ready
                    }
                }
            });
        } finally {
            connection.release();
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/', getDashboard);
router.get('/api/interface-stats', getInterfaceStats);

// Redirect /dashboard to root (dashboard is the root page)
router.get('/dashboard', (req, res) => res.redirect('/'));

// Billing routes
router.use('/billing', billingRoutes);



// Accounting routes
console.log('[ROUTE REGISTRATION] Registering /accounting routes...');
router.use('/accounting', accountingRoutes);
console.log('[ROUTE REGISTRATION] Accounting routes registered successfully');



// Monitoring routes
router.use('/monitoring', monitoringRoutes);

// SLA Monitoring routes (submenu of monitoring)
router.use('/monitoring/sla', slaRoutes);

// Maintenance Schedule routes (submenu of monitoring)
router.use('/monitoring/maintenance', maintenanceRoutes);

// WhatsApp routes
router.use('/whatsapp', whatsappRoutes);

// GenieACS routes
router.use('/genieacs', genieacsRoutes);

// WiFi Admin routes
router.use('/wifi-admin', wifiAdminRoutes);



// ============================================
// API ROUTES - Must be registered early to avoid conflicts
// ============================================

// API endpoint untuk get customers with device_id (for WiFi admin)
router.get('/api/customers', async (req, res) => {
    try {
        const hasDevice = req.query.has_device === 'true';

        let query = 'SELECT id, name, phone, device_id FROM customers';
        if (hasDevice) {
            query += ' WHERE device_id IS NOT NULL';
        }
        query += ' ORDER BY name ASC';

        const [customers] = await databasePool.query<RowDataPacket[]>(query);

        res.json({
            success: true,
            customers
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API endpoint untuk create/update PPPoE secret
// IMPORTANT: This route must be registered before any generic /customers/:id routes
console.log('[ROUTE REGISTRATION] Registering POST /api/pppoe/secret/create route...');
router.post('/api/pppoe/secret/create', async (req, res) => {
    // Log immediately when route is hit - use process.stdout.write to ensure it's flushed
    process.stdout.write('\n');
    process.stdout.write('========================================\n');
    process.stdout.write('[API] ========== ROUTE HIT ==========\n');
    process.stdout.write('[API] POST /api/pppoe/secret/create - Request received\n');
    process.stdout.write('[API] Time: ' + new Date().toISOString() + '\n');
    process.stdout.write('[API] Request method: ' + req.method + '\n');
    process.stdout.write('[API] Request URL: ' + req.url + '\n');
    process.stdout.write('[API] Request path: ' + req.path + '\n');
    process.stdout.write('[API] Request originalUrl: ' + req.originalUrl + '\n');
    console.log('[API] Request body (raw):', req.body);
    console.log('[API] Request body (stringified):', JSON.stringify(req.body, null, 2));
    console.log('[API] Request headers:', JSON.stringify(req.headers, null, 2));
    process.stdout.write('========================================\n');
    process.stdout.write('\n');

    try {
        // Ensure response is always JSON
        res.setHeader('Content-Type', 'application/json');

        const { customerId, username, password, profileId, customerName, packageId } = req.body;

        console.log('[API] ========== CREATE SECRET API START ==========');
        console.log('[API] Request body:', JSON.stringify(req.body, null, 2));
        console.log('[API] Parsed data:', {
            customerId,
            username: username || 'MISSING',
            password: password ? '***' : 'empty',
            profileId,
            customerName,
            packageId: packageId || 'MISSING'
        });

        if (!customerId) {
            console.log('[API] ❌ Validation failed - customerId missing');
            return res.status(400).json({
                success: false,
                error: 'customerId wajib diisi'
            });
        }

        if (!username || !username.trim()) {
            console.log('[API] ❌ Validation failed - username missing or empty');
            return res.status(400).json({
                success: false,
                error: 'username wajib diisi'
            });
        }

        if (!password || !password.trim()) {
            console.log('[API] ❌ Validation failed - password missing or empty');
            return res.status(400).json({
                success: false,
                error: 'password wajib diisi'
            });
        }

        const cfg = await getMikrotikConfig();
        if (!cfg) {
            return res.status(500).json({
                success: false,
                error: 'MikroTik tidak dikonfigurasi'
            });
        }

        const { findPppoeSecretIdByName, createPppoeSecret, updatePppoeSecret } = await import('../services/mikrotikService');
        const { getProfileById, getPackageById } = await import('../services/pppoeService');

        // Get profile name from package if package is selected
        let profileName: string | undefined = undefined;

        // First, try to get profile from package (if package_id is provided)
        if (packageId) {
            try {
                const packageData = await getPackageById(Number(packageId));
                if (packageData && packageData.profile_id) {
                    const profile = await getProfileById(packageData.profile_id);
                    if (profile) {
                        profileName = profile.name;
                        console.log(`[API] Profile dari paket (ID: ${packageId}): ${profileName}`);
                    }
                }
            } catch (packageError) {
                console.error('⚠️ Gagal mendapatkan profile dari paket:', packageError);
            }
        }

        // Fallback: Get profile name if profile_id is provided directly
        if (!profileName && profileId) {
            try {
                const profile = await getProfileById(Number(profileId));
                if (profile) {
                    profileName = profile.name;
                    console.log(`[API] Profile dari profile_id (${profileId}): ${profileName}`);
                }
            } catch (profileError) {
                console.error('⚠️ Gagal mendapatkan profile:', profileError);
            }
        }

        // Use username as the name for PPPoE secret (not customer ID)
        // IMPORTANT: NEVER use customer ID, always use username
        const secretName = username.trim();

        console.log('[API] ========== SECRET CREATION DETAILS ==========');
        console.log('[API] Customer ID:', customerId);
        console.log('[API] Username dari form:', username);
        console.log('[API] Secret Name (FINAL - akan digunakan):', secretName);
        console.log('[API] ⚠️ IMPORTANT: Secret akan dibuat dengan username, BUKAN customer ID!');
        console.log('[API] Profile yang akan digunakan:', profileName || 'tidak ada (MikroTik akan menggunakan default)');
        console.log('[API] Package ID:', packageId || 'tidak ada');

        // Check if secret already exists (by username or customer ID)
        let existingSecretByUsername = null;
        let existingSecretByCustomerId = null;
        let secretFoundBy = null;

        // Check by username first
        try {
            existingSecretByUsername = await findPppoeSecretIdByName(cfg, secretName);
            if (existingSecretByUsername) {
                console.log('[API] Secret found with username:', secretName);
                secretFoundBy = 'username';
            }
        } catch (findError: any) {
            // Secret doesn't exist with this username
            console.log(`[API] Secret dengan username "${secretName}" tidak ditemukan`);
        }

        // Check by customer ID (for legacy secrets)
        if (!existingSecretByUsername && customerId && !isNaN(customerId)) {
            const customerIdStr = customerId.toString();
            try {
                existingSecretByCustomerId = await findPppoeSecretIdByName(cfg, customerIdStr);
                if (existingSecretByCustomerId) {
                    console.log(`[API] ⚠️ Secret ditemukan dengan Customer ID (legacy): ${customerIdStr}`);
                    console.log(`[API] ⚠️ Secret ini akan di-update ke username: ${secretName}`);
                    secretFoundBy = 'customer_id';
                }
            } catch (findCustomerIdError: any) {
                console.log(`[API] Secret dengan Customer ID "${customerIdStr}" tidak ditemukan`);
            }
        }

        if (existingSecretByUsername || existingSecretByCustomerId) {
            // If secret found with customer ID (legacy), we need to delete and recreate with username
            if (secretFoundBy === 'customer_id' && customerId && !isNaN(customerId)) {
                console.log('[API] ⚠️ Secret ditemukan dengan Customer ID (legacy), akan dihapus dan dibuat ulang dengan username');
                const { deletePppoeSecret } = await import('../services/mikrotikService');

                // Delete old secret with customer ID
                await deletePppoeSecret(cfg, customerId.toString());
                console.log(`[API] ✅ Secret lama dengan Customer ID "${customerId}" berhasil dihapus`);

                // Create new secret with username
                await createPppoeSecret(cfg, {
                    name: secretName, // Use username, not customer ID
                    password: password,
                    profile: profileName || undefined,
                    comment: customerName || `Customer ${customerId}`
                });

                console.log(`[API] ✅ Secret baru dengan username "${secretName}" berhasil dibuat`);

                return res.json({
                    success: true,
                    message: `PPPoE secret berhasil diubah dari Customer ID "${customerId}" ke username "${secretName}" di MikroTik${profileName ? ` dengan profile "${profileName}"` : ''}`,
                    action: 'recreated'
                });
            } else {
                // Update existing secret with username (normal update)
                const updateData: any = {
                    password: password,
                    comment: customerName || `Customer ${customerId}`
                };

                if (profileName) {
                    updateData.profile = profileName;
                    console.log(`[API] Profile akan di-update ke: ${profileName}`);
                } else {
                    console.log(`[API] Profile tidak di-update (tidak ada profile dari paket)`);
                }

                // Update secret (already has correct username)
                await updatePppoeSecret(cfg, secretName, updateData);

                return res.json({
                    success: true,
                    message: `PPPoE secret dengan username "${secretName}" berhasil di-update di MikroTik${profileName ? ` dengan profile "${profileName}"` : ''}`,
                    action: 'updated'
                });
            }
        } else {
            // Create new secret
            // IMPORTANT: Don't use 'default' as fallback - let MikroTik use its default or get from package
            console.log('[API] ========== CREATING NEW SECRET ==========');
            console.log('[API] Secret akan dibuat dengan:');
            console.log('[API]    - Name (username):', secretName);
            console.log('[API]    - Profile:', profileName || 'tidak ada (MikroTik default)');
            console.log('[API]    - Comment:', customerName || `Customer ${customerId}`);
            console.log('[API] ⚠️ IMPORTANT: Secret dibuat dengan username, BUKAN customer ID!');

            if (!profileName) {
                console.warn('[API] ⚠️ Profile tidak ditemukan dari paket atau profile_id. Secret akan dibuat tanpa profile (MikroTik akan menggunakan default).');
            }

            await createPppoeSecret(cfg, {
                name: secretName, // ALWAYS use username, NEVER customer ID
                password: password,
                profile: profileName || undefined, // Don't set profile if not found, let MikroTik use default
                comment: customerName || `Customer ${customerId}`
            });

            console.log('[API] ✅ Secret berhasil dibuat dengan username:', secretName);
            console.log('[API] ========== CREATE SECRET API END ==========');

            return res.json({
                success: true,
                message: `PPPoE secret dengan username "${secretName}" berhasil dibuat di MikroTik${profileName ? ` dengan profile "${profileName}"` : ' (menggunakan profile default MikroTik)'}`,
                action: 'created'
            });
        }
    } catch (error: unknown) {
        console.error('\n');
        console.error('========================================');
        console.error('[API] ========== ERROR OCCURRED ==========');
        console.error('[API] Error creating/updating PPPoE secret:', error);
        console.error('[API] Error type:', typeof error);
        console.error('[API] Error message:', error instanceof Error ? error.message : String(error));
        console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('========================================');
        console.error('\n');

        const errorMessage = error instanceof Error ? error.message : 'Gagal membuat/update PPPoE secret';

        // Ensure error response is also JSON
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});


// Portal routes


// Settings routes - MUST be registered BEFORE specific /settings routes to avoid conflicts
router.use('/settings', settingsRoutes);

// Mount API router for notification
console.log('[ROUTE REGISTRATION] Registering /api/notification routes...');
router.use('/api/notification', notificationApiRouter);
console.log('[ROUTE REGISTRATION] /api/notification routes registered');


// Pengaturan -> MikroTik
router.get('/settings/mikrotik', getMikrotikSettingsForm);
router.post('/settings/mikrotik', postMikrotikSettings);
router.post('/settings/mikrotik/test', postMikrotikTest);


// Pengaturan -> Payment Gateway
router.get('/settings/payment-gateway', (req, res) => res.render('settings/payment-gateway', { title: 'Pengaturan Payment Gateway', layout: 'layouts/main' }));
router.post('/settings/payment-gateway', (req, res) => {
    // TODO: Implement payment gateway settings
    res.redirect('/settings/payment-gateway');
});


// Pengaturan -> WhatsApp (REMOVED - user requested deletion)

// Pengaturan -> User Management
const userController = new UserController();
router.get('/settings/users', userController.index.bind(userController));
router.get('/settings/users/create', userController.createForm.bind(userController));
router.post('/settings/users', userController.create.bind(userController));
router.get('/settings/users/:id/edit', userController.editForm.bind(userController));
router.post('/settings/users/:id', userController.update.bind(userController));
router.post('/settings/users/:id/delete', userController.delete.bind(userController));
router.post('/settings/users/:id/toggle-status', userController.toggleStatus.bind(userController));

// FTTH OLT - Basic CRUD only
router.get('/ftth/olt', getOltList);
router.get('/ftth/olt/add', (req, res) => res.render('ftth/olt_add', { title: 'Tambah OLT' }));
router.get('/ftth/olt/:id', getOltEdit);
router.post('/ftth/olt', postOltCreate);
router.post('/ftth/olt/:id', postOltUpdate);
router.post('/ftth/olt/:id/delete', postOltDelete);



// FTTH ODC
router.get('/ftth/odc', getOdcList);
router.get('/ftth/odc/add', getOdcAdd);
router.get('/ftth/odc/:id', getOdcEdit);
router.post('/ftth/odc', postOdcCreate);
router.post('/ftth/odc/:id', postOdcUpdate);
router.post('/ftth/odc/:id/delete', postOdcDelete);

// FTTH ODP
router.get('/ftth/odp', getOdpList);
router.get('/ftth/odp/add', getOdpAdd);
router.get('/ftth/odp/:id', getOdpEdit);
router.post('/ftth/odp', postOdpCreate);
router.post('/ftth/odp/:id', postOdpUpdate);
router.post('/ftth/odp/:id/delete', postOdpDelete);


// Paket Internet -> PPPOE
// Profile routes
// IMPORTANT: Routes dengan path spesifik HARUS ditempatkan SEBELUM routes dengan parameter dinamis
router.get('/packages/pppoe/profiles', getProfileList);
router.post('/packages/pppoe/profiles/sync', postSyncProfiles);
router.get('/packages/pppoe/profiles/new', getProfileForm);
router.get('/packages/pppoe/profiles/test-update-100', async (req: Request, res: Response) => {
    try {
        const { RouterOSAPI } = await import('routeros-api');

        console.log('🚀 [QUICK TEST] Starting update for package 100...');

        // Get MikroTik config
        const config = await getMikrotikConfig();
        if (!config) {
            req.flash('error', 'Konfigurasi MikroTik tidak ditemukan');
            return res.redirect('/packages/pppoe/profiles');
        }

        // Cari profil paket 100
        const allProfiles = await listProfiles();
        const profile100 = allProfiles.find(p =>
            p.name.toLowerCase().includes('100') ||
            p.name.toLowerCase().includes('paket 100') ||
            p.id === 100
        );

        if (!profile100) {
            req.flash('error', 'Profile paket 100 tidak ditemukan');
            return res.redirect('/packages/pppoe/profiles');
        }

        // Connect to MikroTik
        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 10000
        });

        await api.connect();

        // Cari profile di MikroTik
        const mikrotikProfiles = await getPppProfiles(config);
        const foundProfile = mikrotikProfiles.find(p => p.name === profile100.name);

        if (!foundProfile) {
            api.close();
            req.flash('error', `Profile "${profile100.name}" tidak ditemukan di MikroTik`);
            return res.redirect('/packages/pppoe/profiles');
        }

        const mikrotikId = foundProfile['.id'];

        // Update langsung ke 10M/10M
        await api.write('/ppp/profile/set', [
            `=.id=${mikrotikId}`,
            `=rate-limit=10M/10M`
        ]);

        // Verify
        await new Promise(resolve => setTimeout(resolve, 1000));
        const verifyProfiles = await getPppProfiles(config);
        const verifyProfile = verifyProfiles.find(p => p['.id'] === mikrotikId);

        api.close();

        if (verifyProfile && (verifyProfile['rate-limit']?.includes('10M') || verifyProfile['rate-limit-rx']?.includes('10M'))) {
            req.flash('success', `Profile "${profile100.name}" berhasil diupdate ke 10M/10M di MikroTik!`);
        } else {
            req.flash('error', 'Update gagal atau belum terverifikasi');
        }

        res.redirect('/packages/pppoe/profiles');
    } catch (error: any) {
        console.error('❌ [QUICK TEST] Error:', error);
        req.flash('error', `Gagal update: ${error.message || 'Unknown error'}`);
        res.redirect('/packages/pppoe/profiles');
    }
});

// Routes dengan parameter dinamis HARUS setelah routes spesifik
router.get('/packages/pppoe/profiles/:id/edit', getProfileEdit);
router.post('/packages/pppoe/profiles/create', postProfileCreate);
router.post('/packages/pppoe/profiles/:id/update', postProfileUpdate);
router.delete('/packages/pppoe/profiles/:id', postProfileDelete);

// Test endpoint untuk sinkronisasi profil
router.get('/api/test/profile-sync/:id', async (req: Request, res: Response) => {
    try {
        const profileId = Number(req.params.id);

        if (!profileId || isNaN(profileId)) {
            return res.status(400).json({
                success: false,
                error: 'Profile ID tidak valid'
            });
        }

        // Get profile dari database
        const profile = await getProfileById(profileId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile tidak ditemukan'
            });
        }

        // Get MikroTik config
        const config = await getMikrotikConfig();
        if (!config) {
            return res.status(500).json({
                success: false,
                error: 'Konfigurasi MikroTik tidak ditemukan'
            });
        }

        const testResults: any = {
            profile: {
                id: profile.id,
                name: profile.name,
                rate_limit_rx: (profile as any).rate_limit_rx,
                rate_limit_tx: (profile as any).rate_limit_tx
            },
            mikrotik: {
                config: {
                    host: config.host,
                    port: config.port,
                    username: config.username
                }
            },
            steps: []
        };

        // Step 1: Cari profile di MikroTik
        testResults.steps.push({
            step: 1,
            action: 'Mencari profile di MikroTik',
            status: 'running'
        });

        const mikrotikId = await findPppProfileIdByName(config, profile.name);

        if (mikrotikId) {
            testResults.steps[0].status = 'success';
            testResults.steps[0].result = `Profile ditemukan di MikroTik dengan ID: ${mikrotikId}`;
            testResults.mikrotik.profile_id = mikrotikId;
        } else {
            testResults.steps[0].status = 'warning';
            testResults.steps[0].result = 'Profile tidak ditemukan di MikroTik';
        }

        // Step 2: Get semua profile dari MikroTik untuk verifikasi
        testResults.steps.push({
            step: 2,
            action: 'Mengambil semua profile dari MikroTik',
            status: 'running'
        });

        const mikrotikProfiles = await getPppProfiles(config);
        const foundProfile = mikrotikProfiles.find(p => p.name === profile.name);

        if (foundProfile) {
            testResults.steps[1].status = 'success';
            testResults.steps[1].result = `Profile ditemukan dengan rate-limit: ${foundProfile['rate-limit'] || 'N/A'}`;
            testResults.mikrotik.current_rate_limit = foundProfile['rate-limit'];
            testResults.mikrotik.current_rate_limit_rx = foundProfile['rate-limit-rx'];
            testResults.mikrotik.current_rate_limit_tx = foundProfile['rate-limit-tx'];
        } else {
            testResults.steps[1].status = 'warning';
            testResults.steps[1].result = 'Profile tidak ditemukan di daftar profile MikroTik';
        }

        // Step 3: Test update (simulasi)
        testResults.steps.push({
            step: 3,
            action: 'Test update profile ke MikroTik',
            status: 'info'
        });

        const dbRateLimitRx = (profile as any).rate_limit_rx || '0';
        const dbRateLimitTx = (profile as any).rate_limit_tx || '0';

        testResults.steps[2].result = `Database: RX=${dbRateLimitRx}, TX=${dbRateLimitTx}`;
        if (foundProfile) {
            const mtRateLimitRx = foundProfile['rate-limit-rx'] || 'N/A';
            const mtRateLimitTx = foundProfile['rate-limit-tx'] || 'N/A';
            testResults.steps[2].result += ` | MikroTik: RX=${mtRateLimitRx}, TX=${mtRateLimitTx}`;

            if (dbRateLimitRx !== mtRateLimitRx || dbRateLimitTx !== mtRateLimitTx) {
                testResults.steps[2].status = 'warning';
                testResults.steps[2].result += ' | ⚠️ Nilai tidak sama! Perlu sinkronisasi.';
                testResults.sync_needed = true;
            } else {
                testResults.steps[2].status = 'success';
                testResults.steps[2].result += ' | ✅ Nilai sudah sama.';
                testResults.sync_needed = false;
            }
        } else {
            testResults.steps[2].status = 'warning';
            testResults.steps[2].result += ' | ⚠️ Profile tidak ada di MikroTik, perlu dibuat.';
            testResults.sync_needed = true;
        }

        testResults.success = true;
        testResults.message = 'Test sinkronisasi selesai';

        res.json(testResults);

    } catch (error: any) {
        console.error('Test sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Gagal menjalankan test sinkronisasi',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Test endpoint untuk update profile paket 100 ke 10M dengan retry otomatis
router.get('/test/force-update-profile-100', async (req: Request, res: Response) => {
    const { RouterOSAPI } = await import('routeros-api');

    try {
        console.log('🚀 [FORCE UPDATE] Starting force update for package 100 profile...');

        // Get MikroTik config
        const config = await getMikrotikConfig();
        if (!config) {
            return res.status(500).json({
                success: false,
                error: 'Konfigurasi MikroTik tidak ditemukan'
            });
        }

        // Cari profil paket 100 - bisa dari nama atau ID
        const allProfiles = await listProfiles();
        const profile100 = allProfiles.find(p =>
            p.name.toLowerCase().includes('100') ||
            p.name.toLowerCase().includes('paket 100') ||
            p.id === 100
        );

        if (!profile100) {
            return res.status(404).json({
                success: false,
                error: 'Profile paket 100 tidak ditemukan',
                available_profiles: allProfiles.map(p => ({ id: p.id, name: p.name }))
            });
        }

        console.log(`✅ [FORCE UPDATE] Found profile: ${profile100.name} (ID: ${profile100.id})`);

        // Connect to MikroTik
        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 10000
        });

        await api.connect();
        console.log('✅ [FORCE UPDATE] Connected to MikroTik');

        // Cari profile di MikroTik
        const mikrotikProfiles = await getPppProfiles(config);
        const foundProfile = mikrotikProfiles.find(p => p.name === profile100.name);

        if (!foundProfile) {
            api.close();
            return res.status(404).json({
                success: false,
                error: `Profile "${profile100.name}" tidak ditemukan di MikroTik`,
                available_mikrotik_profiles: mikrotikProfiles.map(p => p.name)
            });
        }

        const mikrotikId = foundProfile['.id'];
        const currentRateLimit = foundProfile['rate-limit'] || 'N/A';

        console.log(`📊 [FORCE UPDATE] Current rate-limit in MikroTik: ${currentRateLimit}`);
        console.log(`📊 [FORCE UPDATE] Target: 10M/10M`);

        const results: any = {
            profile: {
                id: profile100.id,
                name: profile100.name,
                database_rate_limit_rx: (profile100 as any).rate_limit_rx,
                database_rate_limit_tx: (profile100 as any).rate_limit_tx
            },
            mikrotik: {
                profile_id: mikrotikId,
                current_rate_limit: currentRateLimit,
                target_rate_limit: '10M/10M'
            },
            attempts: []
        };

        // Try multiple methods to update
        const updateMethods = [
            {
                name: 'Method 1: Direct API write with simple format',
                execute: async () => {
                    await api.write('/ppp/profile/set', [
                        `=.id=${mikrotikId}`,
                        `=rate-limit=10M/10M`
                    ]);
                }
            },
            {
                name: 'Method 2: Using updatePppProfile function',
                execute: async () => {
                    await updatePppProfile(config, mikrotikId, {
                        'rate-limit-rx': '10M',
                        'rate-limit-tx': '10M'
                    });
                }
            },
            {
                name: 'Method 3: Direct API with explicit format',
                execute: async () => {
                    await api.write('/ppp/profile/set', [
                        `=.id=${mikrotikId}`,
                        `=rate-limit=10M/10M`,
                        `=name=${profile100.name}`
                    ]);
                }
            }
        ];

        let success = false;
        let lastError: any = null;

        for (let i = 0; i < updateMethods.length; i++) {
            const method = updateMethods[i];
            console.log(`🔄 [FORCE UPDATE] Attempt ${i + 1}: ${method.name}`);

            try {
                // Close and reconnect for each attempt
                api.close();
                await new Promise(resolve => setTimeout(resolve, 500));
                await api.connect();

                await method.execute();

                // Verify update
                await new Promise(resolve => setTimeout(resolve, 1000));
                const verifyProfiles = await getPppProfiles(config);
                const verifyProfile = verifyProfiles.find(p => p['.id'] === mikrotikId);

                if (verifyProfile) {
                    const newRateLimit = verifyProfile['rate-limit'] || '';
                    const newRx = verifyProfile['rate-limit-rx'] || '';
                    const newTx = verifyProfile['rate-limit-tx'] || '';

                    console.log(`✅ [FORCE UPDATE] Verification - Rate limit: ${newRateLimit}, RX: ${newRx}, TX: ${newTx}`);

                    // Check if update successful (10M/10M or 10M in RX/TX)
                    if (newRateLimit.includes('10M') || newRx.includes('10M') || newTx.includes('10M')) {
                        results.attempts.push({
                            method: method.name,
                            status: 'success',
                            message: 'Update berhasil!',
                            verified_rate_limit: newRateLimit,
                            verified_rx: newRx,
                            verified_tx: newTx
                        });
                        success = true;
                        results.final_rate_limit = newRateLimit;
                        results.final_rx = newRx;
                        results.final_tx = newTx;
                        break;
                    } else {
                        results.attempts.push({
                            method: method.name,
                            status: 'partial',
                            message: 'Command berhasil tapi nilai belum sesuai',
                            verified_rate_limit: newRateLimit,
                            verified_rx: newRx,
                            verified_tx: newTx
                        });
                    }
                } else {
                    results.attempts.push({
                        method: method.name,
                        status: 'error',
                        message: 'Profile tidak ditemukan setelah update'
                    });
                }
            } catch (error: any) {
                console.error(`❌ [FORCE UPDATE] Method ${i + 1} failed:`, error.message);
                lastError = error;
                results.attempts.push({
                    method: method.name,
                    status: 'error',
                    message: error.message || 'Unknown error',
                    error: error.toString()
                });
            }
        }

        api.close();

        if (success) {
            results.success = true;
            results.message = 'Profile berhasil diupdate ke 10M/10M!';
            res.json(results);
        } else {
            results.success = false;
            results.message = 'Semua metode update gagal';
            results.last_error = lastError?.message;
            res.status(500).json(results);
        }

    } catch (error: any) {
        console.error('❌ [FORCE UPDATE] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Gagal menjalankan force update',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Package routes
router.get('/packages/pppoe/packages', getPackageList);
router.get('/packages/pppoe/packages/create', getPackageForm);
router.get('/packages/pppoe/packages/:id/edit', getPackageEdit);
router.post('/packages/pppoe/packages/create', postPackageCreate);
router.post('/packages/pppoe/packages/:id/update', postPackageUpdate);
router.post('/packages/pppoe/packages/:id/delete', postPackageDelete);

// Paket Internet -> Static IP
router.get('/packages/static-ip', getStaticIpPackageList);
router.get('/packages/static-ip/add', getStaticIpPackageAdd);
router.post('/packages/static-ip', postStaticIpPackageCreate);
router.get('/packages/static-ip/:id/edit', getStaticIpPackageEdit);
router.post('/packages/static-ip/:id/delete', postStaticIpPackageDelete);
router.post('/packages/static-ip/:id/update', postStaticIpPackageUpdate);
router.post('/packages/static-ip/:id/delete-queues', postStaticIpPackageDeleteQueues);
// Test route first
router.post('/test-route', (req, res) => {
    console.log('=== TEST ROUTE HIT ===');
    res.json({ message: 'Test route working', timestamp: new Date() });
});

router.post('/packages/static-ip/:id/create-queues', (req, res) => {
    console.log('=== ROUTE HIT ===');
    console.log('Route create-queues hit for ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);

    try {
        postStaticIpPackageCreateQueues(req, res, () => { });
    } catch (error) {
        console.error('Error in create-queues route:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Static IP Client routes
router.get('/packages/static-ip/:packageId/clients', getStaticIpClientList);
router.get('/packages/static-ip/:packageId/clients/add', getStaticIpClientAdd);
router.post('/packages/static-ip/:packageId/clients', postStaticIpClientCreate);
router.post('/packages/static-ip/:packageId/clients/:clientId/delete', postStaticIpClientDelete);
router.get('/packages/static-ip/:packageId/clients/:clientId/edit', getStaticIpClientEdit);
router.post('/packages/static-ip/:packageId/clients/:clientId/edit', postStaticIpClientUpdate);


// Test endpoint untuk debug MikroTik
router.get('/test-mikrotik-ip', testMikrotikIpAdd);

// Auto debug system untuk IP static
router.get('/auto-debug-ip-static', autoDebugIpStatic);

// Debug endpoint untuk test interface dari MikroTik
router.get('/api/debug/interfaces', async (req, res) => {
    try {
        const { getMikrotikConfig } = await import('../services/staticIpPackageService');
        const { getInterfaces } = await import('../services/mikrotikService');

        console.log('=== DEBUG INTERFACE FETCH ===');
        const cfg = await getMikrotikConfig();

        if (!cfg) {
            return res.json({
                success: false,
                error: 'MikroTik config tidak ditemukan',
                message: 'Silakan konfigurasi MikroTik terlebih dahulu di Settings'
            });
        }

        console.log('MikroTik Config:', {
            host: cfg.host,
            port: cfg.port,
            username: cfg.username,
            password: '***'
        });

        const interfaces = await getInterfaces(cfg);

        res.json({
            success: true,
            message: `Berhasil mengambil ${interfaces.length} interfaces`,
            data: {
                config: {
                    host: cfg.host,
                    port: cfg.port,
                    username: cfg.username
                },
                interfaces: interfaces,
                count: interfaces.length,
                interfaceNames: interfaces.map(i => i.name)
            }
        });
    } catch (error: unknown) {
        console.error('Error in debug interfaces:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        res.status(500).json({
            success: false,
            error: errorMessage,
            stack: errorStack
        });
    }
});

// Debug endpoint untuk test queue creation
router.get('/debug-queue-test', async (req, res) => {
    try {
        console.log('=== DEBUG QUEUE TEST ===');
        const cfg = await getMikrotikConfig();
        if (!cfg) {
            return res.json({ error: 'MikroTik config not found' });
        }

        const { RouterOSAPI } = require('routeros-api');
        const api = new RouterOSAPI({
            host: cfg.host,
            port: cfg.port,
            user: cfg.username,
            password: cfg.password,
            timeout: 10000
        });

        await api.connect();
        console.log('Connected to MikroTik for queue test');

        // Test 1: Cek queue yang sudah ada
        console.log('=== CHECKING EXISTING QUEUES ===');
        const existingQueues = await api.write('/queue/tree/print');
        console.log('Existing queues:', existingQueues);

        // Test 2: Coba buat queue dengan parameter minimal
        console.log('=== TESTING MINIMAL QUEUE CREATION ===');
        try {
            const minimalQueue = await api.write('/queue/tree/add', [
                '=name=QUEUE_TES_MINIMAL',
                '=parent=DOWNLOAD ALL',
                '=max-limit=5M',
                '=comment=Test minimal queue'
            ]);
            console.log('✅ Minimal queue created:', minimalQueue);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Minimal queue failed:', errorMessage);
        }

        // Test 3: Coba buat queue dengan packet-marks
        console.log('=== TESTING QUEUE WITH PACKET MARKS ===');
        try {
            const queueWithMarks = await api.write('/queue/tree/add', [
                '=name=QUEUE_TES_MARKS',
                '=parent=DOWNLOAD ALL',
                '=max-limit=5M',
                '=packet-marks=10.11.104.2',
                '=comment=Test queue with marks'
            ]);
            console.log('✅ Queue with marks created:', queueWithMarks);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Queue with marks failed:', errorMessage);
        }

        // Test 4: Coba buat queue dengan limit-at
        console.log('=== TESTING QUEUE WITH LIMIT-AT ===');
        try {
            const queueWithLimit = await api.write('/queue/tree/add', [
                '=name=QUEUE_TES_LIMIT',
                '=parent=DOWNLOAD ALL',
                '=max-limit=5M',
                '=limit-at=1M',
                '=comment=Test queue with limit-at'
            ]);
            console.log('✅ Queue with limit-at created:', queueWithLimit);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Queue with limit-at failed:', errorMessage);
        }

        // Test 5: Coba buat queue dengan priority
        console.log('=== TESTING QUEUE WITH PRIORITY ===');
        try {
            const queueWithPriority = await api.write('/queue/tree/add', [
                '=name=QUEUE_TES_PRIORITY',
                '=parent=DOWNLOAD ALL',
                '=max-limit=5M',
                '=priority=8',
                '=comment=Test queue with priority'
            ]);
            console.log('✅ Queue with priority created:', queueWithPriority);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Queue with priority failed:', errorMessage);
        }

        // Test 6: Coba buat queue dengan semua parameter
        console.log('=== TESTING QUEUE WITH ALL PARAMETERS ===');
        try {
            const queueAllParams = await api.write('/queue/tree/add', [
                '=name=QUEUE_TES_ALL',
                '=parent=DOWNLOAD ALL',
                '=max-limit=5M',
                '=packet-marks=192.168.1.101',
                '=limit-at=1M',
                '=priority=8',
                '=comment=Test queue with all parameters'
            ]);
            console.log('✅ Queue with all parameters created:', queueAllParams);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Queue with all parameters failed:', errorMessage);
        }

        await api.close();
        res.json({
            success: true,
            message: 'Queue debug test completed. Check console for details.'
        });

    } catch (error: unknown) {
        console.error('Queue debug test error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
    }
});


// Pelanggan - routes harus diurutkan dari yang paling spesifik ke yang paling umum
router.get('/customers/list', getCustomerList);
router.get('/customers/', getCustomerList);
router.get('/customers', getCustomerList);
router.get('/customers/export', exportCustomersToExcel);
router.get('/customers/template', getImportTemplate);

// Test import route - INLINE (tidak pakai controller terpisah)
router.get('/test-import', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Import Excel</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .btn { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .btn:hover { background: #45a049; }
        input[type="file"] { margin: 20px 0; padding: 10px; border: 2px solid #ddd; border-radius: 5px; width: 100%; }
        #result { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        pre { background: #f9f9f9; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Test Import Excel</h1>
        <p>Halaman khusus untuk test import - tidak akan merusak sistem utama</p>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>📋 Format Excel:</strong>
            <ul>
                <li>Kolom A1: <strong>Nama</strong></li>
                <li>Kolom B1: <strong>Telepon</strong></li>
                <li>Kolom C1: <strong>Alamat</strong></li>
            </ul>
            <a href="/customers/template" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">📥 Download Template</a>
        </div>
        
        <form id="testForm" enctype="multipart/form-data">
            <input type="file" name="excelFile" accept=".xlsx,.xls" required>
            <button type="submit" class="btn">🚀 Test Import Sekarang</button>
        </form>
        
        <div id="result"></div>
    </div>
    
    <script>
        document.getElementById('testForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const resultDiv = document.getElementById('result');
            
            try {
                const res = await fetch('/test-import', { method: 'POST', body: formData });
                const data = await res.json();
                
                resultDiv.style.display = 'block';
                if (data.success) {
                    resultDiv.className = 'success';
                    resultDiv.innerHTML = '<h3>✅ Import Berhasil!</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
                } else {
                    resultDiv.className = 'error';
                    resultDiv.innerHTML = '<h3>❌ Import Gagal</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
                }
            } catch (err) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'error';
                resultDiv.innerHTML = '<h3>❌ Error</h3><pre>' + err.message + '</pre>';
            }
        };
    </script>
</body>
</html>
    `);
});

router.post('/test-import', upload.single('excelFile'), async (req, res) => {
    try {
        console.log('TEST IMPORT START');

        if (!req.file) {
            return res.json({ success: false, error: 'No file' });
        }

        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        console.log('Rows:', data.length);

        const results = { success: 0, failed: 0, errors: [] };

        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;

            try {
                const name = (row['Nama'] || '').toString().trim();
                const phone = (row['Telepon'] || '').toString().trim();
                const address = (row['Alamat'] || '').toString().trim();

                if (!name) {
                    results.failed++;
                    results.errors.push('Row ' + rowNum + ': Nama kosong');
                    continue;
                }
                if (!phone) {
                    results.failed++;
                    results.errors.push('Row ' + rowNum + ': Telepon kosong');
                    continue;
                }

                const code = 'TEST-' + Date.now() + '-' + i;
                const email = 'test' + Date.now() + i + '@local.id';

                await databasePool.execute(
                    'INSERT INTO customers (customer_code, name, phone, email, address, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
                    [code, name, phone, email, address, 'active']
                );

                results.success++;
            } catch (err: unknown) {
                results.failed++;
                const errorMessage = err instanceof Error ? err.message : String(err);
                results.errors.push('Row ' + rowNum + ': ' + errorMessage);
            }
        }

        console.log('TEST IMPORT DONE:', results);
        res.json({ success: true, results });

    } catch (error: unknown) {
        console.error('TEST IMPORT ERROR:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.json({ success: false, error: errorMessage });
    }
});

router.post('/customers/import', (req, res, next) => {
    console.log('📥 Import request received');
    console.log('Content-Type:', req.headers['content-type']);

    upload.single('excelFile')(req, res, (err) => {
        if (err) {
            console.error('❌ Multer error:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'File terlalu besar. Maksimal 10MB'
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: 'Error upload file: ' + err.message
                });
            }
            return res.status(400).json({
                success: false,
                error: err.message || 'Error upload file'
            });
        }

        console.log('✅ File upload OK');
        console.log('File info:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : 'No file');

        importCustomersFromExcel(req, res).catch(err => {
            console.error('❌ Import controller error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error: ' + err.message
            });
        });
    });
});
router.get('/customers/new-pppoe', async (req, res) => {
    try {
        console.log('Starting new-pppoe route...');

        const packages = await listPppoePackages();
        console.log('Packages loaded:', packages.length);

        const profiles = await listPppoeProfiles();
        console.log('Profiles loaded:', profiles.length);

        const conn = await databasePool.getConnection();
        try {
            // Get ODC list for dropdown
            const [odcRows] = await conn.query(`
                SELECT id, name FROM ftth_odc ORDER BY name
            `);

            // Get ODP list for dropdown
            const [odpRows] = await conn.query(`
                SELECT 
                    o.id, 
                    o.name as odp_name,
                    o.odc_id,
                    odc.name as odc_name,
                    odc.olt_id,
                    olt.name as olt_name
                FROM ftth_odp o
                LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
                LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                ORDER BY o.name
            `);

            // Generate customer code dengan format YYYYMMDDHHMMSS
            const initial_customer_code = CustomerIdGenerator.generateCustomerId();

            console.log('Generated customer code:', initial_customer_code);
            console.log('ODP Data for PPPOE:', odpRows);

            res.render('customers/new_pppoe', {
                title: 'Pelanggan PPPOE Baru',
                packages,
                profiles,
                odcList: odcRows,
                odpData: odpRows,
                initial_customer_code,
                error: req.query.error || null
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error in new-pppoe route:', error);
        res.status(500).send('Internal Server Error: ' + error.message);
    }
});

router.get('/customers/new-static-ip', async (req, res) => {
    const packages = await listStaticIpPackages();
    const cfg = await getMikrotikConfig();

    // Generate customer code dengan format YYYYMMDDHHMMSS
    const initial_customer_code = CustomerIdGenerator.generateCustomerId();

    // Generate current timestamp for default values
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');

    const conn = await databasePool.getConnection();
    try {

        // Get ODP data
        const [odpRows] = await conn.execute(`
            SELECT 
                o.id, 
                o.name as odp_name,
                o.odc_id,
                odc.name as odc_name,
                odc.olt_id,
                olt.name as olt_name
            FROM ftth_odp o
            LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
            LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
            ORDER BY o.name
        `);

        // Get interfaces from MikroTik
        const interfaces = cfg ? await getInterfaces(cfg) : [];

        res.render('customers/new_static_ip', {
            title: 'Pelanggan IP Statis Baru',
            packages,
            mikrotikConfig: cfg,
            interfaces,
            odpData: odpRows,
            initial_customer_code,
            timestamp,
            error: req.query.error || null
        });
    } finally {
        conn.release();
    }
});

// POST route untuk form new-pppoe - HARUS SEBELUM route dengan parameter
router.post('/customers/new-pppoe', async (req, res) => {
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('=== ROUTE HIT: POST /customers/new-pppoe ===');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    try {
        console.log('=== NEW PPPOE CLIENT REQUEST ===');
        console.log('ODP ID from request:', req.body.odp_id);
        console.log('ODC ID from request:', req.body.odc_id);
        console.log('OLT ID from request:', req.body.olt_id);
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);

        const {
            customer_code,
            client_name,
            username,
            password,
            package_id,
            address,
            phone_number,
            latitude,
            longitude,
            olt_id,
            odc_id,
            odp_id,
            enable_billing
        } = req.body;

        console.log('Parsed data:', {
            customer_code,
            client_name,
            username,
            package_id
        });

        // Validasi input
        if (!client_name) throw new Error('Nama pelanggan wajib diisi');
        if (!username) throw new Error('Username PPPOE wajib diisi');
        if (!password) throw new Error('Password PPPOE wajib diisi');
        if (!package_id) throw new Error('Paket wajib dipilih');
        if (!odp_id) throw new Error('ODP wajib dipilih');

        // Validate customer_code
        if (!customer_code || customer_code.trim() === '') {
            throw new Error('Kode pelanggan tidak boleh kosong');
        }

        // Simpan ke database
        const conn = await databasePool.getConnection();
        try {
            // Start transaction explicitly
            await conn.beginTransaction();
            // Check if customer_code already exists
            const [existingCodeRows] = await conn.execute(
                'SELECT id, name FROM customers WHERE customer_code = ?',
                [customer_code.trim()]
            );

            if (Array.isArray(existingCodeRows) && existingCodeRows.length > 0) {
                const existingCustomer = (existingCodeRows as any)[0];
                throw new Error(`Kode pelanggan "${customer_code}" sudah digunakan oleh pelanggan "${existingCustomer.name}"`);
            }

            // Insert customer (pppoe_username will be set to customer ID after insert)
            const insertQuery = `
                INSERT INTO customers (
                    customer_code, name, phone, email, address, odc_id, odp_id,
                    connection_type, status, latitude, longitude,
                    pppoe_username, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pppoe', 'active', ?, ?, NULL, NOW(), NOW())
            `;

            console.log('Inserting customer with data:', {
                customer_code,
                client_name,
                phone_number,
                address,
                odc_id,
                odp_id,
                latitude,
                longitude
            });

            const [result] = await conn.execute(insertQuery, [
                customer_code, client_name, phone_number || null, null, address || null,
                odc_id || null, odp_id, latitude || null, longitude || null
            ]);

            console.log('Insert result:', result);
            const customerId = (result as any)?.insertId;

            // Validate customerId exists
            if (!customerId || isNaN(Number(customerId))) {
                console.error('❌ Invalid customerId from insert:', customerId);
                console.error('❌ Insert result:', JSON.stringify(result, null, 2));
                throw new Error('Gagal menyimpan pelanggan: ID tidak valid');
            }

            console.log('✅ PPPOE customer saved successfully with ID:', customerId);
            console.log('📱 Customer phone number:', phone_number || 'NOT SET');
            console.log('📱 Phone number trimmed:', phone_number ? phone_number.trim() : 'EMPTY');

            // Update pppoe_username to customer ID (within same transaction)
            await conn.execute(
                'UPDATE customers SET pppoe_username = ? WHERE id = ?',
                [customerId.toString(), customerId]
            );
            console.log('✅ Updated pppoe_username to customer ID');

            // Sync secret ke MikroTik - Name = Customer ID, Comment = Customer Name
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🔄 ========== MULAI SYNC SECRET KE MIKROTIK ==========');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('   Customer ID:', customerId);
            console.log('   Secret name (Customer ID):', customerId.toString());
            console.log('   Customer name:', client_name);
            console.log('   Password provided:', password ? 'YES' : 'NO');

            try {
                console.log('   Step 1: Import services...');
                const { getMikrotikConfig } = await import('../services/pppoeService');
                const { createPppoeSecret, findPppoeSecretIdByName, updatePppoeSecret } = await import('../services/mikrotikService');
                console.log('   ✅ Services imported');

                console.log('   Step 2: Get MikroTik config...');
                const config = await getMikrotikConfig();
                if (!config) {
                    console.error('   ❌ MikroTik config tidak ditemukan, skip sync secret');
                } else {
                    console.log('   ✅ MikroTik config ditemukan:', {
                        host: config.host,
                        port: config.port,
                        username: config.username
                    });

                    // Get package untuk profile
                    let profileName = 'GRATIS'; // Default ke 'GRATIS' (uppercase)
                    try {
                        console.log('   Step 3: Get package info...');
                        const { getPackageById } = await import('../services/pppoeService');
                        const pkg = await getPackageById(Number(package_id));
                        profileName = pkg?.profile_name || 'GRATIS';
                        console.log('   ✅ Profile name dari package:', profileName);
                    } catch (pkgError: any) {
                        console.error('   ⚠️ Gagal mendapatkan package:', pkgError.message);
                        console.error('   ⚠️ Akan menggunakan profile default: GRATIS');
                    }

                    // Cek apakah profile ada di MikroTik
                    console.log('   Step 3.5: Cek profile di MikroTik...');
                    try {
                        const { getPppProfiles } = await import('../services/mikrotikService');
                        const profiles = await getPppProfiles(config);
                        const profileNames = profiles.map(p => p.name);
                        console.log('   📋 Profile yang tersedia di MikroTik:', profileNames);

                        // Cek apakah profile ada (case-insensitive)
                        const profileExists = profileNames.some(p => p.toLowerCase() === profileName.toLowerCase());
                        if (!profileExists) {
                            console.warn(`   ⚠️ Profile "${profileName}" tidak ditemukan di MikroTik!`);
                            console.warn(`   ⚠️ Akan mencoba tanpa profile atau gunakan profile pertama yang tersedia`);

                            // Coba cari profile yang mirip
                            const similarProfile = profileNames.find(p =>
                                p.toLowerCase().includes('gratis') ||
                                p.toLowerCase().includes('free') ||
                                p.toLowerCase() === 'default'
                            );

                            if (similarProfile) {
                                console.log(`   ✅ Menggunakan profile alternatif: "${similarProfile}"`);
                                profileName = similarProfile;
                            } else if (profileNames.length > 0) {
                                console.log(`   ⚠️ Menggunakan profile pertama yang tersedia: "${profileNames[0]}"`);
                                profileName = profileNames[0];
                            } else {
                                console.warn(`   ❌ Tidak ada profile tersedia, akan membuat secret tanpa profile`);
                                profileName = ''; // Kosongkan untuk tidak set profile
                            }
                        } else {
                            // Gunakan nama profile yang tepat dari MikroTik (case-sensitive)
                            const exactProfile = profileNames.find(p => p.toLowerCase() === profileName.toLowerCase());
                            if (exactProfile) {
                                profileName = exactProfile;
                            }
                            console.log(`   ✅ Profile "${profileName}" ditemukan di MikroTik`);
                        }
                    } catch (profileError: any) {
                        console.error('   ⚠️ Error saat cek profile:', profileError.message);
                        console.error('   ⚠️ Akan lanjut tanpa cek profile');
                    }

                    // Use customer ID as the name for PPPoE secret
                    const secretName = customerId.toString();

                    // Cek apakah secret sudah ada dengan customer ID
                    console.log('   Step 4: Cek apakah secret sudah ada...');
                    let existingSecretId = null;
                    try {
                        existingSecretId = await findPppoeSecretIdByName(config, secretName);
                        if (existingSecretId) {
                            console.log('   ✅ Secret sudah ada dengan ID:', existingSecretId);
                        } else {
                            console.log('   ℹ️ Secret belum ada, akan dibuat baru');
                        }
                    } catch (findError: any) {
                        // Ignore error, secret doesn't exist
                        console.log('   ℹ️ Secret belum ada, akan dibuat baru');
                    }

                    if (existingSecretId) {
                        console.log('   Step 5: Update secret yang sudah ada...');
                        try {
                            await updatePppoeSecret(config, secretName, {
                                name: secretName, // Use customer ID as name
                                password: password,
                                profile: profileName,
                                comment: client_name // Use customer name as comment
                            });
                            console.log(`   ✅ PPPoE secret dengan ID "${secretName}" berhasil di-update di MikroTik`);
                        } catch (updateError: any) {
                            console.error('   ❌ Error saat update secret:', updateError.message);
                            throw updateError;
                        }
                    } else {
                        console.log('   Step 5: Create secret baru...');
                        console.log('   📤 Data yang akan dikirim:', {
                            name: secretName, // Customer ID
                            password: password ? '***' : 'NOT SET',
                            profile: profileName,
                            comment: client_name // Customer name
                        });

                        try {
                            await createPppoeSecret(config, {
                                name: secretName, // Use customer ID as name
                                password: password,
                                profile: profileName,
                                comment: client_name // Use customer name as comment
                            });
                            console.log(`   ✅ PPPoE secret dengan ID "${secretName}" berhasil dibuat di MikroTik`);
                        } catch (createError: any) {
                            console.error('   ❌ Error saat create secret:');
                            console.error('      Error message:', createError.message);
                            console.error('      Error code:', createError.code);
                            console.error('      Error name:', createError.name);
                            console.error('      Error stack:', createError.stack);
                            throw createError;
                        }
                    }
                }
                console.log('✅ ========== SYNC SECRET SELESAI ==========');
            } catch (mikrotikError: any) {
                console.error('❌ ========== ERROR SYNC SECRET KE MIKROTIK ==========');
                console.error('   Error type:', typeof mikrotikError);
                console.error('   Error message:', mikrotikError?.message || 'NO MESSAGE');
                console.error('   Error code:', mikrotikError?.code || 'N/A');
                console.error('   Error name:', mikrotikError?.name || 'N/A');
                console.error('   Error stack:', mikrotikError?.stack || 'NO STACK');
                console.error('   Customer ID:', customerId);
                console.error('   Secret name (Customer ID):', customerId.toString());
                console.error('   Profile name:', profileName);

                // Log error detail untuk debugging
                if (mikrotikError?.response) {
                    console.error('   Error response:', mikrotikError.response);
                }
                if (mikrotikError?.request) {
                    console.error('   Error request:', mikrotikError.request);
                }

                // Log full error object untuk debugging
                try {
                    console.error('   Full error object:', JSON.stringify(mikrotikError, Object.getOwnPropertyNames(mikrotikError), 2));
                } catch (stringifyError) {
                    console.error('   Cannot stringify error object:', stringifyError);
                }

                console.error('❌ ========== END ERROR SYNC SECRET ==========');

                // Non-critical error - customer created successfully
                // Tapi kita log dengan detail untuk debugging
            }

            // Create subscription if enable_billing is checked
            const enableBilling = enable_billing === '1' || enable_billing === 'on';
            if (enableBilling && package_id) {
                try {
                    const { getPackageById } = await import('../services/pppoeService');
                    const pkg = await getPackageById(Number(package_id));

                    if (pkg) {
                        const registrationDate = new Date();
                        const startDate = registrationDate.toISOString().slice(0, 10);
                        const endDate = new Date(registrationDate);
                        endDate.setDate(endDate.getDate() + (pkg.duration_days || 30));
                        const endDateStr = endDate.toISOString().slice(0, 10);

                        // Insert subscription
                        const [subResult] = await conn.execute(`
                            INSERT INTO subscriptions (
                                customer_id, 
                                package_id,
                                package_name, 
                                price, 
                                start_date, 
                                end_date, 
                                status,
                                created_at,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
                        `, [
                            customerId,
                            package_id,
                            pkg.name,
                            pkg.price,
                            startDate,
                            endDateStr
                        ]);

                        console.log('✅ Subscription created for customer:', customerId);
                        console.log(`   Package: ${pkg.name}, Price: Rp ${pkg.price}, Start: ${startDate}`);
                    } else {
                        console.warn('⚠️ Package not found for ID:', package_id);
                    }
                } catch (subError) {
                    console.error('❌ Failed to create subscription:', subError);
                    // Non-critical error - customer created successfully
                }
            }

            // Commit transaction before sending welcome message
            await conn.commit();
            console.log('✅ Database transaction committed successfully');

            // Send notification to customer and admin (non-blocking)
            console.log('📧 [NOTIFICATION] Starting notification process for customer:', customerId);
            try {
                const CustomerNotificationService = (await import('../services/customer/CustomerNotificationService')).default;
                const [packageRows] = await databasePool.query<RowDataPacket[]>(
                    'SELECT name FROM pppoe_packages WHERE id = ?',
                    [package_id]
                );
                const packageName = packageRows.length > 0 ? packageRows[0].name : undefined;

                console.log('📧 [NOTIFICATION] Calling notifyNewCustomer with data:', {
                    customerId,
                    customerName: client_name,
                    customerCode: customer_code,
                    phone: phone_number || 'N/A',
                    connectionType: 'pppoe',
                    packageName: packageName || 'N/A'
                });

                const result = await CustomerNotificationService.notifyNewCustomer({
                    customerId: customerId,
                    customerName: client_name,
                    customerCode: customer_code,
                    phone: phone_number || undefined,
                    connectionType: 'pppoe',
                    address: address || undefined,
                    packageName: packageName,
                    createdBy: (req.session as any).user?.username || undefined
                });

                console.log('📧 [NOTIFICATION] notifyNewCustomer result:', result);

                if (result.customer.success) {
                    console.log('✅ Customer notification sent successfully');
                } else {
                    console.error('❌ Customer notification failed:', result.customer.message);
                }

                if (result.admin.success) {
                    console.log('✅ Admin notification sent successfully');
                } else {
                    console.error('❌ Admin notification failed:', result.admin.message);
                }
            } catch (notifError: any) {
                console.error('❌ [NOTIFICATION] Exception in notification process:', {
                    message: notifError.message,
                    stack: notifError.stack,
                    customerId: customerId
                });
                // Non-critical, don't block customer creation
            }

            // Redirect ke halaman sukses atau list pelanggan
            res.redirect('/customers/list?success=pppoe_customer_created');
        } catch (dbError) {
            // Rollback transaction on error
            await conn.rollback();
            throw dbError;
        } finally {
            conn.release();
        }

    } catch (error: unknown) {
        console.error('Error creating PPPOE customer:', error);

        // Redirect kembali ke form dengan error
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.redirect('/customers/new-pppoe?error=' + encodeURIComponent(errorMessage));
    }
});

// TEST ENDPOINT: Debug create secret PPPoE
router.get('/test/debug-create-secret', async (req: Request, res: Response) => {
    try {
        const testName = req.query.name as string || 'testuser';
        const testPassword = req.query.password as string || 'test123';
        const testProfile = req.query.profile as string || 'gratis';

        console.log('\n\n═══════════════════════════════════════════════════════════');
        console.log('=== DEBUG CREATE SECRET ===');
        console.log('═══════════════════════════════════════════════════════════');

        const { getMikrotikConfig } = await import('../services/pppoeService');
        const { createPppoeSecret, findPppoeSecretIdByName } = await import('../services/mikrotikService');

        const config = await getMikrotikConfig();
        if (!config) {
            return res.json({ success: false, error: 'MikroTik config tidak ditemukan' });
        }

        console.log('Config:', { host: config.host, port: config.port, username: config.username });

        // Test create
        try {
            console.log('Creating secret...');
            await createPppoeSecret(config, {
                name: testName,
                password: testPassword,
                profile: testProfile,
                comment: 'Test secret'
            });

            // Verify
            await new Promise(resolve => setTimeout(resolve, 1000));
            const secretId = await findPppoeSecretIdByName(config, testName);

            res.json({
                success: true,
                message: 'Secret created successfully',
                secretId: secretId,
                testData: { name: testName, profile: testProfile }
            });
        } catch (error: any) {
            console.error('Error:', error);
            res.json({
                success: false,
                error: error.message,
                stack: error.stack
            });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Routes dengan parameter harus di bawah routes yang lebih spesifik
// Pindahkan ke bawah setelah semua route spesifik
router.post('/customers/bulk-delete', async (req, res, next) => {
    try {
        const { bulkDeleteCustomers } = await import('../controllers/customerController');
        return bulkDeleteCustomers(req as any, res as any);
    } catch (e) {
        next(e);
    }
});

// Edit pelanggan IP static
router.get('/customers/edit-static-ip/:id', async (req, res) => {
    try {
        const clientId = Number(req.params.id);
        const client = await getClientById(clientId);
        if (!client) {
            req.flash('error', 'Pelanggan tidak ditemukan');
            return res.redirect('/packages/static-ip/clients');
        }

        const pkg = await getStaticIpPackageById(client.package_id);
        if (!pkg) {
            req.flash('error', 'Paket tidak ditemukan');
            return res.redirect('/packages/static-ip/clients');
        }

        const cfg = await getMikrotikConfig();
        const interfaces = cfg ? await getInterfaces(cfg) : [];

        // Get ODP data with OLT and ODC info
        const conn = await databasePool.getConnection();
        try {
            const [odpRows] = await conn.execute(`
                SELECT 
                    o.id, 
                    o.name as odp_name,
                    o.odc_id,
                    odc.olt_id,
                    olt.name as olt_name,
                    odc.name as odc_name
                FROM ftth_odp o
                LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
                LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                ORDER BY o.name
            `);

            res.render('customers/edit_static_ip', {
                title: 'Edit Pelanggan IP Static',
                client,
                package: pkg,
                interfaces,
                odpData: odpRows,
                success: req.flash('success'),
                error: req.flash('error')
            });
        } finally {
            conn.release();
        }
    } catch (err) {
        req.flash('error', 'Gagal memuat data pelanggan');
        res.redirect('/packages/static-ip/clients');
    }
});

router.post('/customers/edit-static-ip/:id', async (req, res) => {
    try {
        const clientId = Number(req.params.id);
        const {
            client_name,
            ip_address,
            interface: iface,
            address,
            phone_number,
            latitude,
            longitude,
            olt_id,
            odc_id,
            odp_id
        } = req.body;

        if (!client_name) throw new Error('Nama pelanggan wajib diisi');
        if (!ip_address) throw new Error('IP statis wajib diisi');

        // Validasi format IP CIDR
        const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[12][0-9]|3[0-2]))$/;
        if (!cidrRegex.test(ip_address)) throw new Error('Format IP CIDR tidak valid');

        // Ambil data lama untuk sinkronisasi Mikrotik
        const oldClient = await getClientById(clientId);
        const pkg = await getStaticIpPackageById(oldClient.package_id);
        const cfg = await getMikrotikConfig();

        if (cfg && pkg && oldClient) {
            // 1) Hapus resource lama (IP, mangle, queues)
            if (oldClient.ip_address) {
                await removeIpAddress(cfg, oldClient.ip_address);
            }

            // Hapus mangle rules lama
            const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
            const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
            const [ipOnlyRaw, prefixStrRaw] = String(oldClient.ip_address || '').split('/');
            const ipOnly: string = ipOnlyRaw || '';
            const prefix: number = Number(prefixStrRaw || '0');
            const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
            const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
            let peerIp = ipOnly;
            if (prefix === 30) {
                const firstHost = networkInt + 1;
                const secondHost = networkInt + 2;
                const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
                peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
            }
            const downloadMark: string = peerIp;
            const uploadMark: string = `UP-${peerIp}`;
            await removeMangleRulesForClient(cfg, { peerIp, downloadMark, uploadMark });

            // Hapus queues lama
            await deleteClientQueuesByClientName(cfg, oldClient.client_name);

            // 2) Tambahkan resource baru sesuai input
            if (iface) {
                await addIpAddress(cfg, {
                    interface: iface,
                    address: ip_address,
                    comment: client_name
                });
            }

            // Tambah mangle rules baru
            const [newIpOnly, newPrefixStr] = ip_address.split('/');
            const newPrefix = Number(newPrefixStr);
            const newMask = newPrefix === 0 ? 0 : (0xFFFFFFFF << (32 - newPrefix)) >>> 0;
            const newNetworkInt = ipToInt(newIpOnly) & newMask;
            let newPeerIp = newIpOnly;
            if (newPrefix === 30) {
                const firstHost = newNetworkInt + 1;
                const secondHost = newNetworkInt + 2;
                const ipInt = ipToInt(newIpOnly);
                newPeerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
            }
            const newDownloadMark: string = newPeerIp;
            const newUploadMark: string = `UP-${newPeerIp}`;
            await addMangleRulesForClient(cfg, { peerIp: newPeerIp, downloadMark: newDownloadMark, uploadMark: newUploadMark });

            const mlDownload = (pkg as any).child_download_limit || (pkg as any).shared_download_limit || pkg.max_limit_download;
            const mlUpload = (pkg as any).child_upload_limit || (pkg as any).shared_upload_limit || pkg.max_limit_upload;

            const packageDownloadQueue = pkg.name;
            const packageUploadQueue = `UP-${pkg.name}`;

            await createQueueTree(cfg, {
                name: client_name,
                parent: packageDownloadQueue,
                packetMarks: newDownloadMark,
                maxLimit: mlDownload,
                queue: (pkg as any).child_queue_type_download || 'pcq-download-default',
                priority: (pkg as any).child_priority_download || '8'
            });
            await createQueueTree(cfg, {
                name: `UP-${client_name}`,
                parent: packageUploadQueue,
                packetMarks: newUploadMark,
                maxLimit: mlUpload,
                queue: (pkg as any).child_queue_type_upload || 'pcq-upload-default',
                priority: (pkg as any).child_priority_upload || '8'
            });
        }

        // Update database
        await updateClient(clientId, {
            client_name,
            ip_address,
            interface: iface || null,
            address: address || null,
            phone_number: phone_number || null,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            olt_id: olt_id ? Number(olt_id) : null,
            odc_id: odc_id ? Number(odc_id) : null,
            odp_id: odp_id ? Number(odp_id) : null
        });
        req.flash('success', 'Pelanggan berhasil diperbarui');
        res.redirect('/packages/static-ip/clients');

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Gagal memperbarui pelanggan';
        req.flash('error', errorMessage);
        res.redirect(`/customers/edit-static-ip/${req.params.id}`);
    }
});
import { listStaticIpPackages } from '../services/staticIpPackageService';
import { getMikrotikConfig, getStaticIpPackageById } from '../services/staticIpPackageService';
import { getInterfaces, addMangleRulesForClient, createClientQueues, addIpAddress, removeIpAddress, removeMangleRulesForClient, deleteClientQueuesByClientName, createQueueTree } from '../services/mikrotikService';
import { getPppoeSecrets } from '../services/mikrotikService';
import { addClientToPackage, isPackageFull, getClientById, updateClient } from '../services/staticIpClientService';
import { listPackages as listPppoePackages, listProfiles as listPppoeProfiles } from '../services/pppoeService';

// API endpoint untuk mengambil paket berdasarkan tipe koneksi
router.get('/api/packages/:connectionType', async (req, res) => {
    try {
        const { connectionType } = req.params;

        if (connectionType === 'pppoe') {
            const packages = await listPppoePackages();
            res.json(packages);
        } else if (connectionType === 'static_ip') {
            const packages = await listStaticIpPackages();
            res.json(packages);
        } else {
            res.status(400).json({ error: 'Invalid connection type' });
        }
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

// ============================================
// API Routes - Must be before generic routes
// ============================================

// API: Ambil daftar PPPoE secrets untuk pemilihan username/password pada edit pelanggan
router.get('/api/pppoe/secrets', async (req, res) => {
    try {
        const cfg = await getMikrotikConfig();
        if (!cfg) {
            console.warn('PPPoE secrets requested but MikroTik config is missing');
            return res.json([]);
        }
        const secrets = await getPppoeSecrets(cfg);

        // Get all used usernames from database
        const [usedRows] = await databasePool.execute(
            'SELECT DISTINCT pppoe_username FROM customers WHERE pppoe_username IS NOT NULL AND pppoe_username != ""'
        );
        const usedUsernames = new Set((usedRows as any[]).map(r => r.pppoe_username));

        // Normalisasi struktur minimal yang dibutuhkan: name, password, profile (opsional)
        // Only return usernames NOT in the database
        const data = (secrets || [])
            .map((s: any) => ({
                id: s['.id'] || '',
                name: s.name || '',
                password: s.password || '',
                profile: s.profile || ''
            }))
            .filter(item => !usedUsernames.has(item.name)); // Filter out already used usernames

        res.json(data);
    } catch (e: unknown) {
        console.error('Error fetching PPPoE secrets:', e);
        // Kembalikan array kosong agar UI tetap bisa jalan sambil menampilkan pesan
        res.json([]);
    }
});

// API endpoint untuk create/update PPPoE secret - MOVED TO TOP OF FILE (line ~255)
// This route is now registered early to avoid conflicts
// DUPLICATE ROUTE - REMOVED FROM HERE

router.post('/customers/new-static-ip', async (req, res) => {
    console.log('=== ROUTE HIT: POST /customers/new-static-ip ===');
    try {
        console.log('=== NEW STATIC IP CLIENT REQUEST ===');
        console.log('Request body:', req.body);
        const {
            client_name,
            customer_code,
            ip_address,
            package_id,
            interface: iface,
            address,
            phone_number,
            latitude,
            longitude,
            olt_id,
            odc_id,
            odp_id,
            enable_billing
        } = req.body;
        console.log('Parsed data:', { client_name, customer_code, ip_address, package_id, interface: iface });

        if (!client_name) throw new Error('Nama pelanggan wajib diisi');
        if (!ip_address) throw new Error('IP statis wajib diisi (contoh: 192.168.1.1/30)');
        if (!package_id) throw new Error('Paket wajib dipilih');

        // Validate customer_code if provided
        if (customer_code && customer_code.trim() !== '') {
            const conn = await databasePool.getConnection();
            try {
                const [existingCodeRows] = await conn.execute(
                    'SELECT id, name FROM customers WHERE customer_code = ?',
                    [customer_code.trim()]
                );

                if (Array.isArray(existingCodeRows) && existingCodeRows.length > 0) {
                    const existingCustomer = (existingCodeRows as any)[0];
                    throw new Error(`Kode pelanggan "${customer_code}" sudah digunakan oleh pelanggan "${existingCustomer.name}"`);
                }
            } finally {
                conn.release();
            }
        }

        const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[12][0-9]|3[0-2]))$/;
        if (!cidrRegex.test(ip_address)) throw new Error('Format IP CIDR tidak valid');
        const pkgId = Number(package_id);
        const full = await isPackageFull(pkgId);
        if (full) throw new Error('Paket sudah penuh');
        // Hitung network dari CIDR
        function ipToInt(ip) { return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0 }
        function intToIp(int) { return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.') }
        const [ipOnly, prefixStr] = ip_address.split('/');
        const prefix = Number(prefixStr);
        const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const networkInt = ipToInt(ipOnly) & mask;
        const network = intToIp(networkInt);
        // Compute peer IP for /30: other usable host within subnet
        let peerIp = ipOnly;
        if (prefix === 30) {
            const firstHost = networkInt + 1;
            const secondHost = networkInt + 2;
            const ipInt = ipToInt(ipOnly);
            if (ipInt === firstHost) peerIp = intToIp(secondHost);
            else if (ipInt === secondHost) peerIp = intToIp(firstHost);
            else peerIp = intToIp(secondHost); // fallback
        }
        const { customerId } = await addClientToPackage(pkgId, {
            client_name,
            ip_address,
            network,
            interface: iface || null,
            customer_code: customer_code || null,
            address: address || null,
            phone_number: phone_number || null,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            olt_id: olt_id ? Number(olt_id) : null,
            odc_id: odc_id ? Number(odc_id) : null,
            odp_id: odp_id ? Number(odp_id) : null
        });
        // MikroTik: tambah IP address, mangle + child queues
        const cfg = await getMikrotikConfig();
        const pkg = await getStaticIpPackageById(pkgId);
        console.log('=== MIKROTIK PROVISIONING FOR NEW CLIENT ===');
        console.log('MikroTik config available:', !!cfg);
        console.log('Package found:', !!pkg);
        console.log('Interface:', iface);
        console.log('IP Address:', ip_address);
        console.log('Client Name:', client_name);

        if (cfg && pkg) {
            try {
                // 1) Tambah IP address ke interface
                if (iface) {
                    console.log('Adding IP address to MikroTik...');
                    await addIpAddress(cfg, {
                        interface: iface,
                        address: ip_address,
                        comment: client_name
                    });
                    console.log('IP address added successfully');
                } else {
                    console.log('No interface specified, skipping IP address addition');
                }
            } catch (error: unknown) {
                console.error('Failed to add IP address:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Gagal menambahkan IP ke MikroTik: ${errorMessage}`);
            }

            const downloadMark = peerIp;
            const uploadMark = `UP-${peerIp}`;
            await addMangleRulesForClient(cfg, { peerIp, downloadMark, uploadMark });
            // Ambil konfigurasi aneka parameter dari form (optional)
            const {
                qtype_download,
                qtype_upload,
                priority_download,
                priority_upload,
                limitat_download,
                limitat_upload,
                maxlimit_download,
                maxlimit_upload,
                burst_enabled,
                burst_limit_download,
                burst_limit_upload,
                burst_threshold_download,
                burst_threshold_upload,
                burst_time_download,
                burst_time_upload
            } = req.body as any;

            const qDownload = qtype_download || pkg.child_queue_type_download || 'pcq-download-default';
            const qUpload = qtype_upload || pkg.child_queue_type_upload || 'pcq-upload-default';
            const pDownload = priority_download || pkg.child_priority_download || '8';
            const pUpload = priority_upload || pkg.child_priority_upload || '8';
            const laDownload = limitat_download || pkg.child_limit_at_download || '';
            const laUpload = limitat_upload || pkg.child_limit_at_upload || '';
            const mlDownload = maxlimit_download || (pkg.child_download_limit || (pkg as any).shared_download_limit || pkg.max_limit_download);
            const mlUpload = maxlimit_upload || (pkg.child_upload_limit || (pkg as any).shared_upload_limit || pkg.max_limit_upload);

            const useBurst = String(burst_enabled || 'off') === 'on';
            const blDownload = burst_limit_download || pkg.child_burst_download || '';
            const blUpload = burst_limit_upload || pkg.child_burst_upload || '';
            const btDownload = burst_threshold_download || pkg.child_burst_threshold_download || '';
            const btUpload = burst_threshold_upload || pkg.child_burst_threshold_upload || '';
            const btimeDownload = burst_time_download || pkg.child_burst_time_download || '';
            const btimeUpload = burst_time_upload || pkg.child_burst_time_upload || '';

            const packageDownloadQueue = pkg.name;
            const packageUploadQueue = `UP-${pkg.name}`;

            await createQueueTree(cfg, {
                name: client_name,
                parent: packageDownloadQueue,
                packetMarks: downloadMark,
                limitAt: laDownload,
                maxLimit: mlDownload,
                queue: qDownload,
                priority: pDownload,
                ...(useBurst ? { burstLimit: blDownload, burstThreshold: btDownload, burstTime: btimeDownload } : {})
            });
            await createQueueTree(cfg, {
                name: `UP-${client_name}`,
                parent: packageUploadQueue,
                packetMarks: uploadMark,
                limitAt: laUpload,
                maxLimit: mlUpload,
                queue: qUpload,
                priority: pUpload,
                ...(useBurst ? { burstLimit: blUpload, burstThreshold: btUpload, burstTime: btimeUpload } : {})
            });
        }

        // Create subscription if enable_billing is checked
        const enableBilling = enable_billing === '1' || enable_billing === 'on';
        if (enableBilling && package_id) {
            try {
                const pkg = await getStaticIpPackageById(pkgId);

                if (pkg) {
                    const registrationDate = new Date();
                    const startDate = registrationDate.toISOString().slice(0, 10);
                    const endDate = new Date(registrationDate);
                    endDate.setDate(endDate.getDate() + (pkg.duration_days || 30));
                    const endDateStr = endDate.toISOString().slice(0, 10);

                    // Get database connection for subscription
                    const conn2 = await databasePool.getConnection();
                    try {
                        // Insert subscription
                        const [subResult] = await conn2.execute(`
                            INSERT INTO subscriptions (
                                customer_id, 
                                package_id,
                                package_name, 
                                price, 
                                start_date, 
                                end_date, 
                                status,
                                created_at,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
                        `, [
                            customerId,
                            package_id,
                            pkg.name,
                            pkg.price,
                            startDate,
                            endDateStr
                        ]);

                        console.log('✅ Subscription created for customer:', customerId);
                        console.log(`   Package: ${pkg.name}, Price: Rp ${pkg.price}, Start: ${startDate}`);
                    } finally {
                        conn2.release();
                    }
                } else {
                    console.warn('⚠️ Package not found for ID:', package_id);
                }
            } catch (subError) {
                console.error('❌ Failed to create subscription:', subError);
                // Non-critical error - customer created successfully
            }
        }


        console.log('Static IP customer saved successfully');

        // Send notification to customer and admin (non-blocking)
        console.log('📧 [NOTIFICATION] Starting notification process for customer:', customerId);
        try {
            const CustomerNotificationService = (await import('../services/customer/CustomerNotificationService')).default;
            const [packageRows] = await databasePool.query<RowDataPacket[]>(
                'SELECT name FROM static_ip_packages WHERE id = ?',
                [package_id]
            );
            const packageName = packageRows.length > 0 ? packageRows[0].name : undefined;

            // Get customer code
            const [customerRows] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_code, name, phone, address FROM customers WHERE id = ?',
                [customerId]
            );
            const customer = customerRows.length > 0 ? customerRows[0] : null;

            if (customer) {
                console.log('📧 [NOTIFICATION] Calling notifyNewCustomer with data:', {
                    customerId,
                    customerName: customer.name,
                    customerCode: customer.customer_code || 'N/A',
                    phone: customer.phone || 'N/A',
                    connectionType: 'static_ip',
                    packageName: packageName || 'N/A'
                });

                const result = await CustomerNotificationService.notifyNewCustomer({
                    customerId: customerId,
                    customerName: customer.name,
                    customerCode: customer.customer_code || '',
                    phone: customer.phone || undefined,
                    connectionType: 'static_ip',
                    address: customer.address || undefined,
                    packageName: packageName,
                    createdBy: (req.session as any).user?.username || undefined
                });

                console.log('📧 [NOTIFICATION] notifyNewCustomer result:', result);

                if (result.customer.success) {
                    console.log('✅ Customer notification sent successfully');
                } else {
                    console.error('❌ Customer notification failed:', result.customer.message);
                }

                if (result.admin.success) {
                    console.log('✅ Admin notification sent successfully');
                } else {
                    console.error('❌ Admin notification failed:', result.admin.message);
                }
            } else {
                console.error('❌ [NOTIFICATION] Customer not found for ID:', customerId);
            }
        } catch (notifError: any) {
            console.error('❌ [NOTIFICATION] Exception in notification process:', {
                message: notifError.message,
                stack: notifError.stack,
                customerId: customerId
            });
            // Non-critical, don't block customer creation
        }

        res.redirect('/customers/list?success=static_ip_customer_created');
    } catch (e) {
        console.error('Error creating static IP client:', e);
        const packages = await listStaticIpPackages();
        const cfg = await getMikrotikConfig();
        const interfaces = cfg ? await getInterfaces(cfg) : [];
        // Generate initial customer code in YYYYMMDDHHMMSS format
        const initial_customer_code = CustomerIdGenerator.generateCustomerId();

        // Get ODP data for error page
        const conn = await databasePool.getConnection();
        try {
            const [odpRows] = await conn.execute(`
                SELECT 
                    o.id, 
                    o.name as odp_name,
                    o.odc_id,
                    odc.olt_id,
                    olt.name as olt_name,
                    odc.name as odc_name
                FROM ftth_odp o
                LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
                LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                ORDER BY o.name
            `);

            const errorMessage = e instanceof Error ? e.message : 'Gagal menyimpan';
            res.status(400).render('customers/new_static_ip', {
                title: 'Pelanggan IP Statis Baru',
                error: errorMessage,
                packages,
                interfaces,
                odpData: odpRows,
                initial_customer_code
            });
        } finally {
            conn.release();
        }
    }
});



router.get('/api/test/queue/test-connection', async (req, res) => {
    try {
        const { testMikrotikConnection } = await import('../services/mikrotikService');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        console.log('Testing connection to MikroTik:', config.host, config.port);

        const result = await testMikrotikConnection(config);

        res.json({
            success: true,
            message: 'Test koneksi MikroTik',
            data: result
        });
    } catch (error: unknown) {
        console.error('Error in test-connection:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
    }
});

router.get('/api/test/queue/direct-test', async (req, res) => {
    try {
        console.log('=== DIRECT MIKROTIK TEST ===');

        // Test dengan konfigurasi langsung
        const { testMikrotikConnection } = await import('../services/mikrotikService');
        const result = await testMikrotikConnection({
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        });

        console.log('Direct test result:', result);

        res.json({
            success: true,
            message: 'Direct MikroTik test',
            data: result
        });
    } catch (error: unknown) {
        console.error('Direct test error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
    }
});

router.get('/api/test/queue/create-direct', async (req, res) => {
    try {
        console.log('=== DIRECT QUEUE CREATION TEST ===');

        // Test buat queue langsung dengan konfigurasi
        const { createQueueTree } = await import('../services/mikrotikService');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        console.log('Creating test queue...');
        await createQueueTree(config, {
            name: 'test-queue-direct',
            parent: 'UPLOAD ALL',
            maxLimit: '10M',
            comment: 'Test queue created directly'
        });

        res.json({
            success: true,
            message: 'Direct queue creation test completed',
            data: { queueName: 'test-queue-direct' }
        });
    } catch (error: unknown) {
        console.error('Direct queue creation error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
    }
});

// Test khusus untuk verifikasi nama queue custom
router.get('/api/test/queue/custom-name-test', async (req, res) => {
    try {
        console.log('=== CUSTOM QUEUE NAME TEST ===');

        const { createQueueTree, getQueueTrees } = await import('../services/mikrotikService');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        // Test dengan nama yang sangat spesifik
        const customName = `PAKET_HEMAT_${Date.now()}`;
        console.log('Creating queue with custom name:', customName);

        // Buat queue dengan nama custom
        await createQueueTree(config, {
            name: customName,
            parent: 'DOWNLOAD ALL',
            maxLimit: '5M',
            comment: `Test queue dengan nama custom: ${customName}`
        });

        console.log('Queue created, now verifying...');

        // Verifikasi apakah queue benar-benar dibuat dengan nama custom
        const queues = await getQueueTrees(config);
        const createdQueue = queues.find((q: any) => q.name === customName);

        console.log('All queues:', queues.map((q: any) => q.name));
        console.log('Created queue found:', createdQueue);

        res.json({
            success: true,
            message: 'Custom queue name test completed',
            data: {
                requestedName: customName,
                verification: {
                    found: !!createdQueue,
                    queueData: createdQueue,
                    allQueues: queues.map((q: any) => ({ name: q.name, parent: q.parent, comment: q.comment }))
                }
            }
        });
    } catch (error: unknown) {
        console.error('Custom name test error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errorMessage });
    }
});

router.get('/api/test/queue/auto-test', async (req, res) => {
    try {
        console.log('=== AUTO TESTING QUEUE CREATION FORMATS ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `autotest${Date.now()}`;
        const results = [];

        // Test 1: Simple string with quotes
        try {
            const command1 = `/queue/tree/add name="${testName}1" parent="UPLOAD ALL" max-limit="5M" comment="Auto test 1"`;
            console.log('Testing format 1:', command1);
            const result1 = await api.write(command1);
            results.push({ format: 'String with quotes', success: true, result: result1 });
        } catch (error: any) {
            results.push({ format: 'String with quotes', success: false, error: error.message });
        }

        // Test 2: Array format
        try {
            const command2 = ['/queue/tree/add', `name=${testName}2`, 'parent=UPLOAD ALL', 'max-limit=5M', 'comment=Auto test 2'];
            console.log('Testing format 2:', command2);
            const result2 = await api.write(command2);
            results.push({ format: 'Array format', success: true, result: result2 });
        } catch (error: any) {
            results.push({ format: 'Array format', success: false, error: error.message });
        }

        // Test 3: Object format
        try {
            const command3 = {
                name: `${testName}3`,
                parent: 'UPLOAD ALL',
                'max-limit': '5M',
                comment: 'Auto test 3'
            };
            console.log('Testing format 3:', command3);
            const result3 = await api.write('/queue/tree/add', command3);
            results.push({ format: 'Object format', success: true, result: result3 });
        } catch (error: any) {
            results.push({ format: 'Object format', success: false, error: error.message });
        }

        // Test 4: Simple string without quotes
        try {
            const command4 = `/queue/tree/add name=${testName}4 parent=UPLOAD ALL max-limit=5M comment=Auto test 4`;
            console.log('Testing format 4:', command4);
            const result4 = await api.write(command4);
            results.push({ format: 'String without quotes', success: true, result: result4 });
        } catch (error: any) {
            results.push({ format: 'String without quotes', success: false, error: error.message });
        }

        // Test 5: Separate parameters
        try {
            await api.write('/queue/tree/add', 'name', `${testName}5`);
            await api.write('/queue/tree/add', 'parent', 'UPLOAD ALL');
            await api.write('/queue/tree/add', 'max-limit', '5M');
            await api.write('/queue/tree/add', 'comment', 'Auto test 5');
            results.push({ format: 'Separate parameters', success: true, result: 'Multiple commands' });
        } catch (error: any) {
            results.push({ format: 'Separate parameters', success: false, error: error.message });
        }

        // Check what was actually created
        console.log('Checking created queues...');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('autotest'));

        api.close();

        res.json({
            success: true,
            message: 'Auto test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({ name: q.name, parent: q.parent, comment: q.comment }))
            }
        });
    } catch (error: any) {
        console.error('Auto test error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/test/queue/loop-test', async (req, res) => {
    try {
        console.log('=== LOOP TESTING QUEUE CREATION FORMATS ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `looptest${Date.now()}`;
        const results = [];

        // Define multiple command formats to test
        const commandFormats = [
            {
                name: 'Format 1: String with quotes',
                command: `/queue/tree/add name="${testName}1" parent="UPLOAD ALL" max-limit="5M" comment="Loop test 1"`
            },
            {
                name: 'Format 2: String without quotes',
                command: `/queue/tree/add name=${testName}2 parent=UPLOAD ALL max-limit=5M comment=Loop test 2`
            },
            {
                name: 'Format 3: Array format',
                command: ['/queue/tree/add', `name=${testName}3`, 'parent=UPLOAD ALL', 'max-limit=5M', 'comment=Loop test 3']
            },
            {
                name: 'Format 4: Object format',
                command: {
                    name: `${testName}4`,
                    parent: 'UPLOAD ALL',
                    'max-limit': '5M',
                    comment: 'Loop test 4'
                }
            },
            {
                name: 'Format 5: Escaped quotes',
                command: `/queue/tree/add name=\\"${testName}5\\" parent=\\"UPLOAD ALL\\" max-limit=\\"5M\\" comment=\\"Loop test 5\\"`
            },
            {
                name: 'Format 6: Single quotes',
                command: `/queue/tree/add name='${testName}6' parent='UPLOAD ALL' max-limit='5M' comment='Loop test 6'`
            },
            {
                name: 'Format 7: No spaces',
                command: `/queue/tree/add name=${testName}7 parent=UPLOAD ALL max-limit=5M comment=Loop test 7`
            },
            {
                name: 'Format 8: With equals',
                command: `/queue/tree/add name=${testName}8 parent=UPLOAD ALL max-limit=5M comment=Loop test 8`
            }
        ];

        // Test each format
        for (let i = 0; i < commandFormats.length; i++) {
            const format = commandFormats[i];
            if (!format) continue;

            try {
                console.log(`Testing ${format.name}...`);
                const result = await api.write(format.command);
                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    command: format.command
                });
                console.log(`✅ ${format.name} succeeded`);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    command: format.command
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('Checking created queues...');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('looptest'));

        api.close();

        res.json({
            success: true,
            message: 'Loop test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('Loop test error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/test/queue/find-format', async (req, res) => {
    try {
        console.log('=== FINDING CORRECT PARAMETER FORMAT ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `find${Date.now()}`;
        const results = [];

        // Define comprehensive command formats to test
        const commandFormats = [
            // String formats
            { name: 'String 1: Double quotes', command: `/queue/tree/add name="${testName}1" parent="UPLOAD ALL" max-limit="5M" comment="Test 1"` },
            { name: 'String 2: No quotes', command: `/queue/tree/add name=${testName}2 parent=UPLOAD ALL max-limit=5M comment=Test 2` },
            { name: 'String 3: Single quotes', command: `/queue/tree/add name='${testName}3' parent='UPLOAD ALL' max-limit='5M' comment='Test 3'` },
            { name: 'String 4: Escaped quotes', command: `/queue/tree/add name=\\"${testName}4\\" parent=\\"UPLOAD ALL\\" max-limit=\\"5M\\" comment=\\"Test 4\\"` },
            { name: 'String 5: Mixed quotes', command: `/queue/tree/add name="${testName}5" parent='UPLOAD ALL' max-limit=5M comment="Test 5"` },
            { name: 'String 6: Parent first', command: `/queue/tree/add parent="UPLOAD ALL" name="${testName}6" max-limit="5M" comment="Test 6"` },
            { name: 'String 7: Name only', command: `/queue/tree/add name="${testName}7"` },
            { name: 'String 8: Name with parent', command: `/queue/tree/add name="${testName}8" parent="UPLOAD ALL"` },

            // Array formats
            { name: 'Array 1: Basic array', command: ['/queue/tree/add', `name=${testName}9`, 'parent=UPLOAD ALL', 'max-limit=5M', 'comment=Test 9'] },
            { name: 'Array 2: With quotes', command: ['/queue/tree/add', `name="${testName}10"`, 'parent="UPLOAD ALL"', 'max-limit="5M"', 'comment="Test 10"'] },
            { name: 'Array 3: Name only', command: ['/queue/tree/add', `name=${testName}11`] },
            { name: 'Array 4: Different order', command: ['/queue/tree/add', 'parent=UPLOAD ALL', `name=${testName}12`, 'max-limit=5M', 'comment=Test 12'] },

            // Object formats
            { name: 'Object 1: Basic object', command: { name: `${testName}13`, parent: 'UPLOAD ALL', 'max-limit': '5M', comment: 'Test 13' } },
            { name: 'Object 2: Name only', command: { name: `${testName}14` } },
            { name: 'Object 3: With empty values', command: { name: `${testName}15`, parent: 'UPLOAD ALL', 'max-limit': '5M', comment: 'Test 15' } },
            { name: 'Object 4: Different order', command: { parent: 'UPLOAD ALL', name: `${testName}16`, 'max-limit': '5M', comment: 'Test 16' } },

            // Special formats
            { name: 'Special 1: With =', command: `/queue/tree/add name=${testName}17 parent=UPLOAD ALL max-limit=5M comment=Test 17` },
            { name: 'Special 2: With spaces', command: `/queue/tree/add name = "${testName}18" parent = "UPLOAD ALL" max-limit = "5M" comment = "Test 18"` },
            { name: 'Special 3: No spaces', command: `/queue/tree/add name=${testName}19 parent=UPLOAD ALL max-limit=5M comment=Test 19` },
            { name: 'Special 4: With dashes', command: `/queue/tree/add name="${testName}20" parent="UPLOAD ALL" max-limit="5M" comment="Test 20"` },
        ];

        // Test each format
        for (let i = 0; i < commandFormats.length; i++) {
            const format = commandFormats[i];
            if (!format) continue;

            try {
                console.log(`Testing ${format.name}...`);
                const result = await api.write(format.command);
                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    command: format.command
                });
                console.log(`✅ ${format.name} succeeded`);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    command: format.command
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('Checking created queues...');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('find'));

        api.close();

        res.json({
            success: true,
            message: 'Find format test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('Find format test error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/test/queue/auto-find', async (req, res) => {
    try {
        console.log('=== AUTO FINDING CORRECT FORMAT ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `autofind${Date.now()}`;
        const results = [];

        // Test different approaches systematically
        const approaches = [
            {
                name: 'Approach 1: Direct string with quotes',
                test: async () => {
                    const command = `/queue/tree/add name="${testName}1" parent="UPLOAD ALL" max-limit="5M" comment="Auto test 1"`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Approach 2: String without quotes',
                test: async () => {
                    const command = `/queue/tree/add name=${testName}2 parent=UPLOAD ALL max-limit=5M comment=Auto test 2`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Approach 3: Array format',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}3`, 'parent=UPLOAD ALL', 'max-limit=5M', 'comment=Auto test 3'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Approach 4: Object format',
                test: async () => {
                    const command = { name: `${testName}4`, parent: 'UPLOAD ALL', 'max-limit': '5M', comment: 'Auto test 4' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Approach 5: Single quotes',
                test: async () => {
                    const command = `/queue/tree/add name='${testName}5' parent='UPLOAD ALL' max-limit='5M' comment='Auto test 5'`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Approach 6: Escaped quotes',
                test: async () => {
                    const command = `/queue/tree/add name=\\"${testName}6\\" parent=\\"UPLOAD ALL\\" max-limit=\\"5M\\" comment=\\"Auto test 6\\"`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Approach 7: Parent first',
                test: async () => {
                    const command = `/queue/tree/add parent="UPLOAD ALL" name="${testName}7" max-limit="5M" comment="Auto test 7"`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Approach 8: Name only',
                test: async () => {
                    const command = `/queue/tree/add name="${testName}8"`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            }
        ];

        // Test each approach
        for (const approach of approaches) {
            try {
                console.log(`\n=== Testing ${approach.name} ===`);
                const result = await approach.test();
                results.push({
                    approach: approach.name,
                    success: true,
                    result: result
                });
                console.log(`✅ ${approach.name} succeeded`);
            } catch (error: any) {
                results.push({
                    approach: approach.name,
                    success: false,
                    error: error.message
                });
                console.log(`❌ ${approach.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('\n=== Checking created queues ===');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('autofind'));

        console.log('Created queues:', createdQueues.map((q: any) => q.name));

        api.close();

        res.json({
            success: true,
            message: 'Auto find test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('Auto find test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint untuk debug
router.get('/api/test/simple', (req, res) => {
    res.json({ success: true, message: 'API route berfungsi' });
});

router.post('/api/test/simple', (req, res) => {
    res.json({ success: true, message: 'POST API route berfungsi', body: req.body });
});

// Test otomatis semua format command
router.get('/api/test/queue/auto-test-all', async (req, res) => {
    try {
        console.log('=== AUTO TEST ALL COMMAND FORMATS ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `autotest${Date.now()}`;
        const results = [];

        // Test semua format command yang mungkin
        const commandFormats = [
            // Format 1: Array dengan name pertama
            {
                name: 'Array 1: name first',
                command: ['/queue/tree/add', `name=${testName}1`, 'parent=UPLOAD ALL', 'max-limit=5M', 'comment=Test 1']
            },
            // Format 2: Array dengan parent pertama
            {
                name: 'Array 2: parent first',
                command: ['/queue/tree/add', 'parent=UPLOAD ALL', `name=${testName}2`, 'max-limit=5M', 'comment=Test 2']
            },
            // Format 3: Object format
            {
                name: 'Object 1: basic',
                command: { name: `${testName}3`, parent: 'UPLOAD ALL', 'max-limit': '5M', comment: 'Test 3' }
            },
            // Format 4: Object dengan urutan berbeda
            {
                name: 'Object 2: different order',
                command: { parent: 'UPLOAD ALL', name: `${testName}4`, 'max-limit': '5M', comment: 'Test 4' }
            },
            // Format 5: String dengan quotes
            {
                name: 'String 1: with quotes',
                command: `/queue/tree/add name="${testName}5" parent="UPLOAD ALL" max-limit="5M" comment="Test 5"`
            },
            // Format 6: String tanpa quotes
            {
                name: 'String 2: no quotes',
                command: `/queue/tree/add name=${testName}6 parent=UPLOAD ALL max-limit=5M comment=Test 6`
            },
            // Format 7: String dengan single quotes
            {
                name: 'String 3: single quotes',
                command: `/queue/tree/add name='${testName}7' parent='UPLOAD ALL' max-limit='5M' comment='Test 7'`
            },
            // Format 8: Array dengan quotes
            {
                name: 'Array 3: with quotes',
                command: ['/queue/tree/add', `name="${testName}8"`, 'parent="UPLOAD ALL"', 'max-limit="5M"', 'comment="Test 8"']
            },
            // Format 9: Object dengan empty values
            {
                name: 'Object 3: with empty values',
                command: { name: `${testName}9`, parent: 'UPLOAD ALL', 'max-limit': '5M', comment: 'Test 9' }
            },
            // Format 10: Array dengan urutan berbeda
            {
                name: 'Array 4: different order',
                command: ['/queue/tree/add', 'parent=UPLOAD ALL', `name=${testName}10`, 'max-limit=5M', 'comment=Test 10']
            }
        ];

        // Test setiap format
        for (let i = 0; i < commandFormats.length; i++) {
            const format = commandFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} ===`);
                console.log('Command:', format.command);

                let result;
                if (Array.isArray(format.command)) {
                    result = await api.write(format.command);
                } else if (typeof format.command === 'object') {
                    result = await api.write('/queue/tree/add', format.command);
                } else {
                    result = await api.write(format.command);
                }

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    command: format.command
                });
                console.log(`✅ ${format.name} succeeded:`, result);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    command: format.command
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('\n=== Checking created queues ===');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('autotest'));

        console.log('Created queues:', createdQueues.map((q: any) => q.name));

        api.close();

        res.json({
            success: true,
            message: 'Auto test all completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('Auto test all error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test khusus untuk RouterOS V6 - periksa parameter name
router.get('/api/test/queue/routeros-v6', async (req, res) => {
    try {
        console.log('=== TEST KHUSUS ROUTEROS V6 ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = 'ROUTEROSV6';
        const results = [];

        // Test berbagai format parameter name untuk RouterOS V6
        const commandFormats = [
            {
                name: 'Format 1: Array dengan name di posisi pertama',
                command: [
                    '/queue/tree/add',
                    `name=${testName}`,
                    'parent=global'
                ]
            },
            {
                name: 'Format 2: Array dengan name di posisi kedua',
                command: [
                    '/queue/tree/add',
                    'parent=global',
                    `name=${testName}`
                ]
            },
            {
                name: 'Format 3: Object dengan name di posisi pertama',
                command: {
                    name: testName,
                    parent: 'global'
                }
            },
            {
                name: 'Format 4: Object dengan name di posisi kedua',
                command: {
                    parent: 'global',
                    name: testName
                }
            },
            {
                name: 'Format 5: Array dengan name di posisi terakhir',
                command: [
                    '/queue/tree/add',
                    'parent=global',
                    'max-limit=0',
                    `name=${testName}`
                ]
            },
            {
                name: 'Format 6: Object dengan name di posisi terakhir',
                command: {
                    parent: 'global',
                    'max-limit': '0',
                    name: testName
                }
            },
            {
                name: 'Format 7: Array dengan name di tengah',
                command: [
                    '/queue/tree/add',
                    'parent=global',
                    `name=${testName}`,
                    'max-limit=0'
                ]
            },
            {
                name: 'Format 8: Object dengan name di tengah',
                command: {
                    parent: 'global',
                    name: testName,
                    'max-limit': '0'
                }
            }
        ];

        // Test setiap format
        for (let i = 0; i < commandFormats.length; i++) {
            const format = commandFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} ===`);
                console.log('Command:', format.command);

                let result;
                if (Array.isArray(format.command)) {
                    result = await api.write(format.command);
                } else if (typeof format.command === 'object') {
                    result = await api.write('/queue/tree/add', format.command);
                } else {
                    result = await api.write(format.command);
                }

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    command: format.command
                });
                console.log(`✅ ${format.name} succeeded:`, result);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    command: format.command
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('\n=== Checking created queues ===');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('ROUTEROSV6'));

        console.log('Created queues:', createdQueues.map((q: any) => q.name));

        api.close();

        res.json({
            success: true,
            message: 'RouterOS V6 test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('RouterOS V6 test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test berdasarkan dokumentasi resmi MikroTik
router.get('/api/test/queue/mikrotik-official', async (req, res) => {
    try {
        console.log('=== TEST BERDASARKAN DOKUMENTASI RESMI MIKROTIK ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = 'TEST123';
        const results = [];

        // Test berdasarkan dokumentasi resmi MikroTik
        const commandFormats = [
            {
                name: 'Format 1: CLI format langsung',
                command: `/queue/tree/add name=${testName} parent="DOWNLOAD ALL" packet-mark=mark_${testName} limit-at=0 max-limit=0 priority=8 queue=default`
            },
            {
                name: 'Format 2: Array dengan parameter lengkap',
                command: [
                    '/queue/tree/add',
                    `name=${testName}`,
                    'parent="DOWNLOAD ALL"',
                    `packet-mark=mark_${testName}`,
                    'limit-at=0',
                    'max-limit=0',
                    'priority=8',
                    'queue=default'
                ]
            },
            {
                name: 'Format 3: Object dengan parameter lengkap',
                command: {
                    name: testName,
                    parent: 'DOWNLOAD ALL',
                    'packet-mark': `mark_${testName}`,
                    'limit-at': '0',
                    'max-limit': '0',
                    priority: '8',
                    queue: 'default'
                }
            },
            {
                name: 'Format 4: Array sederhana',
                command: [
                    '/queue/tree/add',
                    `name=${testName}`,
                    'parent=DOWNLOAD ALL'
                ]
            },
            {
                name: 'Format 5: Object sederhana',
                command: {
                    name: testName,
                    parent: 'DOWNLOAD ALL'
                }
            },
            {
                name: 'Format 6: Array dengan parent global',
                command: [
                    '/queue/tree/add',
                    `name=${testName}`,
                    'parent=global'
                ]
            },
            {
                name: 'Format 7: Object dengan parent global',
                command: {
                    name: testName,
                    parent: 'global'
                }
            }
        ];

        // Test setiap format
        for (let i = 0; i < commandFormats.length; i++) {
            const format = commandFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} ===`);
                console.log('Command:', format.command);

                let result;
                if (Array.isArray(format.command)) {
                    result = await api.write(format.command);
                } else if (typeof format.command === 'object') {
                    result = await api.write('/queue/tree/add', format.command);
                } else {
                    result = await api.write(format.command);
                }

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    command: format.command
                });
                console.log(`✅ ${format.name} succeeded:`, result);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    command: format.command
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('\n=== Checking created queues ===');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('TEST123'));

        console.log('Created queues:', createdQueues.map((q: any) => q.name));

        api.close();

        res.json({
            success: true,
            message: 'MikroTik official test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit'],
                    packetMark: q['packet-mark'],
                    priority: q.priority,
                    queue: q.queue
                }))
            }
        });
    } catch (error: any) {
        console.error('MikroTik official test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test otomatis untuk membuat queue TEST123 dengan parent DOWNLOAD ALL
router.get('/api/test/queue/test123', async (req, res) => {
    try {
        console.log('=== TEST AUTOMATIS QUEUE TEST123 ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = 'TEST123';
        const results = [];

        // Test berbagai format command untuk TEST123
        const commandFormats = [
            {
                name: 'Format 1: Array dengan parent DOWNLOAD ALL',
                command: ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'max-limit=5M', 'comment=Test queue']
            },
            {
                name: 'Format 2: Array dengan parent global',
                command: ['/queue/tree/add', `name=${testName}`, 'parent=global', 'max-limit=5M', 'comment=Test queue']
            },
            {
                name: 'Format 3: Object dengan parent DOWNLOAD ALL',
                command: { name: testName, parent: 'DOWNLOAD ALL', 'max-limit': '5M', comment: 'Test queue' }
            },
            {
                name: 'Format 4: Object dengan parent global',
                command: { name: testName, parent: 'global', 'max-limit': '5M', comment: 'Test queue' }
            },
            {
                name: 'Format 5: Array dengan quotes',
                command: ['/queue/tree/add', `name="${testName}"`, 'parent="DOWNLOAD ALL"', 'max-limit="5M"', 'comment="Test queue"']
            },
            {
                name: 'Format 6: Object dengan urutan berbeda',
                command: { parent: 'DOWNLOAD ALL', name: testName, 'max-limit': '5M', comment: 'Test queue' }
            }
        ];

        // Test setiap format
        for (let i = 0; i < commandFormats.length; i++) {
            const format = commandFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} ===`);
                console.log('Command:', format.command);

                let result;
                if (Array.isArray(format.command)) {
                    result = await api.write(format.command);
                } else if (typeof format.command === 'object') {
                    result = await api.write('/queue/tree/add', format.command);
                } else {
                    result = await api.write(format.command);
                }

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    command: format.command
                });
                console.log(`✅ ${format.name} succeeded:`, result);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    command: format.command
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('\n=== Checking created queues ===');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('TEST123'));

        console.log('Created queues:', createdQueues.map((q: any) => q.name));

        api.close();

        res.json({
            success: true,
            message: 'Test123 completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('Test123 error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint untuk melihat semua queue
router.get('/api/test/queue/debug-all', async (req, res) => {
    try {
        console.log('=== DEBUG ALL QUEUES ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        // Get all queues
        const queues = await api.write('/queue/tree/print');
        console.log('All queues:', queues);

        api.close();

        res.json({
            success: true,
            message: 'Debug all queues completed',
            data: {
                totalQueues: queues.length,
                queues: queues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit'],
                    disabled: q.disabled
                }))
            }
        });
    } catch (error: any) {
        console.error('Debug all queues error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint yang sangat sederhana untuk menemukan format yang benar
router.get('/api/test/queue/simple-fix', async (req, res) => {
    try {
        console.log('=== SIMPLE FIX TEST ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `SIMPLE${Date.now()}`;
        const results = [];

        // Test format yang paling sederhana dan paling mungkin berhasil
        const simpleFormats = [
            {
                name: 'Format 1: Object dengan name di posisi pertama',
                test: async () => {
                    const command = { name: testName, parent: 'global' };
                    console.log('Testing Object format 1:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Format 2: Object dengan parent di posisi pertama',
                test: async () => {
                    const command = { parent: 'global', name: testName };
                    console.log('Testing Object format 2:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Format 3: Array dengan name di posisi pertama',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=global'];
                    console.log('Testing Array format 1:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Format 4: Array dengan parent di posisi pertama',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=global', `name=${testName}`];
                    console.log('Testing Array format 2:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Format 5: String sederhana',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=global`;
                    console.log('Testing String format:', command);
                    return await api.write(command);
                }
            }
        ];

        // Test setiap format
        for (const format of simpleFormats) {
            try {
                console.log(`\n=== Testing ${format.name} ===`);
                const result = await format.test();
                results.push({
                    format: format.name,
                    success: true,
                    result: result
                });
                console.log(`✅ ${format.name} succeeded:`, result);
            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        // Check what was actually created
        console.log('\n=== Checking created queues ===');
        const queues = await api.write('/queue/tree/print');
        const createdQueues = queues.filter((q: any) => q.name && q.name.includes('SIMPLE'));

        console.log('Created queues:', createdQueues.map((q: any) => q.name));

        api.close();

        res.json({
            success: true,
            message: 'Simple fix test completed',
            data: {
                testName,
                results,
                createdQueues: createdQueues.map((q: any) => ({
                    name: q.name,
                    parent: q.parent,
                    comment: q.comment,
                    maxLimit: q['max-limit']
                }))
            }
        });
    } catch (error: any) {
        console.error('Simple fix test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint untuk menguji perbaikan createQueueTree
router.get('/api/test/queue/test-fixed-service', async (req, res) => {
    try {
        console.log('=== TEST FIXED MIKROTIK SERVICE ===');

        const { createQueueTree } = await import('../services/mikrotikService');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const testName = `FIXED${Date.now()}`;

        console.log('Testing fixed createQueueTree function...');
        console.log('Queue name:', testName);

        // Test dengan format yang sudah diperbaiki
        await createQueueTree(config, {
            name: testName,
            parent: 'global',
            maxLimit: '5M',
            comment: 'Test queue dengan nama custom'
        });

        console.log('✅ createQueueTree completed successfully');

        res.json({
            success: true,
            message: 'Fixed service test completed',
            data: {
                testName,
                message: 'Queue should be created with custom name'
            }
        });
    } catch (error: any) {
        console.error('Fixed service test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint untuk cek koneksi MikroTik
router.get('/api/test/queue/check-connection', async (req, res) => {
    try {
        console.log('=== CHECK MIKROTIK CONNECTION ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        console.log('Testing connection to MikroTik...');
        console.log('Config:', config);

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik successfully');

        // Test simple command
        const result = await api.write('/system/identity/print');
        console.log('✅ System identity:', result);

        api.close();

        res.json({
            success: true,
            message: 'MikroTik connection successful',
            data: {
                config,
                result
            }
        });
    } catch (error: any) {
        console.error('❌ MikroTik connection failed:', error);
        res.status(500).json({
            error: error.message,
            message: 'Failed to connect to MikroTik. Please check credentials and network.'
        });
    }
});

// Test endpoint dengan PHP - test semua format
router.get('/api/test/queue/php-format-test', async (req, res) => {
    try {
        console.log('=== PHP FORMAT TEST ===');

        const { createQueueTree } = await import('../services/mikrotikService');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const testName = `PHP_FORMAT${Date.now()}`;

        console.log('Testing all PHP formats...');
        console.log('Queue name:', testName);

        await createQueueTree(config, {
            name: testName,
            parent: 'DOWNLOAD ALL',
            maxLimit: '5M',
            comment: 'Test semua format PHP'
        });

        console.log('✅ PHP format test completed');

        res.json({
            success: true,
            message: 'PHP format test completed',
            data: {
                testName,
                message: 'Please check MikroTik for queue with name: ' + testName + '_F*'
            }
        });
    } catch (error: any) {
        console.error('PHP format test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint yang terus berulang sampai ketemu format yang benar
router.get('/api/test/queue/loop-until-success', async (req, res) => {
    try {
        console.log('=== LOOP UNTIL SUCCESS TEST ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `LOOP${Date.now()}`;
        const results = [];
        let attempt = 1;
        const maxAttempts = 50; // Maksimal 50 percobaan

        // Daftar format yang akan dicoba secara berulang
        const formatTemplates = [
            // Object formats
            { name: 'Object 1', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL' }) },
            { name: 'Object 2', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name }) },
            { name: 'Object 3', command: (name: string) => ({ name, parent: 'UPLOAD ALL' }) },
            { name: 'Object 4', command: (name: string) => ({ parent: 'UPLOAD ALL', name }) },
            { name: 'Object 5', command: (name: string) => ({ name, parent: 'global' }) },
            { name: 'Object 6', command: (name: string) => ({ parent: 'global', name }) },

            // Array formats
            { name: 'Array 1', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL'] },
            { name: 'Array 2', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`] },
            { name: 'Array 3', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=UPLOAD ALL'] },
            { name: 'Array 4', command: (name: string) => ['/queue/tree/add', 'parent=UPLOAD ALL', `name=${name}`] },
            { name: 'Array 5', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=global'] },
            { name: 'Array 6', command: (name: string) => ['/queue/tree/add', 'parent=global', `name=${name}`] },

            // Format dengan quotes
            { name: 'Object 7', command: (name: string) => ({ name: `"${name}"`, parent: 'DOWNLOAD ALL' }) },
            { name: 'Object 8', command: (name: string) => ({ parent: '"DOWNLOAD ALL"', name }) },
            { name: 'Array 7', command: (name: string) => ['/queue/tree/add', `name="${name}"`, 'parent=DOWNLOAD ALL'] },
            { name: 'Array 8', command: (name: string) => ['/queue/tree/add', 'parent="DOWNLOAD ALL"', `name=${name}`] },

            // Format dengan parameter tambahan
            { name: 'Object 9', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL', 'max-limit': '5M' }) },
            { name: 'Object 10', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name, 'max-limit': '5M' }) },
            { name: 'Array 9', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL', 'max-limit=5M'] },
            { name: 'Array 10', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`, 'max-limit=5M'] },

            // Format dengan comment
            { name: 'Object 11', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL', comment: 'Loop test' }) },
            { name: 'Object 12', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name, comment: 'Loop test' }) },
            { name: 'Array 11', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL', 'comment=Loop test'] },
            { name: 'Array 12', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`, 'comment=Loop test'] },

            // Format dengan semua parameter
            { name: 'Object 13', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL', 'max-limit': '5M', comment: 'Loop test' }) },
            { name: 'Object 14', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name, 'max-limit': '5M', comment: 'Loop test' }) },
            { name: 'Array 13', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL', 'max-limit=5M', 'comment=Loop test'] },
            { name: 'Array 14', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`, 'max-limit=5M', 'comment=Loop test'] },

            // Format khusus RouterOS
            { name: 'Object 15', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL', priority: '8' }) },
            { name: 'Object 16', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name, priority: '8' }) },
            { name: 'Array 15', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL', 'priority=8'] },
            { name: 'Array 16', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`, 'priority=8'] },

            // Format dengan parameter khusus
            { name: 'Object 17', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL', 'packet-mark': `mark_${name}` }) },
            { name: 'Object 18', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name, 'packet-mark': `mark_${name}` }) },
            { name: 'Array 17', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL', `packet-mark=mark_${name}`] },
            { name: 'Array 18', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`, `packet-mark=mark_${name}`] },

            // Format dengan limit-at
            { name: 'Object 19', command: (name: string) => ({ name, parent: 'DOWNLOAD ALL', 'limit-at': '0' }) },
            { name: 'Object 20', command: (name: string) => ({ parent: 'DOWNLOAD ALL', name, 'limit-at': '0' }) },
            { name: 'Array 19', command: (name: string) => ['/queue/tree/add', `name=${name}`, 'parent=DOWNLOAD ALL', 'limit-at=0'] },
            { name: 'Array 20', command: (name: string) => ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${name}`, 'limit-at=0'] }
        ];

        // Loop sampai ketemu atau mencapai max attempts
        while (attempt <= maxAttempts) {
            const currentTestName = `${testName}_${attempt}`;
            console.log(`\n=== ATTEMPT ${attempt}/${maxAttempts} ===`);
            console.log(`Testing with name: ${currentTestName}`);

            let foundWorkingFormat = false;

            // Coba setiap format template
            for (let i = 0; i < formatTemplates.length; i++) {
                const template = formatTemplates[i];
                if (!template) continue;

                try {
                    const command = template.command(currentTestName);
                    console.log(`Testing ${template.name}:`, command);

                    let result;
                    if (Array.isArray(command)) {
                        result = await api.write(command);
                    } else {
                        result = await api.write('/queue/tree/add', command);
                    }

                    console.log(`✅ ${template.name} succeeded:`, result);

                    // Simpan hasil
                    results.push({
                        attempt,
                        format: template.name,
                        success: true,
                        result: result,
                        testName: currentTestName
                    });

                    // Cek apakah queue benar-benar dibuat dengan nama custom
                    console.log('Checking if queue was created with custom name...');
                    const queues = await api.write('/queue/tree/print');
                    const createdQueue = queues.find((q: any) => q.name === currentTestName);

                    if (createdQueue) {
                        console.log('🎉 SUCCESS! Queue created with custom name:', createdQueue);
                        foundWorkingFormat = true;
                        break;
                    } else {
                        console.log('❌ Queue not found with custom name. Available queues:', queues.map((q: any) => q.name));
                    }

                } catch (error: any) {
                    console.log(`❌ ${template.name} failed: ${error.message}`);
                    results.push({
                        attempt,
                        format: template.name,
                        success: false,
                        error: error.message,
                        testName: currentTestName
                    });
                }
            }

            if (foundWorkingFormat) {
                break;
            }

            attempt++;

            // Tunggu sebentar sebelum attempt berikutnya
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        api.close();

        res.json({
            success: true,
            message: 'Loop until success test completed',
            data: {
                testName,
                totalAttempts: attempt - 1,
                maxAttempts,
                results,
                message: attempt > maxAttempts ?
                    'Max attempts reached. Please check MikroTik for queue with name: ' + testName + '_*' :
                    'Found working format! Please check MikroTik for queue with name: ' + testName + '_*'
            }
        });
    } catch (error: any) {
        console.error('Loop until success test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint komprehensif - mencoba semua format yang mungkin dengan berbagai parent
router.get('/api/test/queue/comprehensive-test', async (req, res) => {
    try {
        console.log('=== COMPREHENSIVE MIKROTIK FORMAT TEST ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `COMPREHENSIVE${Date.now()}`;
        const results = [];

        // Daftar semua format yang mungkin dengan berbagai variasi
        const allFormats = [
            // Object formats dengan berbagai parent
            {
                name: 'Object 1: name first, parent DOWNLOAD ALL',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 2: parent DOWNLOAD ALL first, name second',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 3: name first, parent UPLOAD ALL',
                test: async () => {
                    const command = { name: testName, parent: 'UPLOAD ALL' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 4: parent UPLOAD ALL first, name second',
                test: async () => {
                    const command = { parent: 'UPLOAD ALL', name: testName };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 5: name first, parent global',
                test: async () => {
                    const command = { name: testName, parent: 'global' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 6: parent global first, name second',
                test: async () => {
                    const command = { parent: 'global', name: testName };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },

            // Array formats dengan berbagai parent
            {
                name: 'Array 1: name first, parent DOWNLOAD ALL',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 2: parent DOWNLOAD ALL first, name second',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 3: name first, parent UPLOAD ALL',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=UPLOAD ALL'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 4: parent UPLOAD ALL first, name second',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=UPLOAD ALL', `name=${testName}`];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 5: name first, parent global',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=global'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 6: parent global first, name second',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=global', `name=${testName}`];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // Format dengan quotes
            {
                name: 'Object 7: name first with quotes, parent DOWNLOAD ALL',
                test: async () => {
                    const command = { name: `"${testName}"`, parent: 'DOWNLOAD ALL' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 8: parent DOWNLOAD ALL with quotes, name second',
                test: async () => {
                    const command = { parent: '"DOWNLOAD ALL"', name: testName };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Array 7: name first with quotes, parent DOWNLOAD ALL',
                test: async () => {
                    const command = ['/queue/tree/add', `name="${testName}"`, 'parent=DOWNLOAD ALL'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 8: parent DOWNLOAD ALL with quotes, name second',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent="DOWNLOAD ALL"', `name=${testName}`];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // Format dengan parameter tambahan
            {
                name: 'Object 9: name first, parent DOWNLOAD ALL, with max-limit',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL', 'max-limit': '5M' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 10: parent DOWNLOAD ALL first, name second, with max-limit',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName, 'max-limit': '5M' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Array 9: name first, parent DOWNLOAD ALL, with max-limit',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'max-limit=5M'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 10: parent DOWNLOAD ALL first, name second, with max-limit',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'max-limit=5M'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // Format dengan comment
            {
                name: 'Object 11: name first, parent DOWNLOAD ALL, with comment',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL', comment: 'Comprehensive test' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 12: parent DOWNLOAD ALL first, name second, with comment',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName, comment: 'Comprehensive test' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Array 11: name first, parent DOWNLOAD ALL, with comment',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'comment=Comprehensive test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 12: parent DOWNLOAD ALL first, name second, with comment',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'comment=Comprehensive test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // Format dengan semua parameter
            {
                name: 'Object 13: name first, parent DOWNLOAD ALL, with all params',
                test: async () => {
                    const command = {
                        name: testName,
                        parent: 'DOWNLOAD ALL',
                        'max-limit': '5M',
                        comment: 'Comprehensive test'
                    };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 14: parent DOWNLOAD ALL first, name second, with all params',
                test: async () => {
                    const command = {
                        parent: 'DOWNLOAD ALL',
                        name: testName,
                        'max-limit': '5M',
                        comment: 'Comprehensive test'
                    };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Array 13: name first, parent DOWNLOAD ALL, with all params',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'max-limit=5M', 'comment=Comprehensive test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 14: parent DOWNLOAD ALL first, name second, with all params',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'max-limit=5M', 'comment=Comprehensive test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // Format khusus RouterOS
            {
                name: 'Object 15: name first, parent DOWNLOAD ALL, with priority',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL', priority: '8' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 16: parent DOWNLOAD ALL first, name second, with priority',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName, priority: '8' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Array 15: name first, parent DOWNLOAD ALL, with priority',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'priority=8'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 16: parent DOWNLOAD ALL first, name second, with priority',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'priority=8'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            }
        ];

        // Test setiap format
        for (let i = 0; i < allFormats.length; i++) {
            const format = allFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} (${i + 1}/${allFormats.length}) ===`);
                const result = await format.test();

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    index: i + 1
                });

                console.log(`✅ ${format.name} succeeded:`, result);

            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    index: i + 1
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        api.close();

        res.json({
            success: true,
            message: 'Comprehensive MikroTik format test completed',
            data: {
                testName,
                totalFormats: allFormats.length,
                results,
                message: 'Please check MikroTik for queue with name: ' + testName
            }
        });
    } catch (error: any) {
        console.error('Comprehensive test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint otomatis dengan parent DOWNLOAD ALL - mencoba semua format sampai berhasil
router.get('/api/test/queue/auto-test-download-all', async (req, res) => {
    try {
        console.log('=== AUTO TEST WITH DOWNLOAD ALL PARENT ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `TEST${Date.now()}`;
        const results = [];

        // Daftar semua format yang mungkin dengan parent DOWNLOAD ALL
        const allFormats = [
            // Object formats
            {
                name: 'Object 1: name first, parent DOWNLOAD ALL',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 2: parent DOWNLOAD ALL first, name second',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 3: name first, parent DOWNLOAD ALL, with max-limit',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL', 'max-limit': '5M' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 4: parent DOWNLOAD ALL first, name second, with max-limit',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName, 'max-limit': '5M' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 5: name first, parent DOWNLOAD ALL, with comment',
                test: async () => {
                    const command = { name: testName, parent: 'DOWNLOAD ALL', comment: 'Auto test' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 6: parent DOWNLOAD ALL first, name second, with comment',
                test: async () => {
                    const command = { parent: 'DOWNLOAD ALL', name: testName, comment: 'Auto test' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 7: name first, parent DOWNLOAD ALL, with all params',
                test: async () => {
                    const command = {
                        name: testName,
                        parent: 'DOWNLOAD ALL',
                        'max-limit': '5M',
                        comment: 'Auto test'
                    };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 8: parent DOWNLOAD ALL first, name second, with all params',
                test: async () => {
                    const command = {
                        parent: 'DOWNLOAD ALL',
                        name: testName,
                        'max-limit': '5M',
                        comment: 'Auto test'
                    };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },

            // Array formats
            {
                name: 'Array 1: name first, parent DOWNLOAD ALL',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 2: parent DOWNLOAD ALL first, name second',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 3: name first, parent DOWNLOAD ALL, with max-limit',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'max-limit=5M'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 4: parent DOWNLOAD ALL first, name second, with max-limit',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'max-limit=5M'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 5: name first, parent DOWNLOAD ALL, with comment',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 6: parent DOWNLOAD ALL first, name second, with comment',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 7: name first, parent DOWNLOAD ALL, with all params',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=DOWNLOAD ALL', 'max-limit=5M', 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 8: parent DOWNLOAD ALL first, name second, with all params',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=DOWNLOAD ALL', `name=${testName}`, 'max-limit=5M', 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // String formats
            {
                name: 'String 1: name first, parent DOWNLOAD ALL',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=DOWNLOAD ALL`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 2: parent DOWNLOAD ALL first, name second',
                test: async () => {
                    const command = `/queue/tree/add parent=DOWNLOAD ALL name=${testName}`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 3: name first, parent DOWNLOAD ALL, with max-limit',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=DOWNLOAD ALL max-limit=5M`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 4: parent DOWNLOAD ALL first, name second, with max-limit',
                test: async () => {
                    const command = `/queue/tree/add parent=DOWNLOAD ALL name=${testName} max-limit=5M`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 5: name first, parent DOWNLOAD ALL, with comment',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=DOWNLOAD ALL comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 6: parent DOWNLOAD ALL first, name second, with comment',
                test: async () => {
                    const command = `/queue/tree/add parent=DOWNLOAD ALL name=${testName} comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 7: name first, parent DOWNLOAD ALL, with all params',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=DOWNLOAD ALL max-limit=5M comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 8: parent DOWNLOAD ALL first, name second, with all params',
                test: async () => {
                    const command = `/queue/tree/add parent=DOWNLOAD ALL name=${testName} max-limit=5M comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            }
        ];

        // Test setiap format
        for (let i = 0; i < allFormats.length; i++) {
            const format = allFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} (${i + 1}/${allFormats.length}) ===`);
                const result = await format.test();

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    index: i + 1
                });

                console.log(`✅ ${format.name} succeeded:`, result);

            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    index: i + 1
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        api.close();

        res.json({
            success: true,
            message: 'Auto test with DOWNLOAD ALL parent completed',
            data: {
                testName,
                totalFormats: allFormats.length,
                results,
                message: 'Please check MikroTik for queue with name: ' + testName
            }
        });
    } catch (error: any) {
        console.error('Auto test DOWNLOAD ALL error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint otomatis - mencoba semua format sampai berhasil
router.get('/api/test/queue/auto-find-working-format', async (req, res) => {
    try {
        console.log('=== AUTO FIND WORKING FORMAT ===');

        const { RouterOSAPI } = await import('routeros-api');

        const config = {
            host: '192.168.5.1',
            port: 8728,
            username: 'adii',
            password: 'adi',
            use_tls: false
        };

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 5000
        });

        await api.connect();
        console.log('✅ Connected to MikroTik');

        const testName = `AUTO${Date.now()}`;
        const results = [];
        let workingFormat = null;

        // Daftar semua format yang mungkin
        const allFormats = [
            // Object formats
            {
                name: 'Object 1: name first, parent second',
                test: async () => {
                    const command = { name: testName, parent: 'global' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 2: parent first, name second',
                test: async () => {
                    const command = { parent: 'global', name: testName };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 3: name first, parent second, with max-limit',
                test: async () => {
                    const command = { name: testName, parent: 'global', 'max-limit': '5M' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 4: parent first, name second, with max-limit',
                test: async () => {
                    const command = { parent: 'global', name: testName, 'max-limit': '5M' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 5: name first, parent second, with comment',
                test: async () => {
                    const command = { name: testName, parent: 'global', comment: 'Auto test' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 6: parent first, name second, with comment',
                test: async () => {
                    const command = { parent: 'global', name: testName, comment: 'Auto test' };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 7: name first, parent second, with all params',
                test: async () => {
                    const command = {
                        name: testName,
                        parent: 'global',
                        'max-limit': '5M',
                        comment: 'Auto test'
                    };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },
            {
                name: 'Object 8: parent first, name second, with all params',
                test: async () => {
                    const command = {
                        parent: 'global',
                        name: testName,
                        'max-limit': '5M',
                        comment: 'Auto test'
                    };
                    console.log('Testing:', command);
                    return await api.write('/queue/tree/add', command);
                }
            },

            // Array formats
            {
                name: 'Array 1: name first, parent second',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=global'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 2: parent first, name second',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=global', `name=${testName}`];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 3: name first, parent second, with max-limit',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=global', 'max-limit=5M'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 4: parent first, name second, with max-limit',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=global', `name=${testName}`, 'max-limit=5M'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 5: name first, parent second, with comment',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=global', 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 6: parent first, name second, with comment',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=global', `name=${testName}`, 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 7: name first, parent second, with all params',
                test: async () => {
                    const command = ['/queue/tree/add', `name=${testName}`, 'parent=global', 'max-limit=5M', 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'Array 8: parent first, name second, with all params',
                test: async () => {
                    const command = ['/queue/tree/add', 'parent=global', `name=${testName}`, 'max-limit=5M', 'comment=Auto test'];
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },

            // String formats
            {
                name: 'String 1: name first, parent second',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=global`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 2: parent first, name second',
                test: async () => {
                    const command = `/queue/tree/add parent=global name=${testName}`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 3: name first, parent second, with max-limit',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=global max-limit=5M`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 4: parent first, name second, with max-limit',
                test: async () => {
                    const command = `/queue/tree/add parent=global name=${testName} max-limit=5M`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 5: name first, parent second, with comment',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=global comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 6: parent first, name second, with comment',
                test: async () => {
                    const command = `/queue/tree/add parent=global name=${testName} comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 7: name first, parent second, with all params',
                test: async () => {
                    const command = `/queue/tree/add name=${testName} parent=global max-limit=5M comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            },
            {
                name: 'String 8: parent first, name second, with all params',
                test: async () => {
                    const command = `/queue/tree/add parent=global name=${testName} max-limit=5M comment=Auto test`;
                    console.log('Testing:', command);
                    return await api.write(command);
                }
            }
        ];

        // Test setiap format sampai menemukan yang berhasil
        for (let i = 0; i < allFormats.length; i++) {
            const format = allFormats[i];
            if (!format) continue;

            try {
                console.log(`\n=== Testing ${format.name} (${i + 1}/${allFormats.length}) ===`);
                const result = await format.test();

                results.push({
                    format: format.name,
                    success: true,
                    result: result,
                    index: i + 1
                });

                console.log(`✅ ${format.name} succeeded:`, result);

                // Cek apakah queue benar-benar dibuat dengan nama custom
                console.log('Checking if queue was created with custom name...');
                const queues = await api.write('/queue/tree/print');
                const createdQueue = queues.find((q: any) => q.name === testName);

                if (createdQueue) {
                    console.log('🎉 SUCCESS! Queue created with custom name:', createdQueue);
                    workingFormat = format.name;
                    break; // Keluar dari loop karena sudah menemukan format yang bekerja
                } else {
                    console.log('❌ Queue not found with custom name. Available queues:', queues.map((q: any) => q.name));
                }

            } catch (error: any) {
                results.push({
                    format: format.name,
                    success: false,
                    error: error.message,
                    index: i + 1
                });
                console.log(`❌ ${format.name} failed: ${error.message}`);
            }
        }

        api.close();

        res.json({
            success: true,
            message: 'Auto find working format completed',
            data: {
                testName,
                workingFormat,
                totalFormats: allFormats.length,
                results,
                message: workingFormat ? `Found working format: ${workingFormat}` : 'No working format found'
            }
        });
    } catch (error: any) {
        console.error('Auto find working format error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Monitoring & Management Billing

// Billing Dashboard Routes
router.get('/billing/dashboard', (req, res) => BillingDashboardController.getBillingDashboard(req, res));
router.get('/billing/dashboard/stats', (req, res) => BillingDashboardController.getBillingStats(req, res));
router.post('/billing/dashboard/toggle-auto-isolate', (req, res) => BillingDashboardController.toggleAutoIsolate(req, res));
router.post('/billing/dashboard/toggle-auto-restore', (req, res) => BillingDashboardController.toggleAutoRestore(req, res));
router.post('/billing/dashboard/bulk-isolate', (req, res) => BillingDashboardController.bulkIsolate(req, res));
router.post('/billing/dashboard/bulk-restore', (req, res) => BillingDashboardController.bulkRestore(req, res));
router.post('/billing/dashboard/process-payment', (req, res) => BillingDashboardController.processPayment(req, res));
router.get('/billing/dashboard/search-customers', (req, res) => BillingDashboardController.searchCustomers(req, res));
router.post('/billing/dashboard/send-notifications', (req, res) => BillingDashboardController.sendBulkNotifications(req, res));

// Legacy billing routes (keeping for compatibility)
// router.get('/billing/management', (req, res) => res.render('billing/management', { title: 'Management Billing' })); // OLD - replaced with billing domain dashboard

// About routes
router.get('/about', getAboutPage);
router.get('/about/check-updates', checkUpdates);
router.get('/about/check-hotfix', checkHotfix);
router.post('/about/update', updateAppVersion);
router.post('/about/apply-hotfix', applyHotfixUpdate);
router.post('/about/update-settings', updateSettings);
router.get('/about/update-history', getUpdateHistoryPage);

// Database Management routes
router.get('/database/management', getDatabaseManagement);
router.post('/database/fix', fixDatabaseIssues);
router.post('/database/migrate', runDatabaseMigration);
router.post('/database/migrate/late-payment-tracking', runLatePaymentTrackingMigration);
router.get('/database/logs', getDatabaseLogs);

// Backup & Restore routes
const backupController = new BackupController();
const backupUpload = multer({
    dest: 'uploads/backups/',
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.sql') || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('File harus berformat .sql atau .zip'));
        }
    }
});

router.get('/backup', backupController.getBackupPage);
router.post('/backup/database', backupController.createDatabaseBackup);
router.post('/backup/source', backupController.createSourceBackup);
router.post('/backup/full', backupController.createFullBackup);
router.post('/backup/restore', backupController.restoreDatabase);
router.post('/backup/delete', backupController.deleteBackup);
router.get('/backup/download/:filename', backupController.downloadBackup);
router.post('/backup/upload', backupUpload.single('backupFile'), backupController.uploadAndRestore);
router.get('/api/backup/list', backupController.getBackupsAPI);
router.get('/api/backup/stats', backupController.getStatsAPI);





// Monitoring

// Customer Portal Routes
router.get('/portal', (req, res) => res.render('customer-portal/index', { title: 'Portal Pelanggan' }));

// SLA API Routes - Commented out due to missing SLAController
// router.get('/api/sla/configurations', SLAController.getConfigurations);
// router.get('/api/sla/configurations/:id', SLAController.getConfigurationById);
// router.post('/api/sla/configurations', SLAController.createConfiguration);
// router.put('/api/sla/configurations/:id', SLAController.updateConfiguration);
// router.delete('/api/sla/configurations/:id', SLAController.deleteConfiguration);

// router.post('/api/sla/assignments', SLAController.assignSLAToCustomer);
// router.get('/api/sla/customers/:customerId', SLAController.getCustomerSLA);


// router.post('/api/sla/reports/generate', SLAController.generateMonthlyReport);
// router.get('/api/sla/reports', SLAController.getMonthlyReports);
// router.put('/api/sla/reports/:reportId/approve', SLAController.approveMonthlyReport);
// router.put('/api/sla/reports/:reportId/reject', SLAController.rejectMonthlyReport);

// router.get('/api/sla/alerts/pending', SLAController.getPendingAlerts);
// router.put('/api/sla/alerts/:alertId/sent', SLAController.markAlertAsSent);

// SLA Dashboard Routes - Commented out due to missing SLADashboardController
// router.get('/api/sla/dashboard', SLADashboardController.getDashboard);
// router.get('/api/sla/stats', SLADashboardController.getStats);
// router.post('/api/sla/reports/generate-all', SLADashboardController.generateMonthlyReports);
// router.get('/api/sla/customers/:customerId', SLADashboardController.getCustomerSLA);
// router.post('/api/sla/customers/:customerId/assign', SLADashboardController.assignSLAToCustomer);
// router.get('/api/sla/customers/:customerId/incidents', SLADashboardController.getCustomerIncidents);





// Debug: Quick check customers table connectivity and sample
router.get('/api/debug/customers/check', async (req, res) => {
    try {
        const conn = await databasePool.getConnection();
        try {
            const [countRows] = await conn.query(`SELECT COUNT(*) as total FROM customers`);
            const total = (countRows as any[])[0]?.total ?? 0;
            const [sampleRows] = await conn.query(`SELECT id, name, phone FROM customers ORDER BY id DESC LIMIT 10`);
            res.json({
                success: true,
                data: {
                    total,
                    sample: sampleRows
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error checking customers table:', error);
        res.status(500).json({ success: false, error: 'Failed to check customers' });
    }
});









// Test Integration Routes - Commented out due to missing functions
// router.get('/api/test/mikrotik', testMikrotikConnection);
// router.get('/api/test/connections', testConnectionMonitoring);
// router.get('/api/test/scheduler', getSchedulerStatus);





// Payment Gateway - Commented out until functions are implemented
// router.get('/settings/payment-gateway', getPaymentGatewaySettings);
// router.post('/settings/payment-gateway', postPaymentGatewayCreate);
// router.post('/settings/payment-gateway/:id', postPaymentGatewayUpdate);
// router.post('/settings/payment-gateway/test', postPaymentGatewayTest);




// Initialize new controllers (must be before routes that use them)
const wsService = (global as any).wsService;
const reportingController = new ReportingController(databasePool);
const bulkOperationsController = new BulkOperationsController(databasePool, wsService);

// Bulk Operations Routes
router.post('/api/bulk/ont/toggle-status', (req, res) => bulkOperationsController.bulkToggleONTStatus(req, res));
router.post('/api/bulk/ont/sync', (req, res) => bulkOperationsController.bulkSyncONTs(req, res));
router.post('/api/bulk/ont/update-info', (req, res) => bulkOperationsController.bulkUpdateONTInfo(req, res));
router.post('/api/bulk/ont/assign', (req, res) => bulkOperationsController.bulkAssignONTs(req, res));
router.post('/api/bulk/ont/unassign', (req, res) => bulkOperationsController.bulkUnassignONTs(req, res));
router.get('/api/bulk/operations/history', (req, res) => bulkOperationsController.getBulkOperationHistory(req, res));

// Monitoring Page - Duplicate route removed (already defined above)


// Bulk Operations Page
router.get('/ftth/bulk', (req, res) => res.render('ftth/bulk', { title: 'Bulk Operations' }));

// Real-time Monitoring Routes


// Reporting & Analytics Routes
router.get('/api/reports/dashboard', (req, res) => reportingController.getDashboardAnalytics(req, res));
router.get('/api/reports/ont-performance', (req, res) => reportingController.getONTPerformanceReport(req, res));
router.get('/api/reports/billing-analytics', (req, res) => reportingController.getBillingAnalyticsReport(req, res));
router.get('/api/reports/pon-utilization', (req, res) => reportingController.getPONUtilizationReport(req, res));
router.get('/api/reports/customer-analytics', (req, res) => reportingController.getCustomerAnalyticsReport(req, res));
router.get('/api/reports/export', (req, res) => reportingController.exportReport(req, res));


// Bulk Operations Routes
router.post('/api/bulk/ont-status', (req, res) => bulkOperationsController.bulkToggleONTStatus(req, res));
router.post('/api/bulk/ont-assignment', (req, res) => bulkOperationsController.bulkAssignONTs(req, res));
router.post('/api/bulk/ont-unassign', (req, res) => bulkOperationsController.bulkUnassignONTs(req, res));
router.post('/api/bulk/ont-update-info', (req, res) => bulkOperationsController.bulkUpdateONTInfo(req, res));
router.post('/api/bulk/ont-sync', (req, res) => bulkOperationsController.bulkSyncONTs(req, res));
router.get('/api/bulk/history', (req, res) => bulkOperationsController.getBulkOperationHistory(req, res));

// Initialize Kasir Controller
const kasirController = new KasirController();

// Kasir Routes - handled by kasir.ts



// Billing Invoice Routes - Commented out due to missing functions
// router.get('/billing/invoices', getInvoiceList);
// Place generate route BEFORE any nested routes (ODC print or invoice detail)
// router.get('/billing/invoices/generate', getInvoiceGenerate);
// Place batch-print route BEFORE any nested routes - Commented out due to missing functions
// router.get('/billing/invoices/batch-print', getInvoiceBatchPrint);
// router.post('/billing/invoices/bulk-delete', postInvoiceBulkDelete);

// Billing Tagihan Routes - COMMENTED OUT to prevent route conflicts
// Routes are already registered via billingRoutes at line 152: router.use('/billing', billingRoutes);
// import { getBillingDashboard, getTagihanList, getTagihanDetail, updateTagihanStatus } from '../controllers/billingController';
// router.get('/billing', getBillingDashboard);
// router.get('/billing/tagihan', getTagihanList);
// router.get('/billing/tagihan/:id', getTagihanDetail);
// router.put('/billing/tagihan/:id/status', updateTagihanStatus);

// Import and use ODC print routes first (more specific) - Commented out due to missing file
// import odcPrintRoutes from './billing/odcPrintRoutes';
// router.use('/billing/invoices', odcPrintRoutes);

// Import and use invoice detail routes (catch-all for /:id) - Commented out due to missing file
// import invoiceDetailRoutes from './billing/invoiceDetailRoutes';
// import { InvoiceDetailController } from '../controllers/billing/invoiceDetailController';
// router.use('/billing/invoices', invoiceDetailRoutes);

// All routes with :id parameter must come AFTER middleware routes to avoid conflicts
// Removed create invoice routes - replaced with ODC print system
// router.get('/billing/invoices/:id', getInvoiceDetail); // Moved to invoiceDetailRoutes
// These routes are now handled by invoiceDetailRoutes middleware
// router.get('/billing/invoices/:id/print', getInvoicePrint);
// router.get('/billing/invoices/:id/print-thermal', getInvoicePrintThermal);
// router.post('/billing/invoices/:id/send-wa', postInvoiceSendWhatsapp);
// router.post('/billing/invoices/:id/mark-sent', postInvoiceMarkSent);
// router.post('/billing/invoices/:id/delete', deleteInvoice);
// router.post('/billing/invoices/:id/partial-payment', InvoiceDetailController.postPartialPayment);

// Customer isolation routes
router.get('/billing/customers/isolate', (req, res) => {
    res.render('billing/customers/isolate', {
        title: 'Isolir Customer - Billing System',
        currentPath: req.path
    });
});
// router.post('/billing/customers/:id/isolate', isolateCustomer);
// router.post('/billing/customers/:id/unisolate', unisolateCustomer);

// Billing Payments Routes
router.get('/billing/payments', (req, res) => {
    res.render('billing/payments/dashboard', {
        title: 'Pembayaran Billing',
        currentPath: req.path
    });
});

// Billing Reports Routes
router.get('/billing/reports', (req, res) => {
    res.render('billing/reports/dashboard', {
        title: 'Laporan Billing',
        currentPath: req.path
    });
});

// Billing Scheduler Routes - DISABLED (controller not imported)
// router.get('/billing/scheduler', getSchedulerDashboard);
// router.get('/billing/scheduler/status', getSchedulerStatus);
// router.post('/billing/scheduler/init', postInitializeScheduler);
// router.post('/billing/scheduler/trigger-isolation', postTriggerAutoIsolation);
// router.post('/billing/scheduler/trigger-restore', postTriggerAutoRestore);
// router.post('/billing/scheduler/settings/auto-isolation', postUpdateAutoIsolationSchedule);
// router.post('/billing/scheduler/settings/invoice', postUpdateInvoiceSchedule);
// router.post('/billing/scheduler/settings/notifications', postUpdateNotificationSettings);
// router.get('/billing/scheduler/settings', getSchedulerSettings);

// SLA Monitoring Routes (integrated with billing) - DISABLED (controller not imported)
// router.get('/billing/sla', getSlaDashboard);
// router.get('/billing/sla/incidents', getSlaIncidents);
// router.post('/billing/sla/incidents/:id/apply', postApplySlaCompensation); // Function not implemented yet
// router.get('/billing/sla/policies', getSlaPolicies); // Function not implemented yet
// router.post('/billing/sla/policies', postCreateSlaPolicy); // Function not implemented yet
// router.put('/billing/sla/policies/:id', putUpdateSlaPolicy); // Function not implemented yet
// router.get('/billing/sla/statistics', getSlaStatistics); // Function not implemented yet

// Billing Accounting Routes - DISABLED (controller not imported)
// import { AccountingController } from '../controllers/billing/accountingController';
// router.get('/billing/accounting', AccountingController.getAccountingDashboard);
// router.get('/billing/accounting/chart-of-accounts', AccountingController.getChartOfAccounts);
// router.post('/billing/accounting/chart-of-accounts', AccountingController.postCreateAccount);
// router.get('/billing/accounting/journal-entries', AccountingController.getJournalEntries);
// router.get('/billing/accounting/journal-entries/:id', AccountingController.getJournalEntryDetails);
// router.get('/billing/accounting/trial-balance', AccountingController.getTrialBalance);
// router.get('/billing/accounting/profit-loss', AccountingController.getProfitLossStatement);
// router.get('/billing/accounting/balance-sheet', AccountingController.getBalanceSheet);
// router.get('/billing/accounting/export', AccountingController.exportReport);



// Machine Learning Routes - DISABLED (controller not imported)
// import { MachineLearningController } from '../controllers/billing/machineLearningController';
// router.get('/billing/ml', MachineLearningController.getMLDashboard);
// router.get('/billing/ml/models', MachineLearningController.getMLModels);
// router.post('/billing/ml/fraud-detection/test', MachineLearningController.testFraudDetection);
// router.post('/billing/ml/anomaly-detection/test', MachineLearningController.testAnomalyDetection);
// router.post('/billing/ml/sentiment-analysis/test', MachineLearningController.testSentimentAnalysis);
// router.post('/billing/ml/intent-recognition/test', MachineLearningController.testIntentRecognition);
// router.get('/billing/ml/analysis-results', MachineLearningController.getAnalysisResults);
// router.post('/billing/ml/train', MachineLearningController.trainModel);
// router.post('/billing/ml/update-accuracy', MachineLearningController.updateModelAccuracy);
// router.get('/billing/ml/performance', MachineLearningController.getModelPerformance);
// router.get('/billing/ml/test-interface', MachineLearningController.getMLTestInterface);
// router.post('/billing/ml/batch-analysis', MachineLearningController.batchAnalysis);
// router.get('/billing/ml/export', MachineLearningController.exportAnalysisResults);


// Payment Gateway Routes
router.use('/payment', paymentRoutes);

// Auth Routes
router.use('/', authRoutes);

// Kasir Routes
router.use('/kasir', kasirRoutes);

// Address List Routes
router.use('/address-list', addressListRoutes);

// ONT Routes - Must be after specific routes
// router.use('/ftth/ont', ontRoutes);

// Direct ONT Discovery Route
// router.post('/ftth/ont/discovery', OntDiscoveryController.discoverOnts);

// API untuk mendapatkan PON port berdasarkan OLT
router.get('/api/ftth/olt-slot/:oltId/ports', async (req, res) => {
    try {
        const oltId = parseInt(req.params.oltId);

        const [rows] = await databasePool.query(
            'SELECT port_name, status, ont_count, max_onts FROM olt_port_info WHERE olt_id = ? ORDER BY port_number',
            [oltId]
        );

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error getting PON ports:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting PON ports'
        });
    }
});

// Payment Dashboard Routes
router.get('/payment/dashboard', (req, res) => {
    res.render('payment/dashboard', {
        title: 'Payment Gateway Dashboard',
        currentPath: req.path
    });
});

router.get('/payment/status', (req, res) => {
    res.render('payment/status', {
        title: 'Status Pembayaran',
        currentPath: req.path
    });
});

// Billing Payment Routes
router.get('/billing/payment', (req, res) => {
    res.render('billing/payment', {
        title: 'Pembayaran Invoice',
        currentPath: req.path
    });
});



// Routes dengan parameter harus di bawah routes yang lebih spesifik
// Customer detail and edit routes - MUST be after migration routes but before generic /customers/:id routes
router.get('/customers/:id/edit', (req, res, next) => {
    console.log('[ROUTE] GET /customers/:id/edit - Customer ID:', req.params.id);
    getCustomerEdit(req, res, next);
});

// Migration endpoints - MUST be before generic /customers/:id routes

// DELETE route must be BEFORE GET route to ensure proper routing
router.delete('/customers/:id', authMiddleware.requireAuth.bind(authMiddleware), async (req, res) => {
    try {
        const { deleteCustomer } = await import('../controllers/customerController');
        return deleteCustomer(req as any, res as any);
    } catch (error) {
        console.error('Error in delete customer route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Ensure JSON response
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// POST/PUT/PATCH routes must be BEFORE GET route to avoid conflicts
router.post('/customers/:id', updateCustomer);
router.put('/customers/:id', updateCustomer);
router.patch('/customers/:id', updateCustomer);
router.get('/customers/:id', (req, res, next) => {
    console.log('[ROUTE] GET /customers/:id - Customer ID:', req.params.id);
    getCustomerDetail(req, res, next);
});
// router.post('/customers/:id/fix-prepaid', fixPrepaidCustomer); // COMMENTED OUT - not exported
// router.post('/prepaid/fix-all-customers', fixAllPrepaidCustomers); // COMMENTED OUT - not exported
// router.get('/customers/:id/debug-ip', debugCheckCustomerIP); // COMMENTED OUT - not exported
// router.get('/customers/:id/check', checkCustomerExists); // COMMENTED OUT - not exported
// router.get('/prepaid/customers/list', listPrepaidCustomers); // COMMENTED OUT - not exported
// router.get('/customers/search', searchCustomerByName); // COMMENTED OUT - not exported
// router.get('/quick-fix-ip', quickFixIP); // COMMENTED OUT - not exported
// router.get('/quick-fix-customer', quickFixCustomerByName); // COMMENTED OUT - not exported
// router.get('/quick-check-customer/:id', quickCheckCustomer); // COMMENTED OUT - not exported
router.get('/test-mikrotik-address-lists', testMikrotikAddressLists);
// router.post('/test/add-ip-to-list', testAddIPToAddressList); // COMMENTED OUT - not exported
// router.get('/customers/:id/migration-history', getMigrationHistory); // COMMENTED OUT - not exported

// Reset customer to postpaid (useful for testing/support)
router.get('/test/reset-to-postpaid/:customerId', async (req, res) => {
    try {
        const customerId = parseInt(req.params.customerId);
        if (!customerId || isNaN(customerId)) {
            return res.json({ success: false, error: 'Invalid customer ID' });
        }

        console.log(`\n🧪 Resetting customer ${customerId} to postpaid...`);

        // Get customer data first to get IP and connection type
        const [customers] = await databasePool.query<RowDataPacket[]>(
            'SELECT id, name, connection_type FROM customers WHERE id = ?',
            [customerId]
        );

        if (customers.length === 0) {
            return res.json({ success: false, error: 'Customer tidak ditemukan' });
        }

        const customer = customers[0];

        // Get customer IP if static IP
        let ipAddress = null;
        if (customer.connection_type === 'static_ip') {
            const [staticIPs] = await databasePool.query<RowDataPacket[]>(
                'SELECT ip_address FROM static_ip_clients WHERE customer_id = ? LIMIT 1',
                [customerId]
            );
            if (staticIPs.length > 0) {
                // Calculate IP from CIDR if needed (/30 subnet)
                const rawIP = staticIPs[0].ip_address;

                // Helper function to calculate customer IP
                const calculateCustomerIP = (cidrAddress: string): string => {
                    try {
                        const [ipPart, prefixStr] = cidrAddress.split('/');
                        const prefix = prefixStr ? parseInt(prefixStr, 10) : 0;

                        // For /30 subnet: network, gateway (.1), customer (.2), broadcast
                        if (prefix === 30) {
                            const ipToInt = (ip: string): number => {
                                return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
                            };

                            const intToIp = (int: number): string => {
                                return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                            };

                            const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
                            const networkInt = ipToInt(ipPart) & mask;
                            const firstHost = networkInt + 1;  // Gateway
                            const secondHost = networkInt + 2; // Customer
                            const ipInt = ipToInt(ipPart);

                            if (ipInt === firstHost) {
                                return intToIp(secondHost);
                            } else if (ipInt === secondHost) {
                                return ipPart;
                            } else {
                                return intToIp(secondHost);
                            }
                        }

                        return ipPart; // No CIDR or not /30
                    } catch (e) {
                        return cidrAddress.split('/')[0]; // Fallback to IP part only
                    }
                };

                ipAddress = calculateCustomerIP(rawIP);
                console.log(`🧪 IP calculated: ${rawIP} -> ${ipAddress}`);
            }
        }

        // Remove from prepaid address lists if IP exists
        if (ipAddress) {
            console.log(`🧪 Removing IP ${ipAddress} from prepaid address lists...`);
            try {
                const getMikrotikConfig = (await import('../utils/mikrotikConfigHelper')).getMikrotikConfig;
                const settings = await getMikrotikConfig();

                if (settings) {
                    const MikrotikAddressListService = (await import('../services/mikrotik/MikrotikAddressListService')).default;
                    const addressListService = new MikrotikAddressListService({
                        host: settings.host,
                        port: Number(settings.port || 8728),
                        username: settings.username,
                        password: settings.password
                    });

                    // Remove from all prepaid lists
                    await addressListService.removeFromAddressList('prepaid-no-package', ipAddress);
                    await addressListService.removeFromAddressList('prepaid-active', ipAddress);
                    console.log(`✅ IP removed from prepaid address lists`);
                }
            } catch (addrError) {
                console.warn(`⚠️ Failed to remove from address list (non-critical):`, addrError);
            }
        }

        // Update database
        await databasePool.query('UPDATE customers SET billing_mode = ? WHERE id = ?', ['postpaid', customerId]);
        await databasePool.query('UPDATE customers SET is_isolated = ? WHERE id = ?', [0, customerId]);

        console.log(`✅ Customer ${customerId} reset to postpaid`);

        res.json({
            success: true,
            message: `Customer ${customerId} reset to postpaid - ready for testing`
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('🧪 Reset error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// DELETE route must be before GET route to ensure proper routing
// Quick fix endpoint for SLA views
router.get('/fix-sla-views', async (req, res) => {
    try {
        const connection = await databasePool.getConnection();

        try {
            // Drop old tables first to avoid conflicts
            await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);
            await connection.query(`DROP TABLE IF EXISTS sla_incidents`);
            await connection.query(`DROP TABLE IF EXISTS sla_records`);
            await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);

            // Create sla_incidents table with correct structure
            await connection.query(`
                CREATE TABLE sla_incidents (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    customer_id INT NOT NULL,
                    service_type ENUM('pppoe', 'static_ip') NOT NULL DEFAULT 'pppoe',
                    incident_type ENUM('downtime', 'degraded', 'maintenance') NOT NULL DEFAULT 'downtime',
                    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP NULL,
                    duration_minutes INT DEFAULT 0,
                    status ENUM('ongoing', 'resolved', 'excluded') DEFAULT 'ongoing',
                    exclude_reason ENUM('maintenance', 'force_majeure', 'customer_fault', 'transient', 'isolated') NULL,
                    exclude_notes TEXT NULL,
                    is_counted_in_sla BOOLEAN DEFAULT 1,
                    technician_id INT NULL,
                    resolved_by INT NULL,
                    alert_sent_telegram BOOLEAN DEFAULT 0,
                    alert_sent_whatsapp BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP NULL,
                    INDEX idx_customer (customer_id),
                    INDEX idx_status (status),
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);

            // Create v_active_incidents view
            await connection.query(`
                CREATE OR REPLACE VIEW v_active_incidents AS
                SELECT 
                    si.id AS incident_id,
                    si.customer_id,
                    c.name AS customer_name,
                    c.area,
                    COALESCE(c.odc_location, '') AS odc_location,
                    si.service_type,
                    si.start_time,
                    si.duration_minutes,
                    si.incident_type,
                    si.status,
                    NULL AS technician_name,
                    NULL AS technician_chat_id,
                    si.alert_sent_telegram,
                    si.alert_sent_whatsapp
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                WHERE si.status = 'ongoing'
                ORDER BY si.duration_minutes DESC, si.start_time ASC
            `);

            // Create sla_records table with correct structure
            await connection.query(`
                CREATE TABLE sla_records (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    customer_id INT NOT NULL,
                    month_year DATE NOT NULL,
                    total_minutes INT DEFAULT 43200,
                    downtime_minutes INT DEFAULT 0,
                    sla_percentage DECIMAL(5,2) DEFAULT 100.00,
                    sla_status ENUM('met', 'breach', 'warning') DEFAULT 'met',
                    incident_count INT DEFAULT 0,
                    discount_amount DECIMAL(15,2) DEFAULT 0.00,
                    discount_approved BOOLEAN DEFAULT 0,
                    UNIQUE KEY uk_customer_month (customer_id, month_year),
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);

            // Create other views
            await connection.query(`
                CREATE OR REPLACE VIEW v_monthly_sla_summary AS
                SELECT 
                    sr.month_year,
                    COUNT(DISTINCT sr.customer_id) AS total_customers,
                    SUM(CASE WHEN sr.sla_status = 'met' THEN 1 ELSE 0 END) AS customers_met_sla,
                    SUM(CASE WHEN sr.sla_status = 'breach' THEN 1 ELSE 0 END) AS customers_breach_sla,
                    ROUND(AVG(sr.sla_percentage), 2) AS avg_sla_percentage,
                    SUM(sr.incident_count) AS total_incidents,
                    SUM(sr.downtime_minutes) AS total_downtime_minutes,
                    SUM(sr.discount_amount) AS total_discount_amount
                FROM sla_records sr
                GROUP BY sr.month_year
                ORDER BY sr.month_year DESC
            `);

            connection.release();

            res.send(`
                <html>
                <head>
                    <title>SLA Views Fixed</title>
                    <style>
                        body { font-family: Arial; padding: 40px; background: #f5f5f5; }
                        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 5px; }
                        .info { margin-top: 20px; padding: 15px; background: white; border-radius: 5px; }
                        a { color: #007bff; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="success">
                        <h2>✅ SLA Views Berhasil Diperbaiki!</h2>
                        <p>View <code>v_active_incidents</code> dan tabel pendukung telah dibuat.</p>
                    </div>
                    <div class="info">
                        <h3>Yang telah dibuat:</h3>
                        <ul>
                            <li>✓ Tabel <code>sla_incidents</code></li>
                            <li>✓ Tabel <code>sla_records</code></li>
                            <li>✓ View <code>v_active_incidents</code></li>
                            <li>✓ View <code>v_monthly_sla_summary</code></li>
                        </ul>
                        <p><a href="/monitoring/sla">→ Buka SLA Dashboard</a></p>
                        <p><a href="/">← Kembali ke Dashboard</a></p>
                    </div>
                </body>
                </html>
            `);

        } catch (err) {
            connection.release();
            throw err;
        }

    } catch (error) {
        console.error('Error fixing SLA views:', error);
        res.status(500).send(`
            <html>
            <head>
                <title>Error</title>
                <style>
                    body { font-family: Arial; padding: 40px; background: #f5f5f5; }
                    .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 20px; border-radius: 5px; }
                    pre { background: white; padding: 10px; overflow: auto; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>❌ Error</h2>
                    <p>Gagal memperbaiki SLA views:</p>
                    <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
                    <p><a href="/">← Kembali ke Dashboard</a></p>
                </div>
            </body>
            </html>
        `);
    }
});

export default router;


