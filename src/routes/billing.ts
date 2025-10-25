import { Router } from 'express';
import { InvoiceController } from '../controllers/billing/invoiceController';
import { PaymentController } from '../controllers/billing/paymentController';
import { BillingPaymentController } from '../controllers/payment/BillingPaymentController';
import { InvoiceSchedulerService } from '../services/billing/invoiceSchedulerService';

const router = Router();
const invoiceController = new InvoiceController();
const paymentController = new PaymentController();
const gatewayController = new BillingPaymentController();

// ========================================
// BILLING DASHBOARD
// ========================================
router.get('/dashboard', async (req, res) => {
    try {
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            // Get invoice statistics
            const [totalInvoices] = await conn.query(
                'SELECT COUNT(*) as count FROM invoices'
            ) as any;
            
            const [paidInvoices] = await conn.query(
                "SELECT COUNT(*) as count FROM invoices WHERE status = 'paid'"
            ) as any;
            
            const [unpaidInvoices] = await conn.query(
                "SELECT COUNT(*) as count FROM invoices WHERE status IN ('draft', 'sent', 'partial')"
            ) as any;
            
            const [overdueInvoices] = await conn.query(
                "SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status IN ('draft', 'sent', 'partial') AND due_date < NOW())"
            ) as any;
            
            // Get revenue statistics
            const [totalRevenue] = await conn.query(
                "SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE status = 'paid'"
            ) as any;
            
            const [monthlyRevenue] = await conn.query(
                "SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE status = 'paid' AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())"
            ) as any;
            
            const stats = {
                totalInvoices: totalInvoices[0].count || 0,
                paidInvoices: paidInvoices[0].count || 0,
                unpaidInvoices: unpaidInvoices[0].count || 0,
                overdueInvoices: overdueInvoices[0].count || 0,
                totalRevenue: totalRevenue[0].total || 0,
                monthlyRevenue: monthlyRevenue[0].total || 0
            };
            
            res.render('billing/dashboard', { 
                title: 'Dashboard Billing',
                stats
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading billing dashboard:', error);
        res.status(500).render('error', {
            title: 'Error',
            status: 500,
            message: 'Failed to load billing dashboard'
        });
    }
});

// ========================================
// INVOICE / TAGIHAN ROUTES
// ========================================

// List all invoices
router.get('/invoices', invoiceController.getInvoiceList.bind(invoiceController));
router.get('/tagihan', invoiceController.getInvoiceList.bind(invoiceController));

// Create manual invoice
router.get('/tagihan/create/manual', async (req, res) => {
    res.render('billing/tagihan-create', { title: 'Buat Tagihan Manual' });
});

router.post('/tagihan/create/manual', invoiceController.createManualInvoice.bind(invoiceController));

// Generate bulk invoices (automatic monthly)
router.post('/tagihan/generate-bulk', invoiceController.generateBulkInvoices.bind(invoiceController));

// Bulk delete invoices
router.post('/tagihan/bulk-delete', async (req, res) => {
    try {
        const { invoiceIds } = req.body;
        
        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No invoices selected' });
        }

        const { InvoiceService } = await import('../services/billing/invoiceService');
        const result = await InvoiceService.bulkDeleteInvoices(invoiceIds.map(id => parseInt(id)));

        res.json({
            success: true,
            message: `Deleted ${result.deleted} invoices`,
            deleted: result.deleted,
            failed: result.failed,
            errors: result.errors
        });
    } catch (error: any) {
        console.error('Error bulk deleting invoices:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete invoices'
        });
    }
});

// Print invoices by ODC area
router.get('/tagihan/print-odc/:odc_id', async (req, res) => {
    try {
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            const { odc_id } = req.params;
            const { period, format } = req.query;
            
            // Get ODC info
            const [odcResult] = await conn.query(
                'SELECT * FROM ftth_odc WHERE id = ?',
                [odc_id]
            ) as any;
            
            if (odcResult.length === 0) {
                return res.status(404).send('ODC not found');
            }
            
            const odc = odcResult[0];
            
            // Build query for invoices with status filter for pending only
            let invoicesQuery = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.customer_id,
                    i.period,
                    i.due_date,
                    i.total_amount,
                    i.paid_amount,
                    i.status,
                    i.created_at,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code
                FROM invoices i
                INNER JOIN customers c ON i.customer_id = c.id
                WHERE c.odc_id = ?
                AND i.status IN ('sent', 'partial', 'overdue')
            `;
            
            const queryParams: any[] = [odc_id];
            
            if (period) {
                invoicesQuery += ' AND i.period = ?';
                queryParams.push(period);
            }
            
            invoicesQuery += ' ORDER BY c.name ASC';
            
            const [invoices] = await conn.query(invoicesQuery, queryParams) as any;
            
            // Choose view based on format parameter
            const viewName = format === 'thermal' 
                ? 'billing/tagihan-print-odc' 
                : 'billing/tagihan-print-odc-a4';
            
            res.render(viewName, {
                title: `Print Tagihan Area ${odc.name}`,
                odc,
                invoices,
                period: period || 'Semua Periode',
                format: format || 'thermal'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading ODC print:', error);
        res.status(500).send('Error loading ODC invoices');
    }
});

// Print all invoices
router.get('/tagihan/print-all', async (req, res) => {
    try {
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            const { status, odc_id, search, period, format } = req.query;
            
            // Build query - default to pending invoices
            let query = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.customer_id,
                    i.period,
                    i.due_date,
                    i.total_amount,
                    i.paid_amount,
                    i.status,
                    i.created_at,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code,
                    c.odc_id,
                    o.name as odc_name,
                    o.location as odc_location
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE i.status IN ('sent', 'partial', 'overdue')
            `;
            
            const queryParams: any[] = [];
            
            if (status) {
                // Override default status filter if specified
                query = query.replace("WHERE i.status IN ('sent', 'partial', 'overdue')", 'WHERE i.status = ?');
                queryParams.push(status);
            }
            
            if (odc_id) {
                query += ' AND c.odc_id = ?';
                queryParams.push(odc_id);
            }
            
            if (search) {
                query += ` AND (
                    c.name LIKE ? OR 
                    c.phone LIKE ? OR 
                    i.invoice_number LIKE ?
                )`;
                const searchParam = `%${search}%`;
                queryParams.push(searchParam, searchParam, searchParam);
            }
            
            if (period) {
                query += ' AND i.period = ?';
                queryParams.push(period);
            }
            
            query += ' ORDER BY o.name ASC, c.name ASC';
            
            const [invoices] = await conn.query(query, queryParams) as any;
            
            // Choose view based on format parameter
            const viewName = format === 'thermal' 
                ? 'billing/tagihan-print-all' 
                : 'billing/tagihan-print-all-a4';
            
            res.render(viewName, {
                title: 'Print Semua Tagihan',
                invoices,
                filters: { status, odc_id, search, period },
                format: format || 'thermal'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading print all invoices:', error);
        res.status(500).send('Error loading invoices');
    }
});

// Export invoices to PDF
router.get('/tagihan/export/pdf', async (req, res) => {
    try {
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            const { status, odc_id, search, period } = req.query;
            
            // Build query
            let query = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code,
                    c.odc_id,
                    o.name as odc_name,
                    o.location as odc_location
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE 1=1
            `;
            
            const queryParams: any[] = [];
            
            if (status) {
                query += ' AND i.status = ?';
                queryParams.push(status);
            }
            
            if (odc_id) {
                query += ' AND c.odc_id = ?';
                queryParams.push(odc_id);
            }
            
            if (search) {
                query += ` AND (
                    c.name LIKE ? OR 
                    c.phone LIKE ? OR 
                    i.invoice_number LIKE ?
                )`;
                const searchParam = `%${search}%`;
                queryParams.push(searchParam, searchParam, searchParam);
            }
            
            if (period) {
                query += ' AND i.period = ?';
                queryParams.push(period);
            }
            
            query += ' ORDER BY i.created_at DESC';
            
            const [invoices] = await conn.query(query, queryParams) as any;
            
            // Calculate statistics
            const stats = {
                total: invoices.length,
                paid: invoices.filter((inv: any) => inv.status === 'paid').length,
                unpaid: invoices.filter((inv: any) => ['draft', 'sent', 'partial'].includes(inv.status)).length,
                overdue: invoices.filter((inv: any) => inv.status === 'overdue').length,
                totalAmount: invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total_amount || 0), 0),
                paidAmount: invoices.filter((inv: any) => inv.status === 'paid').reduce((sum: number, inv: any) => sum + parseFloat(inv.paid_amount || 0), 0),
                unpaidAmount: invoices.filter((inv: any) => inv.status !== 'paid').reduce((sum: number, inv: any) => sum + parseFloat(inv.total_amount || 0) - parseFloat(inv.paid_amount || 0), 0)
            };
            
            res.render('billing/tagihan-export-pdf', {
                title: 'Export Tagihan ke PDF',
                invoices,
                stats,
                filters: { status, odc_id, search, period },
                exportDate: new Date()
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error exporting invoices to PDF:', error);
        res.status(500).send('Error exporting invoices');
    }
});

// Update invoice status
router.post('/tagihan/:id/status', invoiceController.updateInvoiceStatus.bind(invoiceController));

// Print invoice (A4)
router.get('/tagihan/:id/print', async (req, res) => {
    try {
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            // Get invoice with customer info
            const [invoices] = await conn.query(
                `SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.customer_code
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?`,
                [req.params.id]
            ) as any;
            
            if (invoices.length === 0) {
                return res.status(404).send('Invoice not found');
            }
            
            const invoice = invoices[0];
            
            // Get invoice items
            const [items] = await conn.query(
                'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
                [req.params.id]
            ) as any;
            
            res.render('billing/tagihan-print', {
                title: `Print Invoice ${invoice.invoice_number}`,
                invoice,
                items
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading print invoice:', error);
        res.status(500).send('Error loading invoice');
    }
});

// Print invoice (Thermal)
router.get('/tagihan/:id/print-thermal', async (req, res) => {
    try {
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            // Get invoice with customer info
            const [invoices] = await conn.query(
                `SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.customer_code
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?`,
                [req.params.id]
            ) as any;
            
            if (invoices.length === 0) {
                return res.status(404).send('Invoice not found');
            }
            
            const invoice = invoices[0];
            
            // Get invoice items
            const [items] = await conn.query(
                'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
                [req.params.id]
            ) as any;
            
            res.render('billing/tagihan-print-thermal', {
                title: `Print Thermal ${invoice.invoice_number}`,
                invoice,
                items
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading thermal print invoice:', error);
        res.status(500).send('Error loading invoice');
    }
});

// Send invoice via WhatsApp
router.post('/tagihan/:id/send-whatsapp', invoiceController.sendInvoiceWhatsApp.bind(invoiceController));

// Invoice detail (harus di akhir karena :id catch-all)
router.get('/tagihan/:id', invoiceController.getInvoiceDetail.bind(invoiceController));

// Delete invoice
router.delete('/tagihan/:id', invoiceController.deleteInvoice.bind(invoiceController));

// ========================================
// CUSTOMER ISOLATION / RESTORE
// ========================================

// Isolate customer
router.post('/customer/isolate', async (req, res) => {
    try {
        const { customerId, reason } = req.body;
        
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }

        const { IsolationService } = await import('../services/billing/isolationService');
        
        const isolationData = {
            customer_id: parseInt(customerId),
            action: 'isolate' as const,
            reason: reason || 'Manual isolation from billing system',
            performed_by: (req.session as any)?.user?.username || 'admin'
        };

        const success = await IsolationService.isolateCustomer(isolationData);

        if (success) {
            res.json({ 
                success: true, 
                message: 'Pelanggan berhasil diisolir'
            });
        } else {
            res.json({ 
                success: false, 
                message: 'Gagal mengisolir pelanggan. Periksa koneksi MikroTik.'
            });
        }
    } catch (error: any) {
        console.error('Error isolating customer:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Terjadi kesalahan saat mengisolir pelanggan'
        });
    }
});

// Restore customer
router.post('/customer/restore', async (req, res) => {
    try {
        const { customerId, reason } = req.body;
        
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }

        const { IsolationService } = await import('../services/billing/isolationService');
        
        const isolationData = {
            customer_id: parseInt(customerId),
            action: 'restore' as const,
            reason: reason || 'Manual restoration from billing system',
            performed_by: (req.session as any)?.user?.username || 'admin'
        };

        const success = await IsolationService.isolateCustomer(isolationData);

        if (success) {
            res.json({ 
                success: true, 
                message: 'Pelanggan berhasil dipulihkan'
            });
        } else {
            res.json({ 
                success: false, 
                message: 'Gagal memulihkan pelanggan. Periksa koneksi MikroTik.'
            });
        }
    } catch (error: any) {
        console.error('Error restoring customer:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Terjadi kesalahan saat memulihkan pelanggan'
        });
    }
});

// ========================================
// PAYMENT / PEMBAYARAN ROUTES
// ========================================

// Payment history
router.get('/payments', paymentController.getPaymentHistory.bind(paymentController));

// Payment history view
router.get('/payments/history', async (req, res) => {
    res.render('billing/payment-history', { title: 'Riwayat Pembayaran' });
});

// Payment detail
router.get('/payments/:id', async (req, res) => {
    // Will be implemented with PaymentController
    res.render('billing/payment-detail', { title: 'Detail Pembayaran' });
});

// Create payment form
router.get('/tagihan/:invoiceId/pay', async (req, res) => {
    try {
        console.log('[Payment Form] Loading for invoice ID:', req.params.invoiceId);
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            console.log('[Payment Form] Fetching invoice data...');
            const [invoices] = await conn.query(
                'SELECT i.*, c.id as customer_id, c.connection_type, c.custom_sla_target FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?', 
                [req.params.invoiceId]
            ) as any;
            
            if (invoices.length === 0) {
                console.log('[Payment Form] Invoice not found');
                return res.status(404).send('Invoice not found');
            }
            
            const invoice = invoices[0];
            console.log('[Payment Form] Invoice found:', invoice.id, 'for customer:', invoice.customer_id);
            
            // Get SLA target from customer or package
            let slaTarget = 90.0; // Default fallback
            console.log('[Payment Form] Getting SLA target for customer:', invoice.customer_id);
            
            // Priority 1: Custom SLA target for this customer
            if (invoice.custom_sla_target && invoice.custom_sla_target > 0) {
                slaTarget = parseFloat(invoice.custom_sla_target);
                console.log('[Payment Form] Using custom SLA target:', slaTarget);
            } else {
                // Priority 2: SLA target from customer's package
                console.log('[Payment Form] Connection type:', invoice.connection_type);
                
                if (invoice.connection_type === 'pppoe') {
                    // Get package from subscriptions table
                    const [subscriptions] = await conn.query(`
                        SELECT package_id 
                        FROM subscriptions 
                        WHERE customer_id = ? AND status = 'active'
                        LIMIT 1
                    `, [invoice.customer_id]) as any;
                    
                    if (subscriptions.length > 0 && subscriptions[0].package_id) {
                        const [packages] = await conn.query(
                            'SELECT sla_target FROM pppoe_packages WHERE id = ? LIMIT 1',
                            [subscriptions[0].package_id]
                        ) as any;
                        if (packages.length > 0 && packages[0].sla_target) {
                            slaTarget = parseFloat(packages[0].sla_target);
                            console.log('[Payment Form] Using PPPoE package SLA target:', slaTarget);
                        }
                    }
                } else if (invoice.connection_type === 'static_ip') {
                    // Get package from static_ip_clients table
                    const [staticClients] = await conn.query(`
                        SELECT package_id 
                        FROM static_ip_clients 
                        WHERE customer_id = ?
                        LIMIT 1
                    `, [invoice.customer_id]) as any;
                    
                    if (staticClients.length > 0 && staticClients[0].package_id) {
                        const [packages] = await conn.query(
                            'SELECT sla_target FROM static_ip_packages WHERE id = ? LIMIT 1',
                            [staticClients[0].package_id]
                        ) as any;
                        if (packages.length > 0 && packages[0].sla_target) {
                            slaTarget = parseFloat(packages[0].sla_target);
                            console.log('[Payment Form] Using Static IP package SLA target:', slaTarget);
                        }
                    }
                }
                
                console.log('[Payment Form] Final SLA target:', slaTarget);
            }
            
            // Get SLA record for this customer and period
            let slaDiscount = null;
            if (invoice.customer_id && invoice.period) {
                const periodParts = invoice.period.split('-'); // Format: YYYY-MM
                const year = parseInt(periodParts[0]);
                const month = parseInt(periodParts[1]);
                
                // month_year format is first day of month (YYYY-MM-01)
                const monthYearStr = `${year}-${month.toString().padStart(2, '0')}-01`;
                
                const [slaRecords] = await conn.query(`
                    SELECT 
                        sla_percentage,
                        sla_status,
                        discount_amount,
                        downtime_minutes,
                        incident_count
                    FROM sla_records
                    WHERE customer_id = ? 
                    AND month_year = ?
                    LIMIT 1
                `, [invoice.customer_id, monthYearStr]) as any;
                
                if (slaRecords.length > 0) {
                    const slaRecord = slaRecords[0];
                    
                    // NEW FORMULA: Kompensasi = selisih antara target dan aktual
                    const uptimePercentage = parseFloat(slaRecord.sla_percentage) || 100;
                    const actualTarget = slaTarget; // Use dynamic SLA target
                    
                    let discountPercentage = 0;
                    let discountAmount = 0;
                    
                    // Hitung kompensasi jika uptime di bawah target
                    if (uptimePercentage < actualTarget) {
                        // Selisih = target - aktual
                        discountPercentage = actualTarget - uptimePercentage;
                        
                        // Cap maksimum 30%
                        if (discountPercentage > 30.0) {
                            discountPercentage = 30.0;
                        }
                        
                        // Calculate discount amount
                        discountAmount = slaRecord.discount_amount > 0 
                            ? parseFloat(slaRecord.discount_amount)
                            : (parseFloat(invoice.total_amount) * discountPercentage / 100);
                    }
                    
                    slaDiscount = {
                        uptime_percentage: uptimePercentage,
                        sla_target: actualTarget,
                        sla_met: uptimePercentage >= actualTarget,
                        discount_percentage: discountPercentage,
                        discount_amount: discountAmount,
                        total_downtime_minutes: slaRecord.downtime_minutes || 0,
                        incident_count: slaRecord.incident_count || 0,
                        applicable: discountPercentage > 0
                    };
                }
            }
            
            console.log('[Payment Form] Rendering view with SLA discount:', slaDiscount);
            res.render('billing/payment-form', { 
                title: 'Form Pembayaran',
                invoice,
                slaDiscount,
                user: req.user
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading payment form:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('Error details:', { message: errorMessage, stack: errorStack });
        res.status(500).send(`Internal Server Error: ${errorMessage}`);
    }
});

// Process payment via gateway
router.post('/payments/gateway', paymentController.processGatewayPayment.bind(paymentController));

// Process payment - FULL PAYMENT
router.post('/payments/full', paymentController.processFullPayment.bind(paymentController));

// Process payment - PARTIAL PAYMENT (pembayaran kurang)
router.post('/payments/partial', paymentController.processPartialPayment.bind(paymentController));

// Process payment - DEBT PAYMENT (hutang sepenuhnya)
router.post('/payments/debt', paymentController.processDebtPayment.bind(paymentController));

// Upload payment proof
router.post('/payments/:id/upload-proof', paymentController.uploadPaymentProof.bind(paymentController));

// Debt tracking
router.get('/debts', paymentController.getDebtTrackingList.bind(paymentController));

// Debt tracking view
router.get('/debts/view', async (req, res) => {
    res.render('billing/debt-tracking', { title: 'Pelacakan Hutang' });
});

// Debt detail
router.get('/debts/:id', async (req, res) => {
    // Will be implemented with PaymentController
    res.render('billing/debt-detail', { title: 'Detail Hutang' });
});

// Resolve debt
router.post('/debts/:id/resolve', paymentController.resolveDebt.bind(paymentController));

// ========================================
// PAYMENT GATEWAY INTEGRATION
// ========================================

// Create payment via gateway
router.post('/gateway/create-payment', gatewayController.createInvoicePayment.bind(gatewayController));

// Get invoice with payment options
router.get('/gateway/invoice/:invoiceId/customer/:customerId/options', 
    gatewayController.getInvoiceWithPaymentOptions.bind(gatewayController));

// Get available payment methods for customer
router.get('/gateway/customer/:customerId/payment-methods', 
    gatewayController.getAvailablePaymentMethods.bind(gatewayController));

// Create payment link
router.post('/gateway/invoice/:invoiceId/customer/:customerId/payment-link', 
    gatewayController.createPaymentLink.bind(gatewayController));

// Payment gateway callback (webhook)
router.post('/gateway/callback/:gateway', async (req, res) => {
    // TODO: Implement gateway-specific callback handlers
    console.log('Payment gateway callback received:', req.params.gateway, req.body);
    res.json({ success: true, message: 'Callback received' });
});

// Get customer payment history via gateway
router.get('/gateway/customer/:customerId/history', 
    gatewayController.getCustomerPaymentHistory.bind(gatewayController));

// Get payment statistics
router.get('/gateway/statistics', 
    gatewayController.getPaymentStatistics.bind(gatewayController));

// ========================================
// SUBSCRIPTION / LANGGANAN ROUTES
// ========================================

// Subscription list
router.get('/subscriptions', async (req, res) => {
    res.render('billing/subscriptions', { title: 'Daftar Langganan' });
});

// ========================================
// SCHEDULER ROUTES
// ========================================

// Scheduler settings
router.get('/scheduler/settings', async (req, res) => {
    try {
        // Get current scheduler settings
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            const [result] = await conn.query(`
                SELECT * FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `) as any;

            let settings = {
                auto_generate_enabled: true,
                generation_date: 1,
                generation_time: '01:00',
                cron_schedule: '0 1 1 * *',
                due_date_offset: 7,
                whatsapp_reminder_enabled: false,
                reminder_days_before: 3,
                auto_isolir_enabled: false,
                isolir_mode: 'fixed_date',
                isolir_date: 10,
                isolir_days_after_due: 1
            };

            if (result && result.length > 0) {
                const row = result[0];
                const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
                
                // Parse cron to get generation date and time
                const cronParts = (row.cron_schedule || '0 1 1 * *').split(' ');
                const generationDate = parseInt(cronParts[2]) || 1;
                const generationHour = (cronParts[1] || '1').padStart(2, '0');
                const generationMinute = (cronParts[0] || '0').padStart(2, '0');
                
                settings = {
                    auto_generate_enabled: row.is_enabled === 1,
                    generation_date: generationDate,
                    generation_time: `${generationHour}:${generationMinute}`,
                    cron_schedule: row.cron_schedule || '0 1 1 * *',
                    due_date_offset: config.due_date_offset || 7,
                    whatsapp_reminder_enabled: config.whatsapp_reminder_enabled || false,
                    reminder_days_before: config.reminder_days_before || 3,
                    auto_isolir_enabled: config.auto_isolir_enabled || false,
                    isolir_mode: config.isolir_mode || 'fixed_date',
                    isolir_date: config.isolir_date || 10,
                    isolir_days_after_due: config.isolir_days_after_due || 1
                };
            }

            res.render('billing/scheduler-settings', { 
                title: 'Pengaturan Scheduler & Otomasi',
                settings
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error loading scheduler settings:', error);
        // Render with default settings on error
        res.render('billing/scheduler-settings', { 
            title: 'Pengaturan Scheduler & Otomasi',
            settings: {
                auto_generate_enabled: true,
                generation_date: 1,
                generation_time: '01:00',
                cron_schedule: '0 1 1 * *',
                due_date_offset: 7,
                whatsapp_reminder_enabled: false,
                reminder_days_before: 3,
                auto_isolir_enabled: false,
                isolir_mode: 'fixed_date',
                isolir_date: 10,
                isolir_days_after_due: 1
            }
        });
    }
});

// Update invoice generation settings
router.post('/scheduler/settings', async (req, res) => {
    try {
        const { auto_generate_enabled, cron_schedule, due_date_offset, enable_due_date } = req.body;
        
        await InvoiceSchedulerService.updateSchedulerSettings({
            auto_generate_enabled: auto_generate_enabled === 'true' || auto_generate_enabled === true,
            cron_schedule,
            due_date_offset: parseInt(due_date_offset),
            enable_due_date: enable_due_date === 'true' || enable_due_date === true
        });
        
        res.json({ success: true, message: 'Pengaturan tagihan berhasil disimpan' });
    } catch (error: any) {
        console.error('Error updating scheduler settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update WhatsApp reminder settings
router.post('/scheduler/whatsapp-settings', async (req, res) => {
    try {
        const { whatsapp_reminder_enabled, reminder_days_before } = req.body;
        
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            // Get current config
            const [result] = await conn.query(`
                SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `) as any;
            
            let currentConfig = {};
            if (result && result.length > 0) {
                currentConfig = typeof result[0].config === 'string' 
                    ? JSON.parse(result[0].config) 
                    : result[0].config || {};
            }
            
            // Update WhatsApp settings
            const newConfig = {
                ...currentConfig,
                whatsapp_reminder_enabled: whatsapp_reminder_enabled === 'true' || whatsapp_reminder_enabled === true,
                reminder_days_before: parseInt(reminder_days_before)
            };
            
            await conn.execute(`
                UPDATE scheduler_settings 
                SET config = ?, updated_at = NOW()
                WHERE task_name = 'invoice_generation'
            `, [JSON.stringify(newConfig)]);
            
            res.json({ success: true, message: 'Pengaturan WhatsApp berhasil disimpan' });
        } finally {
            conn.release();
        }
    } catch (error: any) {
        console.error('Error updating WhatsApp settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update auto isolir settings
router.post('/scheduler/isolir-settings', async (req, res) => {
    try {
        const { auto_isolir_enabled, isolir_mode, isolir_date, isolir_execution_time } = req.body;
        
        const conn = await import('../db/pool').then(m => m.databasePool.getConnection());
        try {
            // Get current config
            const [result] = await conn.query(`
                SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `) as any;
            
            let currentConfig = {};
            if (result && result.length > 0) {
                currentConfig = typeof result[0].config === 'string' 
                    ? JSON.parse(result[0].config) 
                    : result[0].config || {};
            }
            
            // Update isolir settings
            const newConfig = {
                ...currentConfig,
                auto_isolir_enabled: auto_isolir_enabled === 'true' || auto_isolir_enabled === true,
                isolir_mode,
                isolir_date: parseInt(isolir_date),
                isolir_execution_time: isolir_execution_time || '01:00'
            };
            
            await conn.execute(`
                UPDATE scheduler_settings 
                SET config = ?, updated_at = NOW()
                WHERE task_name = 'invoice_generation'
            `, [JSON.stringify(newConfig)]);
            
            res.json({ success: true, message: 'Pengaturan auto isolir berhasil disimpan' });
        } finally {
            conn.release();
        }
    } catch (error: any) {
        console.error('Error updating isolir settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Trigger manual scheduler run
router.post('/scheduler/run-now', async (req, res) => {
    try {
        const { period } = req.body;
        const result = await InvoiceSchedulerService.triggerManualGeneration(period);
        res.json(result);
    } catch (error: any) {
        console.error('Error triggering scheduler:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// REPORTS
// ========================================

router.get('/reports', async (req, res) => {
    res.render('billing/reports', { title: 'Laporan Billing' });
});

export default router;
