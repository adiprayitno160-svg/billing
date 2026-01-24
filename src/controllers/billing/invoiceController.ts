import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class InvoiceController {

    /**
     * Get invoice list with filters
     */
    async getInvoiceList(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const status = req.query.status as string || '';
            const search = req.query.search as string || '';
            const period = req.query.period as string || '';
            const odc_id = req.query.odc_id as string || '';

            const offset = (page - 1) * limit;

            // Build query conditions
            const whereConditions: string[] = [];
            const queryParams: any[] = [];

            if (status) {
                whereConditions.push('i.status = ?');
                queryParams.push(status);
            }

            if (period) {
                whereConditions.push('i.period = ?');
                queryParams.push(period);
            }

            if (odc_id) {
                whereConditions.push('c.odc_id = ?');
                queryParams.push(odc_id);
            }

            if (search) {
                whereConditions.push('(c.name LIKE ? OR c.phone LIKE ? OR i.invoice_number LIKE ?)');
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const whereClause = whereConditions.length > 0
                ? 'WHERE ' + whereConditions.join(' AND ')
                : '';

            // Get invoices with customer info and ODC data
            const invoicesQuery = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.customer_code,
                    c.id as customer_id,
                    c.odc_id,
                    odc.name as odc_name,
                    odc.location as odc_location,
                    COALESCE(c.is_isolated, 0) as customer_is_isolated,
                    COALESCE(
                        (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id),
                        0
                    ) as total_paid
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
                ${whereClause}
                ORDER BY i.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) AS total
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;

            const [invoicesResult, countResult] = await Promise.all([
                databasePool.query(invoicesQuery, [...queryParams, limit, offset]),
                databasePool.query(countQuery, queryParams)
            ]);

            const invoices = invoicesResult[0] as RowDataPacket[];
            const totalCount = (countResult[0] as RowDataPacket[])[0]?.total ?? 0;
            const totalPages = Math.ceil(totalCount / limit);

            // Get statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                    SUM(total_amount) as total_amount,
                    SUM(paid_amount) as total_paid,
                    SUM(remaining_amount) as total_remaining
                FROM invoices
            `;

            const [statsResult] = await databasePool.query(statsQuery);
            const stats = (statsResult as RowDataPacket[])[0];

            // Get ODC list for filter dropdown
            const odcQuery = `SELECT id, name, location FROM ftth_odc ORDER BY name`;
            const [odcResult] = await databasePool.query(odcQuery);
            const odcList = odcResult as RowDataPacket[];

            // Get scheduler settings for due_date_offset
            let dueDateOffset = 7; // default
            try {
                const [schedulerResult] = await databasePool.query<RowDataPacket[]>(`
                    SELECT id, task_name, is_enabled, cron_schedule, config, created_at, updated_at 
                    FROM scheduler_settings 
                    WHERE task_name = 'invoice_generation'
                    LIMIT 1
                `);

                if (schedulerResult && schedulerResult.length > 0) {
                    const row = schedulerResult[0];
                    if (row && row.config) {
                        const config = typeof row.config === 'string'
                            ? JSON.parse(row.config)
                            : row.config;
                        if (config && typeof config.due_date_offset === 'number') {
                            dueDateOffset = config.due_date_offset;
                        }
                    }
                }
            } catch (schedulerError: any) {
                // If scheduler_settings table doesn't exist or has issues, use default
                console.warn('Error getting scheduler settings (using default):', schedulerError.message);
            }

            // Get active customers list for manual billing
            // Filter out customers who already have invoices for the selected period (if provided)
            let excludedIds: number[] = [];
            if (period) {
                try {
                    const [existing] = await databasePool.query<RowDataPacket[]>('SELECT customer_id FROM invoices WHERE period = ?', [period]);
                    excludedIds = existing.map((r: any) => r.customer_id);
                } catch (e) { console.error('Error fetching excluded IDs:', e); }
            }

            let customerQuery = `
                SELECT c.id, c.name, c.customer_code, o.name as odc_name
                FROM customers c
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE c.status = 'active'
            `;

            // Add exclusion clause safely
            if (excludedIds.length > 0) {
                customerQuery += ` AND c.id NOT IN (${excludedIds.join(',')})`;
            }

            customerQuery += ` ORDER BY c.name ASC`;

            const [activeResult] = await databasePool.query(customerQuery);
            const activeCustomers = activeResult as RowDataPacket[];

            res.render('billing/tagihan', {
                activeCustomers,
                title: 'Daftar Tagihan',
                invoices,
                stats,
                odcList,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit
                },
                filters: {
                    status,
                    search,
                    period,
                    odc_id
                },
                schedulerSettings: {
                    due_date_offset: dueDateOffset
                }
            });
        } catch (error) {
            console.error('Error getting invoice list:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat daftar tagihan'
            });
        }
    }

    /**
     * Get invoice detail
     */
    async getInvoiceDetail(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const invoiceQuery = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.customer_code
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `;

            const [invoiceResult] = await databasePool.query(invoiceQuery, [id]);
            const invoice = (invoiceResult as RowDataPacket[])[0];

            if (!invoice) {
                res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Tagihan tidak ditemukan'
                });
                return;
            }

            // Get invoice items
            const itemsQuery = `
                SELECT id, invoice_id, description, quantity, unit_price, total_price, created_at FROM invoice_items WHERE invoice_id = ? ORDER BY id
            `;
            const [itemsResult] = await databasePool.query(itemsQuery, [id]);
            const items = itemsResult as RowDataPacket[];

            // Get payment history
            const paymentsQuery = `
                SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
            `;
            const [paymentsResult] = await databasePool.query(paymentsQuery, [id]);
            const payments = paymentsResult as RowDataPacket[];

            // Get debt tracking if exists
            const debtsQuery = `
                SELECT * FROM debt_tracking WHERE invoice_id = ? AND status = 'active'
            `;
            const [debtsResult] = await databasePool.query(debtsQuery, [id]);
            const debts = debtsResult as RowDataPacket[];

            res.render('billing/tagihan-detail', {
                title: 'Detail Tagihan',
                invoice,
                items,
                payments,
                debts
            });
        } catch (error) {
            console.error('Error getting invoice detail:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat detail tagihan'
            });
        }
    }

    /**
     * Create manual invoice
     */
    async createManualInvoice(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const {
                customer_id,
                period,
                due_date,
                items // Array of {description, quantity, unit_price}
            } = req.body;

            // Validate input
            if (!customer_id || !period || !due_date || !items || items.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Data tidak lengkap'
                });
                return;
            }

            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber(period);

            // Calculate totals
            let subtotal = 0;
            for (const item of items) {
                subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
            }

            const discount_amount = parseFloat(req.body.discount_amount || '0');
            const total_amount = subtotal - discount_amount;

            // Insert invoice
            const invoiceInsertQuery = `
                INSERT INTO invoices (
                    invoice_number, customer_id, subscription_id, period, due_date,
                    subtotal, discount_amount, total_amount, paid_amount, remaining_amount,
                    status, created_at, updated_at
                ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, 0, ?, 'draft', NOW(), NOW())
            `;

            const [invoiceResult] = await conn.execute<ResultSetHeader>(invoiceInsertQuery, [
                invoiceNumber,
                customer_id,
                period,
                due_date,
                subtotal,
                discount_amount,
                total_amount,
                total_amount
            ]);

            const invoiceId = invoiceResult.insertId;

            // Insert invoice items
            for (const item of items) {
                const itemInsertQuery = `
                    INSERT INTO invoice_items (
                        invoice_id, description, quantity, unit_price, total_price, created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `;

                const total_price = parseFloat(item.quantity) * parseFloat(item.unit_price);

                await conn.execute(itemInsertQuery, [
                    invoiceId,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    total_price
                ]);
            }

            await conn.commit();

            res.json({
                success: true,
                message: 'Invoice berhasil dibuat',
                invoice_id: invoiceId,
                invoice_number: invoiceNumber
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error creating manual invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal membuat invoice'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Generate bulk invoices (monthly automatic)
     */
    async generateBulkInvoices(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const { period, due_date_offset, customer_ids } = req.body;
            const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

            // Get Due Date Settings from System Settings
            let fixedDay = 28;
            let dayOffset = 7;
            let useFixedDay = true;

            try {
                const [sysSettings] = await conn.query<RowDataPacket[]>(`
                    SELECT setting_key, setting_value FROM system_settings 
                    WHERE setting_key IN ('due_date_mode', 'due_date_fixed_day', 'due_date_offset_days')
                `);

                const settingsMap: Record<string, string> = {};
                sysSettings.forEach((row: any) => settingsMap[row.setting_key] = row.setting_value);

                if (settingsMap['due_date_mode'] === 'offset') {
                    useFixedDay = false;
                } else {
                    // Default to fixed if not set or explicitly fixed
                    useFixedDay = true;
                }

                if (settingsMap['due_date_fixed_day']) fixedDay = parseInt(settingsMap['due_date_fixed_day']);
                if (settingsMap['due_date_offset_days']) dayOffset = parseInt(settingsMap['due_date_offset_days']);

                // Override if user manually passed a generic offset (rare case for manual run)
                if (due_date_offset) {
                    dayOffset = parseInt(due_date_offset);
                    useFixedDay = false; // Force offset if provided manually via API params
                }
            } catch (err) {
                console.warn('[InvoiceController] Failed to load due date settings, using defaults:', err);
            }

            console.log(`Generating bulk invoices for period: ${currentPeriod}`);
            if (customer_ids) console.log(`Targeting ${Array.isArray(customer_ids) ? customer_ids.length : 0} specific customers`);

            // Get all active customers with their subscriptions (if any)
            // This ensures we capture all active customers, not just those with active subscriptions
            const billingModeFilter = ''; // System is now postpaid only, no filter needed

            const subscriptionsQuery = `
                SELECT 
                    c.id as customer_id,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.account_balance,
                    c.status as customer_status,
                    c.connection_type,
                    c.is_taxable,
                    c.use_device_rental,
                    c.rental_mode,
                    c.rental_cost,
                    COALESCE(s.id, (SELECT id FROM subscriptions WHERE customer_id = c.id ORDER BY id DESC LIMIT 1), 0) as id, 
                    COALESCE(s.package_name, (SELECT package_name FROM subscriptions WHERE customer_id = c.id ORDER BY id DESC LIMIT 1), 'Paket Internet') as package_name,
                    COALESCE(s.price, (SELECT price FROM subscriptions WHERE customer_id = c.id ORDER BY id DESC LIMIT 1), 0) as price,
                    COALESCE(s.status, (SELECT status FROM subscriptions WHERE customer_id = c.id ORDER BY id DESC LIMIT 1), 'inactive') as subscription_status,
                    s.start_date,
                    s.end_date
                FROM customers c
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND (s.status = 'active' OR s.status = 'Active')
                WHERE c.status = 'active'
                AND (c.connection_type = 'pppoe' OR c.connection_type = 'static_ip')
                ${customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0 ? 'AND c.id IN (?)' : ''}
            `;

            const queryParams: any[] = [];
            if (customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0) {
                queryParams.push(customer_ids);
            }

            const [subscriptions] = await conn.query<RowDataPacket[]>(subscriptionsQuery, queryParams);

            // Fetch global settings for tax and rental
            const { SettingsService } = await import('../../services/SettingsService');
            const ppnEnabled = await SettingsService.getBoolean('ppn_enabled');
            const ppnRate = ppnEnabled ? await SettingsService.getNumber('ppn_rate') : 0;
            const deviceRentalEnabled = await SettingsService.getBoolean('device_rental_enabled');
            const deviceRentalFee = await SettingsService.getNumber('device_rental_fee');

            console.log(`Found ${subscriptions.length} active customers for billing`);

            // Log breakdown
            const withSubscription = subscriptions.filter((s: any) => s.id && s.id > 0).length;
            const withoutSubscription = subscriptions.length - withSubscription;
            console.log(`  - With active subscription: ${withSubscription}`);
            console.log(`  - Without subscription (will use default price): ${withoutSubscription}`);

            // Check for existing invoices - improved to handle NULL subscription_id properly
            const checkQuery = `
                SELECT customer_id, subscription_id, COALESCE(subscription_id, 0) as normalized_subscription_id
                FROM invoices
                WHERE period = ?
            `;
            const [existingInvoices] = await conn.query<RowDataPacket[]>(checkQuery, [currentPeriod]);

            console.log(`Found ${existingInvoices.length} existing invoices for period ${currentPeriod}`);
            if (existingInvoices.length > 0) {
                console.log('Existing invoices:', existingInvoices.map((inv: any) =>
                    `customer_id: ${inv.customer_id}, subscription_id: ${inv.subscription_id}`
                ));
            }

            // Create a map for exact match: customer_id + subscription_id (handling NULL as 0)
            const exactMatchSet = new Set<string>();
            // Also track customers with invoices that have NULL/0 subscription_id (legacy invoices)
            const customersWithLegacyInvoices = new Set<number>();

            for (const inv of existingInvoices as any[]) {
                const normalizedSubId = inv.normalized_subscription_id || 0;
                exactMatchSet.add(`${inv.customer_id}_${normalizedSubId}`);

                // Track if this is a legacy invoice (NULL or 0 subscription_id)
                if (!inv.subscription_id || inv.subscription_id === 0) {
                    customersWithLegacyInvoices.add(inv.customer_id);
                }
            }

            if (customersWithLegacyInvoices.size > 0) {
                console.log(`Found ${customersWithLegacyInvoices.size} customers with legacy invoices (NULL subscription_id):`,
                    Array.from(customersWithLegacyInvoices));
            }

            let createdCount = 0;
            let skippedCount = 0;
            const errors: string[] = [];
            const customerBalances = new Map<number, number>();

            for (const subscription of subscriptions) {
                // Initialize balance tracker if not set
                if (!customerBalances.has(subscription.customer_id)) {
                    customerBalances.set(subscription.customer_id, parseFloat(subscription.account_balance || 0));
                }

                try {
                    // Check for exact match: customer_id + subscription_id
                    // Normalize subscription_id: if 0 or null, treat as 0
                    const normalizedSubId = (subscription.id && subscription.id > 0) ? subscription.id : 0;
                    const exactKey = `${subscription.customer_id}_${normalizedSubId}`;

                    const hasActiveSubscription = subscription.id && subscription.id > 0;

                    // Check if invoice already exists for this period
                    const hasExactMatch = exactMatchSet.has(exactKey);

                    // Only block based on legacy invoice (sub_id=0) IF we are currently trying to create a sub_id=0 invoice
                    // This allows specific subscription invoices to be created even if a general invoice exists
                    const isLegacyConflict = (normalizedSubId === 0) && customersWithLegacyInvoices.has(subscription.customer_id);

                    if (hasExactMatch || isLegacyConflict) {
                        skippedCount++;
                        const subscriptionInfo = hasActiveSubscription ? `subscription_id: ${subscription.id}` : 'no subscription';
                        const reason = hasExactMatch
                            ? `exact match found`
                            : `customer has legacy invoice`;
                        console.log(`⚠ Invoice already exists (Merged Log: ${reason})`);
                        continue;
                    }

                    console.log(`✓ Processing customer ${subscription.customer_name} (customer_id: ${subscription.customer_id})`);

                    // Calculate due date (Consistent with Scheduler)
                    const periodDate = new Date(currentPeriod + '-01');
                    let dueDate = new Date(periodDate);

                    if (useFixedDay) {
                        const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
                        const targetDay = Math.min(fixedDay, daysInMonth);
                        // Safe set: Year, Month, Day
                        dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), targetDay);
                    } else {
                        // Offset from start of period (usually 1st)
                        dueDate.setDate(dueDate.getDate() + dayOffset);
                    }

                    const dueDateStr = dueDate.toISOString().slice(0, 10);

                    // Generate invoice number
                    const invoiceNumber = await this.generateInvoiceNumber(currentPeriod, conn);

                    // Determine price: use subscription price if available, otherwise use default
                    const defaultPrice = 100000; // Default price for customers without subscription
                    const subscriptionId = subscription.id && subscription.id > 0 ? subscription.id : null;
                    const price = parseFloat(subscription.price) || defaultPrice;
                    const packageName = subscription.package_name || 'Paket Internet Bulanan';
                    const subscriptionPrice = parseFloat(subscription.price) || 0;

                    // Only use subscription_id if it exists (not 0 or null)
                    const finalSubscriptionId = subscriptionId || null;

                    // Calculate balance deduction
                    let currentBalance = customerBalances.get(subscription.customer_id) || 0;
                    let balanceDeduction = 0;
                    let paidAmount = 0;
                    let remainingAmount = price;
                    let status = 'sent';
                    let invoiceNotes = null;

                    if (currentBalance > 0) {
                        balanceDeduction = Math.min(currentBalance, price);

                        if (balanceDeduction > 0) {
                            paidAmount = balanceDeduction;
                            remainingAmount = price - balanceDeduction;
                            currentBalance -= balanceDeduction;
                            customerBalances.set(subscription.customer_id, currentBalance);

                            status = remainingAmount <= 0 ? 'paid' : 'partial';
                            invoiceNotes = `Otomatis dipotong dari saldo (Rp ${new Intl.NumberFormat('id-ID').format(balanceDeduction)})`;

                            // Update Customer Balance
                            await conn.execute('UPDATE customers SET account_balance = ? WHERE id = ?', [currentBalance, subscription.customer_id]);
                        }
                    }

                    // Calculate final total including Tax and Device Rental
                    let subtotal = price;
                    let deviceFee = 0;
                    if (deviceRentalEnabled && subscription.use_device_rental) {
                        const rentalCost = subscription.rental_cost !== null ? parseFloat(subscription.rental_cost) : deviceRentalFee;
                        if (subscription.rental_mode === 'daily') {
                            const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
                            deviceFee = rentalCost * daysInMonth;
                        } else {
                            deviceFee = rentalCost;
                        }
                    }

                    let ppnAmount = 0;
                    if (ppnEnabled && ppnRate > 0 && subscription.is_taxable) {
                        ppnAmount = Math.round((subtotal + deviceFee) * (ppnRate / 100));
                    }

                    const totalAmount = subtotal + deviceFee + ppnAmount;
                    remainingAmount = totalAmount - paidAmount;

                    // Insert invoice
                    const invoiceInsertQuery = `
                        INSERT INTO invoices (
                            invoice_number, customer_id, subscription_id, period, due_date,
                            subtotal, discount_amount, ppn_rate, ppn_amount, device_fee, 
                            total_amount, paid_amount, remaining_amount,
                            status, notes, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    `;

                    const [invoiceResult] = await conn.execute<ResultSetHeader>(invoiceInsertQuery, [
                        invoiceNumber,
                        subscription.customer_id,
                        finalSubscriptionId,
                        currentPeriod,
                        dueDateStr,
                        subtotal,
                        ppnEnabled ? ppnRate : 0,
                        ppnAmount,
                        deviceFee,
                        totalAmount,
                        paidAmount,
                        remainingAmount,
                        status,
                        invoiceNotes
                    ]);

                    const invoiceId = invoiceResult.insertId;

                    // Log Balance Usage if applicable
                    if (balanceDeduction > 0) {
                        await conn.execute(`
                            INSERT INTO customer_balance_logs (
                                customer_id, type, amount, description, reference_id, created_at
                            ) VALUES (?, 'debit', ?, ?, ?, NOW())
                        `, [subscription.customer_id, balanceDeduction, `Pembayaran otomatis invoice ${invoiceNumber}`, invoiceId.toString()]);
                    }

                    // Insert items
                    const itemInsertQuery = `
                        INSERT INTO invoice_items (
                            invoice_id, description, quantity, unit_price, total_price, created_at
                        ) VALUES (?, ?, 1, ?, ?, NOW())
                    `;

                    // 1. Internet Package
                    const description = subscriptionPrice > 0
                        ? `Paket ${packageName} - ${currentPeriod}`
                        : `Paket Internet Bulanan - ${currentPeriod}`;

                    await conn.execute(itemInsertQuery, [invoiceId, description, subtotal, subtotal]);

                    // 2. Device Rental
                    if (deviceFee > 0) {
                        await conn.execute(itemInsertQuery, [
                            invoiceId,
                            `Sewa Perangkat - ${currentPeriod}`,
                            deviceFee,
                            deviceFee
                        ]);
                    }

                    createdCount++;
                    console.log(`✓ Invoice created for customer ${subscription.customer_name} (${invoiceNumber})`);


                } catch (itemError: any) {
                    console.error(`Error creating invoice for subscription ${subscription.id}:`, itemError);
                    errors.push(`Customer ${subscription.customer_name}: ${itemError.message}`);
                }
            }

            await conn.commit();

            res.json({
                success: true,
                message: `Berhasil membuat ${createdCount} tagihan`,
                created_count: createdCount,
                skipped_count: skippedCount,
                total_subscriptions: subscriptions.length,
                total_customers: subscriptions.length, // Alias for clarity in UI
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error generating bulk invoices:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal generate bulk invoice'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Update invoice status
     */
    async updateInvoiceStatus(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    success: false,
                    message: 'Status tidak valid'
                });
                return;
            }

            await databasePool.query(
                'UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, id]
            );

            // AUTO-SEND PAID INVOICE PDF via WhatsApp
            if (status === 'paid') {
                try {
                    const { InvoicePdfService } = await import('../../services/invoice/InvoicePdfService');
                    const { whatsappService } = await import('../../services/whatsapp/WhatsAppService');

                    // 1. Generate PDF
                    const pdfPath = await InvoicePdfService.generateInvoicePdf(parseInt(id));

                    // 2. Get Customer Phone
                    const [rows] = await databasePool.query<RowDataPacket[]>(`
                        SELECT c.phone, c.name, i.invoice_number 
                        FROM invoices i 
                        JOIN customers c ON i.customer_id = c.id 
                        WHERE i.id = ?
                    `, [id]);

                    if (rows.length > 0 && rows[0].phone) {
                        const { phone, name, invoice_number } = rows[0];

                        // 3. Send WhatsApp with PDF
                        const caption = `✅ *PEMBAYARAN LUNAS*\n\nHalo Kak *${name}*,\nTerima kasih, pembayaran tagihan *${invoice_number}* telah berhasil kami verifikasi LUNAS.\n\nBerikut terlampir e-invoice (Lunas) sebagai bukti pembayaran yang sah.\n\nTerima kasih telah berlangganan! 🙏`;

                        // Send Document
                        await whatsappService.sendDocument(phone, pdfPath, `Invoice-${invoice_number}.pdf`, caption);
                        console.log(`[Invoice] Paid PDF sent to ${name} (${phone})`);
                    }
                } catch (pdfError) {
                    console.error('[Invoice] Failed to generate/send PDF:', pdfError);
                    // Don't fail the response, just log error
                }
            }

            res.json({
                success: true,
                message: 'Status invoice berhasil diperbarui'
            });
        } catch (error) {
            console.error('Error updating invoice status:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memperbarui status invoice'
            });
        }
    }

    /**
     * Send invoice detail via WhatsApp
     */
    async sendInvoiceWhatsApp(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            // Get invoice data
            const [rows] = await databasePool.query<RowDataPacket[]>(`
                SELECT i.*, 
                       c.name as customer_name, 
                       c.phone as customer_phone,
                       c.id as customer_id 
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [id]);

            if (rows.length === 0) {
                res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
                return;
            }

            const invoice = rows[0] as RowDataPacket;

            if (!invoice.customer_phone) {
                res.status(400).json({ success: false, message: 'Customer tidak memiliki nomor telepon' });
                return;
            }

            // Format Currency
            const formatter = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            });

            // Get Month Name from Period (YYYY-MM)
            const periodDate = new Date(invoice.period + '-01');
            const periodName = periodDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

            // Format Due Date
            const dueDate = new Date(invoice.due_date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            let message = '';

            if (invoice.status === 'paid') {
                message = `✅ *PEMBAYARAN DITERIMA*\n\n` +
                    `Halo Kak *${invoice.customer_name}*,\n` +
                    `Terima kasih, pembayaran tagihan internet Anda telah kami terima.\n\n` +
                    `📝 *Rincian Pembayaran:*\n` +
                    `• No. Invoice: *${invoice.invoice_number}*\n` +
                    `• Periode: ${periodName}\n` +
                    `• Nominal: ${formatter.format(invoice.total_amount)}\n` +
                    `• Status: *LUNAS* ✅\n\n` +
                    `Terima kasih telah berlangganan layanan kami. 🙏`;
            } else {
                // Get Bank Settings
                const [settingsRows] = await databasePool.query<RowDataPacket[]>(
                    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('bank_name', 'bank_account_number', 'bank_account_name')"
                );

                const bankSettings: any = {
                    bank_name: 'BCA',
                    bank_account_number: '1234567890',
                    bank_account_name: 'ISP Billing'
                };

                settingsRows.forEach(row => {
                    bankSettings[row.setting_key] = row.setting_value;
                });

                message = `📢 *TAGIHAN INTERNET BULAN ${periodName.toUpperCase()}*\n\n` +
                    `Halo Kak *${invoice.customer_name}*,\n` +
                    `Berikut adalah rincian tagihan internet Anda:\n\n` +
                    `📄 *Detail Tagihan:*\n` +
                    `• No. Invoice: *${invoice.invoice_number}*\n` +
                    `• Periode: ${periodName}\n` +
                    `• Total Tagihan: *${formatter.format(invoice.total_amount)}*\n` +
                    `• Jatuh Tempo: *${dueDate}*\n\n` +
                    `💳 *Cara Pembayaran:*\n` +
                    `Silakan transfer ke rekening:\n` +
                    `*${bankSettings.bank_name}*: ${bankSettings.bank_account_number}\n` +
                    `a/n ${bankSettings.bank_account_name}\n\n` +
                    `⚠️ Mohon lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari isolir otomatis.\n\n` +
                    `_Balas pesan ini dengan bukti transfer jika sudah melakukan pembayaran._\n` +
                    `Terima kasih. 🙏`;
            }

            // Import dynamically to avoid circular dependency issues if any
            // Import dynamically to avoid circular dependency issues if any
            const { whatsappService } = await import('../../services/whatsapp/WhatsAppService');
            const waClient = whatsappService;

            let success = false;
            try {
                await waClient.sendMessage(invoice.customer_phone, message);
                success = true;
            } catch (e) {
                console.error('Failed to send WA:', e);
            }

            if (success) {
                // Optional: Update invoice status if it was draft
                if (invoice.status === 'draft') {
                    await databasePool.query('UPDATE invoices SET status = "sent" WHERE id = ?', [id]);
                }

                res.json({ success: true, message: 'Pesan WhatsApp berhasil dikirim' });
            } else {
                res.status(500).json({ success: false, message: 'Gagal mengirim WhatsApp' });
            }
        } catch (error: any) {
            console.error('Error sending WhatsApp invoice:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Delete invoice
     */
    async deleteInvoice(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const { id } = req.params;

            // Delete associated payments
            await conn.execute('DELETE FROM payments WHERE invoice_id = ?', [id]);

            // Delete associated discounts
            await conn.execute('DELETE FROM discounts WHERE invoice_id = ?', [id]);

            // Delete associated debt tracking
            await conn.execute('DELETE FROM debt_tracking WHERE invoice_id = ?', [id]);

            // Delete invoice items
            await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

            // Delete invoice
            await conn.execute('DELETE FROM invoices WHERE id = ?', [id]);

            await conn.commit();

            res.json({
                success: true,
                message: 'Invoice berhasil dihapus'
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error deleting invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menghapus invoice'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Update invoice notes
     */
    async updateInvoiceNotes(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            await databasePool.query(
                'UPDATE invoices SET notes = ?, updated_at = NOW() WHERE id = ?',
                [notes, id]
            );

            res.json({
                success: true,
                message: 'Catatan berhasil disimpan'
            });
        } catch (error) {
            console.error('Error updating invoice notes:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menyimpan catatan'
            });
        }
    }


    /**
     * Update invoice due date (Janji Bayar)
     */
    async updateDueDate(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { due_date } = req.body;

            if (!due_date) {
                res.status(400).json({ success: false, message: 'Tanggal jatuh tempo wajib diisi' });
                return;
            }

            // Get Invoice and Customer details
            const [rows] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    i.invoice_number, i.status, i.paid_amount, i.total_amount, i.period,
                    c.id as customer_id, c.name as customer_name, c.phone
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [id]);

            if (rows.length === 0) {
                res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
                return;
            }

            const invoice = rows[0];
            let newStatus = invoice.status;

            // If currently overdue and new date is in the future/today, change status back to sent/partial
            const newDate = new Date(due_date);
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Normalize today

            if (invoice.status === 'overdue' && newDate >= now) {
                newStatus = invoice.paid_amount > 0 ? 'partial' : 'sent';
            }

            // Update invoice
            await databasePool.query(
                'UPDATE invoices SET due_date = ?, status = ?, updated_at = NOW() WHERE id = ?',
                [due_date, newStatus, id]
            );

            // Send WhatsApp notification
            try {
                const formattedDate = newDate.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const message = `🔔 *PERPANJANGAN WAKTU PEMBAYARAN*\n\n` +
                    `Yth. Bapak/Ibu *${invoice.customer_name}*,\n\n` +
                    `Kami informasikan bahwa tanggal jatuh tempo untuk:\n\n` +
                    `📄 Invoice: *${invoice.invoice_number}*\n` +
                    `📅 Periode: *${invoice.period}*\n` +
                    `💰 Nominal: *Rp ${new Intl.NumberFormat('id-ID').format(invoice.total_amount)}*\n\n` +
                    `Telah diperpanjang hingga:\n` +
                    `📆 *${formattedDate}*\n\n` +
                    `⚠️ *PERHATIAN:*\n` +
                    `Mohon melakukan pembayaran sebelum tanggal tersebut untuk menghindari isolir otomatis.\n\n` +
                    `Terima kasih atas perhatiannya.`;

                // Queue notification
                await databasePool.query(`
                    INSERT INTO notification_queue (customer_id, type, message, priority, status)
                    VALUES (?, 'whatsapp', ?, 'high', 'pending')
                `, [invoice.customer_id, message]);

                console.log(`✅ Notification queued for customer ${invoice.customer_name} (${invoice.phone}) - Due date extended to ${formattedDate}`);
            } catch (notifError) {
                console.error('⚠️ Failed to queue WhatsApp notification:', notifError);
                // Don't fail the request if notification fails
            }

            res.json({
                success: true,
                message: 'Tanggal jatuh tempo (Janji Bayar) berhasil diperbarui'
            });
        } catch (error: any) {
            console.error('Error updating invoice due date:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Check which customers already have invoices for a specific period
     */
    async checkInvoicesForPeriod(req: Request, res: Response): Promise<void> {
        try {
            const { period } = req.query;

            if (!period) {
                res.status(400).json({ success: false, message: 'Periode harus diisi' });
                return;
            }

            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_id FROM invoices WHERE period = ?',
                [period]
            );

            const customerIds = rows.map(r => r.customer_id);

            res.json({
                success: true,
                customerIds
            });
        } catch (error) {
            console.error('Error checking invoices for period:', error);
            res.status(500).json({ success: false, message: 'Gagal mengecek data tagihan' });
        }
    }

    /**
     * Generate unique invoice number
     */
    private async generateInvoiceNumber(period: string, conn?: any): Promise<string> {
        const connection = conn || databasePool;

        // Format: INV/YYYY/MM/XXXX
        const [year, month] = period.split('-');

        // Get last invoice number for this period
        const [result] = await connection.query(`
            SELECT invoice_number 
            FROM invoices 
            WHERE period = ? 
            ORDER BY invoice_number DESC 
            LIMIT 1
        `, [period]) as [RowDataPacket[], any];

        let sequence = 1;

        if (result.length > 0 && result[0]) {
            const lastNumber = result[0].invoice_number;
            const match = lastNumber.match(/\/(\d+)$/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            }
        }

        const sequenceStr = sequence.toString().padStart(4, '0');
        return `INV/${year}/${month}/${sequenceStr}`;
    }
}
