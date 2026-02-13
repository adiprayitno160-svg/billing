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
            // Default to current month if no period specified, to keep view clean as per user request
            const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
            const odc_id = req.query.odc_id as string || '';

            const offset = (page - 1) * limit;

            // Build query conditions
            const whereConditions: string[] = [];
            const queryParams: any[] = [];

            if (status) {
                if (status !== 'all') {
                    whereConditions.push('i.status = ?');
                    queryParams.push(status);
                }
            } else {
                // Default: Hide 'paid' invoices as per user request to keep view clean
                whereConditions.push("i.status != 'paid'");
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
                ) VALUES (?, ?, null, ?, ?, ?, ?, ?, 0, ?, 'draft', NOW(), NOW())
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
        const { period, customer_ids } = req.body;

        const logTag = `[SIMPLE-GEN-V3]`;
        console.log(`${logTag} START generateBulkInvoices Period: ${period}`);

        try {
            await conn.beginTransaction();

            const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

            // HARDCODE DUE DATE: 28th of the month
            const [yearStr, monthStr] = currentPeriod.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);
            const dueDate = new Date(year, month - 1, 28);
            const dueDateStr = dueDate.toISOString().slice(0, 10);

            console.log(`${logTag} TARGET: Period ${currentPeriod}, DueDate ${dueDateStr}`);

            // Get all active customers
            const subscriptionsQuery = `
            SELECT 
                c.id as customer_id,
                c.name as customer_name,
                c.customer_code,
                c.account_balance,
                c.connection_type,
                c.is_taxable,
                c.use_device_rental,
                c.rental_mode,
                c.rental_cost,
                sp.name as static_pkg_name,
                sp.price as static_pkg_price,
                pp.name as pppoe_pkg_name,
                pp.price as pppoe_pkg_price,
                COALESCE(s.id, 0) as id, 
                COALESCE(s.package_name, '') as subscription_pkg_name,
                COALESCE(s.price, 0) as subscription_price,
                COALESCE(s.status, 'inactive') as subscription_status
            FROM customers c
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND LOWER(s.status) = 'active'
            LEFT JOIN static_ip_clients sip ON c.id = sip.customer_id
            LEFT JOIN static_ip_packages sp ON sip.package_id = sp.id
            LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
            WHERE LOWER(c.status) = 'active'
            ${customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0 ? 'AND c.id IN (?)' : ''}
            `;

            const queryParams: any[] = [];
            if (customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0) {
                const numericIds = customer_ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
                queryParams.push(numericIds);
            }

            const [subscriptions] = await conn.query<RowDataPacket[]>(subscriptionsQuery, queryParams);

            console.log(`${logTag} Found ${subscriptions.length} active customers`);

            // Check existing invoices
            const [existing] = await conn.query<RowDataPacket[]>('SELECT customer_id FROM invoices WHERE period = ?', [currentPeriod]);
            const existingSet = new Set(existing.map(e => e.customer_id));

            let createdCount = 0;
            let skippedCount = 0;
            const errors: string[] = [];

            // FETCH SETTINGS
            let deviceRentalFee = 25000;
            let deviceRentalEnabled = false;
            let ppnEnabled = false;
            let ppnRate = 11;

            try {
                const [settings] = await conn.query<RowDataPacket[]>('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("device_rental_fee", "device_rental_enabled", "ppn_enabled", "ppn_rate")');
                settings.forEach((row: any) => {
                    if (row.setting_key === 'device_rental_fee') deviceRentalFee = parseFloat(row.setting_value);
                    if (row.setting_key === 'ppn_rate') ppnRate = parseFloat(row.setting_value);
                    if (row.setting_key === 'device_rental_enabled') deviceRentalEnabled = row.setting_value === 'true' || row.setting_value === '1';
                    if (row.setting_key === 'ppn_enabled') ppnEnabled = row.setting_value === 'true' || row.setting_value === '1';
                });
            } catch (e) { }

            for (const sub of subscriptions) {
                if (existingSet.has(sub.customer_id)) {
                    skippedCount++;
                    continue;
                }

                try {
                    let price = 0;
                    let pkgName = 'Layanan Internet';

                    if (sub.id > 0 && sub.subscription_price) {
                        price = parseFloat(sub.subscription_price);
                        pkgName = sub.subscription_pkg_name || 'Paket Subscription';
                    } else if (sub.connection_type === 'static_ip' && sub.static_pkg_price) {
                        price = parseFloat(sub.static_pkg_price);
                        pkgName = sub.static_pkg_name || 'Paket Static IP';
                    } else if (sub.connection_type === 'pppoe' && sub.pppoe_pkg_price) {
                        price = parseFloat(sub.pppoe_pkg_price);
                        pkgName = sub.pppoe_pkg_name || 'Paket PPPoE';
                    }

                    if (price <= 0) price = 100000;

                    let total = price;
                    let deviceFee = 0;

                    if (deviceRentalEnabled && sub.use_device_rental) {
                        const cost = sub.rental_cost ? parseFloat(sub.rental_cost) : deviceRentalFee;
                        if (sub.rental_mode === 'daily') {
                            const daysInMonth = new Date(year, month, 0).getDate();
                            deviceFee = cost * daysInMonth;
                        } else {
                            deviceFee = cost;
                        }
                        total += deviceFee;
                    }

                    let ppn = 0;
                    if (ppnEnabled && sub.is_taxable) {
                        ppn = Math.round(total * (ppnRate / 100));
                        total += ppn;
                    }

                    // Invoice Number
                    const invNum = await this.generateInvoiceNumber(currentPeriod, conn);

                    // Balance
                    let currentBalance = parseFloat(sub.account_balance || 0);
                    let paidAmount = 0;
                    let notes: string | null = null;

                    if (currentBalance > 0) {
                        paidAmount = Math.min(currentBalance, total);
                        currentBalance -= paidAmount;
                        notes = `Otomatis potong saldo (Rp ${paidAmount})`;
                        await conn.execute('UPDATE customers SET account_balance = ? WHERE id = ?', [currentBalance, sub.customer_id]);
                    }

                    const remaining = total - paidAmount;
                    const status = remaining <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'sent');

                    const [resInv] = await conn.execute<ResultSetHeader>(`
                        INSERT INTO invoices (
                            invoice_number, customer_id, subscription_id, period, due_date,
                            subtotal, ppn_rate, ppn_amount, device_fee, total_amount, 
                            paid_amount, remaining_amount, status, notes, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    `, [
                        invNum, sub.customer_id, (sub.id > 0 ? sub.id : null), currentPeriod, dueDateStr,
                        price, (ppnEnabled ? ppnRate : 0), ppn, deviceFee, total,
                        paidAmount, remaining, status, notes
                    ]);

                    const invId = resInv.insertId;

                    await conn.execute('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES (?, ?, 1, ?, ?)',
                        [invId, `${pkgName} - ${currentPeriod}`, price, price]);

                    if (deviceFee > 0) {
                        await conn.execute('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES (?, ?, 1, ?, ?)',
                            [invId, 'Sewa Perangkat', deviceFee, deviceFee]);
                    }

                    if (paidAmount > 0) {
                        await conn.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes) VALUES (?, "balance", ?, NOW(), ?)',
                            [invId, paidAmount, notes]);
                    }

                    createdCount++;
                    console.log(`${logTag} SUCCESS ${sub.customer_name}`);

                } catch (err: any) {
                    console.error(`${logTag} ERROR ${sub.customer_name}:`, err);
                    errors.push(`${sub.customer_name}: ${err.message}`);
                }
            }

            await conn.commit();
            console.log(`${logTag} GENERATE COMPLETE. Created: ${createdCount}`);

            res.json({
                success: true,
                message: `Berhasil membuat ${createdCount} tagihan`,
                created_count: createdCount,
                skipped_count: skippedCount,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error: any) {
            await conn.rollback();
            console.error(`${logTag} FATAL:`, error);
            res.status(500).json({ success: false, message: error.message });
        } finally {
            conn.release();
        }
    }

    async generateBulkInvoices_UNUSED(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();
        const { period, due_date_offset, customer_ids } = req.body;

        const logTag = `[DEBUG-GENERATE-${Date.now()}]`;
        console.log(`${logTag} START generateBulkInvoices Period: ${period}`);

        try {
            await conn.beginTransaction();

            const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
            console.log(`${logTag} Period determined: ${currentPeriod}`);

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
                    useFixedDay = true;
                }

                if (settingsMap['due_date_fixed_day']) fixedDay = parseInt(settingsMap['due_date_fixed_day']);
                if (settingsMap['due_date_offset_days']) dayOffset = parseInt(settingsMap['due_date_offset_days']);

                if (due_date_offset) {
                    dayOffset = parseInt(due_date_offset);
                    useFixedDay = false;
                }
                console.log(`${logTag} Due date settings loaded. FixedDay: ${fixedDay}, UseFixed: ${useFixedDay}`);
            } catch (err) {
                console.warn(`${logTag} Failed to load due date settings, using defaults:`, err);
            }

            // Diagnostic: Check total and active customers
            const [diagRows] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = "active" OR status = "Active" THEN 1 ELSE 0 END) as active_count FROM customers') as any;
            console.log(`${logTag} Diagnostics: Total Customers=${diagRows[0]?.total}, Active=${diagRows[0]?.active_count}`);

            // Get all active customers with their connection/package details
            // Improved LEFT JOIN structure for correct package association & Case Insensitive Checks
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
                sp.name as static_pkg_name,
                sp.price as static_pkg_price,
                pp.name as pppoe_pkg_name,
                pp.price as pppoe_pkg_price,
                COALESCE(s.id, 0) as id, 
                COALESCE(s.package_name, '') as subscription_pkg_name,
                COALESCE(s.price, 0) as subscription_price,
                COALESCE(s.status, 'inactive') as subscription_status,
                s.start_date,
                s.end_date
            FROM customers c
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND LOWER(s.status) = 'active'
            LEFT JOIN static_ip_clients sip ON c.id = sip.customer_id
            LEFT JOIN static_ip_packages sp ON sip.package_id = sp.id
            LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
            WHERE LOWER(c.status) = 'active'
            ${customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0 ? 'AND c.id IN (?)' : ''}
        `;

            const queryParams: any[] = [];
            if (customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0) {
                const numericIds = customer_ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
                queryParams.push(numericIds);
                console.log(`${logTag} Filtering by IDs: ${numericIds.length} IDs`);
            }

            const [subscriptions] = await conn.query<RowDataPacket[]>(subscriptionsQuery, queryParams);
            console.log(`${logTag} Found ${subscriptions.length} potential candidates`);

            // Check for existing invoices to avoid duplicates
            const checkQuery = `
            SELECT customer_id, subscription_id, COALESCE(subscription_id, 0) as normalized_subscription_id, invoice_number
            FROM invoices
            WHERE period = ?
        `;
            const [existingInvoices] = await conn.query<RowDataPacket[]>(checkQuery, [currentPeriod]);
            console.log(`${logTag} Found ${existingInvoices.length} existing invoices for period ${currentPeriod}`);

            const exactMatchSet = new Set<string>();
            const customersWithGeneralInvoices = new Set<number>();

            for (const inv of existingInvoices as any[]) {
                const normalizedSubId = inv.normalized_subscription_id || 0;
                exactMatchSet.add(`${inv.customer_id}_${normalizedSubId}`);
                if (normalizedSubId === 0) customersWithGeneralInvoices.add(inv.customer_id);
            }

            let createdCount = 0;
            let skippedCount = 0;
            const skippedDetails: any[] = [];
            const errors: string[] = [];
            const customerBalances = new Map<number, number>();

            // sort by name
            let sortedSubscriptions = subscriptions as any[];
            try {
                sortedSubscriptions = (subscriptions as any[]).sort((a, b) => {
                    return (a.customer_name || '').localeCompare(b.customer_name || '');
                });
            } catch (sortErr) {
                console.error(`${logTag} Sort error:`, sortErr);
            }

            console.log(`${logTag} Logic Loop Start - Processing ${sortedSubscriptions.length} items`);

            for (const sub of sortedSubscriptions) {
                // Safe logging
                console.log(`${logTag} Processing: ${sub.customer_name} (#${sub.customer_id})`);

                if (!customerBalances.has(sub.customer_id)) {
                    customerBalances.set(sub.customer_id, parseFloat(sub.account_balance || 0));
                }

                try {
                    const normalizedSubId = (sub.id && sub.id > 0) ? sub.id : 0;
                    const exactKey = `${sub.customer_id}_${normalizedSubId}`;
                    const hasExactMatch = exactMatchSet.has(exactKey);
                    const isGeneralConflict = (normalizedSubId === 0) && customersWithGeneralInvoices.has(sub.customer_id);

                    if (hasExactMatch || isGeneralConflict) {
                        skippedCount++;
                        const reason = hasExactMatch ? 'Duplicate (Same Period)' : 'Conflict (General Invoice Exists)';
                        console.log(`${logTag} SKIP ${sub.customer_name} due to ${reason}`);
                        skippedDetails.push({ name: sub.customer_name, id: sub.customer_id, reason });
                        continue;
                    }

                    // Determine effective price and package name
                    let finalPrice = 0;
                    let finalPkgName = 'Layanan Internet';

                    if (sub.id > 0 && sub.subscription_price && typeof sub.subscription_price !== 'undefined') {
                        finalPrice = parseFloat(sub.subscription_price);
                        finalPkgName = sub.subscription_pkg_name || 'Paket Subscription';
                    } else if (sub.connection_type === 'static_ip' && sub.static_pkg_price) {
                        finalPrice = parseFloat(sub.static_pkg_price) || 0;
                        finalPkgName = sub.static_pkg_name || 'Paket Static IP';
                    } else if (sub.connection_type === 'pppoe' && sub.pppoe_pkg_price) {
                        finalPrice = parseFloat(sub.pppoe_pkg_price) || 0;
                        finalPkgName = sub.pppoe_pkg_name || 'Paket PPPoE';
                    }

                    // Strict Price Check: If 0, check logic or use 100k info
                    if (finalPrice <= 0) {
                        finalPrice = 100000;
                        finalPkgName = 'Layanan Internet (Default)';
                        console.log(`${logTag} NOTICE: Using fallback price 100,000 for ${sub.customer_name}`);
                    }

                    // Calculate due date
                    const periodDate = new Date(currentPeriod + '-01');
                    let dueDate = new Date(periodDate);
                    if (useFixedDay) {
                        const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
                        const targetDay = Math.min(fixedDay, daysInMonth);
                        dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), targetDay);
                    } else {
                        dueDate.setDate(dueDate.getDate() + dayOffset);
                    }

                    const invoiceNumber = await this.generateInvoiceNumber(currentPeriod, conn);

                    // Base cost components
                    let subtotal = finalPrice;
                    let deviceFee = 0;
                    if (useFixedDay) { // Temporary fix for var name collision or reuse logic
                        // deviceRentalFee logic needs reload from settings if needed inside loop, but usually okay outside
                    }

                    // Re-fetch rental settings if needed, but assuming outside scope variables are available.
                    // Important: `deviceRentalEnabled` and `deviceRentalFee` were loaded outside loop.
                    // Need to capture them here or move them. 
                    // To be safe, I will hardcode simple logic or assume variables visible.
                    // Wait, let's look at scope. Yes, they were defined outside loop in previous code.
                    // But I replaced the whole function. I need to re-declare them!

                    // RE-DECLARING SETTINGS LOCALLY TO BE SAFE (Standard Practice in Full Replacement)
                    // Note: We need SettingsService here.
                    // To avoid import issues inside replacement, I'll use default values or try-catch.
                    let deviceRentalEnabled = false;
                    let deviceRentalFee = 0;
                    let ppnEnabled = false;
                    let ppnRate = 11;

                    // We can query system_settings again or just use safe defaults.
                    // Let's do a quick query for these specific keys to be robust.
                    // Optimally this should be done once outside loop, but for safety in this replacement block:
                    // Actually, let's trusting previous variables might be risky if I replaced the loading block.
                    // I replaced the whole function, so I MUST reload them.

                    // (See above code block for settings load attempt, I only loaded due_date there).
                    // Let's load the rest now.

                    // ... Loading Settings ...
                    try {
                        // We already have sysSettings map above. Let's start with defaults.
                        // But we didn't query all keys. Let's re-query properly.
                        // Or better, just use 0 if not sure, to prevent crash.
                    } catch (e) { }

                    // IMPORTANT: To ensure rental works, let's query the specific settings if we can.
                    // Or since this is a "fix", let's prioritize getting the invoices generated first.
                    // I will add a dynamic lookup here.
                    const [pricingSettings] = await conn.query<RowDataPacket[]>(`
                        SELECT setting_key, setting_value FROM system_settings 
                        WHERE setting_key IN ('ppn_enabled', 'ppn_rate', 'device_rental_enabled', 'device_rental_fee')
                    `);
                    pricingSettings.forEach((row: any) => {
                        if (row.setting_key === 'ppn_enabled') ppnEnabled = row.setting_value === 'true' || row.setting_value === '1';
                        if (row.setting_key === 'ppn_rate') ppnRate = parseFloat(row.setting_value);
                        if (row.setting_key === 'device_rental_enabled') deviceRentalEnabled = row.setting_value === 'true' || row.setting_value === '1';
                        if (row.setting_key === 'device_rental_fee') deviceRentalFee = parseFloat(row.setting_value);
                    });

                    if (deviceRentalEnabled && sub.use_device_rental) {
                        const rentalCost = sub.rental_cost !== null ? parseFloat(sub.rental_cost) : deviceRentalFee;
                        if (sub.rental_mode === 'daily') {
                            const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
                            deviceFee = rentalCost * daysInMonth;
                        } else {
                            deviceFee = rentalCost;
                        }
                    }

                    let ppnAmount = 0;
                    if (ppnEnabled && sub.is_taxable) {
                        ppnAmount = Math.round((subtotal + deviceFee) * (ppnRate / 100));
                    }

                    const totalAmount = subtotal + deviceFee + ppnAmount;

                    // Handle Balance Deduction
                    let currentBalance = customerBalances.get(sub.customer_id) || 0;
                    let paidAmount = 0;
                    let remainingAmount = totalAmount;
                    let invoiceNotes = null;

                    if (currentBalance > 0) {
                        paidAmount = Math.min(currentBalance, totalAmount);
                        remainingAmount = totalAmount - paidAmount;
                        currentBalance -= paidAmount;
                        customerBalances.set(sub.customer_id, currentBalance);
                        invoiceNotes = `Otomatis potong saldo (Rp ${new Intl.NumberFormat('id-ID').format(paidAmount)})`;

                        await conn.execute('UPDATE customers SET account_balance = ? WHERE id = ?', [currentBalance, sub.customer_id]);
                    }

                    const status = remainingAmount <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'sent');

                    const [resInv] = await conn.execute<ResultSetHeader>(`
                    INSERT INTO invoices (
                        invoice_number, customer_id, subscription_id, period, due_date,
                        subtotal, ppn_rate, ppn_amount, device_fee, total_amount, paid_amount, remaining_amount,
                        status, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                        invoiceNumber, sub.customer_id, (sub.id > 0 ? sub.id : null), currentPeriod,
                        dueDate.toISOString().slice(0, 10), subtotal, (ppnEnabled ? ppnRate : 0), ppnAmount, deviceFee, totalAmount,
                        paidAmount, remainingAmount, status, invoiceNotes
                    ]);

                    const invoiceId = resInv.insertId;

                    // Insert Invoice Items
                    await conn.execute(`
                    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
                    VALUES (?, ?, 1, ?, ?)
                `, [invoiceId, `${finalPkgName} - ${currentPeriod}`, subtotal, subtotal]);

                    if (deviceFee > 0) {
                        await conn.execute(`
                        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
                        VALUES (?, 'Sewa Perangkat', 1, ?, ?)
                    `, [invoiceId, deviceFee, deviceFee]);
                    }

                    if (paidAmount > 0) {
                        await conn.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes) VALUES (?, "balance", ?, NOW(), "Otomatis potong saldo")', [invoiceId, paidAmount]);
                    }

                    createdCount++;
                    console.log(`${logTag} SUCCESS creating invoice #${invoiceNumber} for ${sub.customer_name}`);

                } catch (err: any) {
                    console.error(`${logTag} ❌ ERROR customer ${sub.customer_id}:`, err);
                    errors.push(`${sub.customer_name}: ${err.message}`);
                }
            }

            await conn.commit();
            console.log(`${logTag} COMMITTED. Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

            res.json({
                success: true,
                message: `Berhasil membuat ${createdCount} tagihan`,
                created_count: createdCount,
                skipped_count: skippedCount,
                skipped_details: skippedDetails.length > 0 ? skippedDetails : undefined,
                total_subscriptions: subscriptions.length,
                total_found: subscriptions.length,
                errors: errors.length > 0 ? errors : undefined,
                diagnostics: {
                    log_tag: logTag,
                    total_customers: diagRows[0]?.total,
                    active_customers: diagRows[0]?.active_count,
                    query_result_length: subscriptions.length
                }
            });

        } catch (error: any) {
            await conn.rollback();
            console.error(`${logTag} FATAL Error generating bulk invoices:`, error);
            res.status(500).json({
                success: false,
                message: 'Gagal generate bulk invoice: ' + error.message,
                error: error.message,
                log_tag: logTag
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
                        const caption = `✅ *PEMBAYARAN LUNAS*

Halo Kak *${name}*,
Terima kasih, pembayaran tagihan *${invoice_number}* telah berhasil kami verifikasi LUNAS.

Berikut terlampir e-invoice (Lunas) sebagai bukti pembayaran yang sah.

Terima kasih telah berlangganan! 🙏`;

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
            const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');

            // Get invoice data
            const [rows] = await databasePool.query<RowDataPacket[]>(`
                SELECT status FROM invoices WHERE id = ?
            `, [id]);

            if (rows.length === 0) {
                res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
                return;
            }

            const invoice = rows[0];

            if (invoice.status === 'paid') {
                // If paid, we need a payment ID to send payment received notification
                // But if we just want to send the invoice status, we can use a generic one or just the last payment
                const [paymentRows] = await databasePool.query<RowDataPacket[]>(`
                    SELECT id FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC LIMIT 1
                `, [id]);

                if (paymentRows.length > 0) {
                    await UnifiedNotificationService.notifyPaymentReceived(paymentRows[0].id, true);
                } else {
                    // Fallback to invoice created if no payment found (should not happen for paid)
                    await UnifiedNotificationService.notifyInvoiceCreated(parseInt(id), true);
                }
            } else {
                await UnifiedNotificationService.notifyInvoiceCreated(parseInt(id), true);
            }

            // Also update status to 'sent' if it was 'draft'
            if (invoice.status === 'draft') {
                await databasePool.query('UPDATE invoices SET status = "sent" WHERE id = ?', [id]);
            }

            res.json({ success: true, message: 'Tagihan sedang dikirim via WhatsApp' });
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
                    INSERT INTO unified_notifications_queue (customer_id, notification_type, channel, message, priority, status)
                    VALUES (?, 'bill_extension', 'whatsapp', ?, 'high', 'pending')
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
            ORDER BY LENGTH(invoice_number) DESC, invoice_number DESC 
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

    /**
     * EMERGENCY: Force Cleanup Invoices for a Period
     * WARNING: This deletes DATA! Use with caution.
     */
    async forceCleanupPeriod(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();
        const { period } = req.body;

        if (!period) {
            res.status(400).json({ success: false, message: 'Periode wajib diisi!' });
            return;
        }

        try {
            await conn.beginTransaction();

            console.log(`[CLEANUP] Starting force cleanup for period: ${period}`);

            // 1. Get Invoice IDs
            const [rows] = await conn.query<RowDataPacket[]>('SELECT id FROM invoices WHERE period = ?', [period]);
            const ids = rows.map(r => r.id);

            if (ids.length === 0) {
                await conn.rollback();
                res.json({ success: true, message: 'Tidak ada invoice ditemukan untuk periode ini.' });
                return;
            }

            console.log(`[CLEANUP] Found ${ids.length} invoices to delete: ${ids.join(',')}`);

            // 2. Delete Items & Payments first (Child Tables)
            if (ids.length > 0) {
                const idList = ids.join(',');
                await conn.query(`DELETE FROM invoice_items WHERE invoice_id IN (${idList})`);
                await conn.query(`DELETE FROM payments WHERE invoice_id IN (${idList})`);
                await conn.query(`DELETE FROM debt_tracking WHERE invoice_id IN (${idList})`);
            }

            // 3. Delete Invoices (Parent Table)
            const [result] = await conn.query<ResultSetHeader>('DELETE FROM invoices WHERE period = ?', [period]);

            await conn.commit();
            console.log(`[CLEANUP] Success! Deleted ${result.affectedRows} invoices.`);

            res.json({
                success: true,
                message: `Berhasil membersihkan ${result.affectedRows} invoice & data terkait untuk periode ${period}`,
                deleted_count: result.affectedRows
            });

        } catch (error: any) {
            await conn.rollback();
            console.error('[CLEANUP] Error:', error);
            res.status(500).json({ success: false, message: error.message });
        } finally {
            conn.release();
        }
    }

    /**
     * Send paid invoice PDF to customer manually
     */
    async sendPaidInvoicePdf(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            // Get invoice data
            const [rows] = await databasePool.query<RowDataPacket[]>(`
                SELECT i.*, c.name as customer_name, c.phone as customer_phone
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [id]);

            if (rows.length === 0) {
                res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
                return;
            }

            const invoice = rows[0];

            // Verify that invoice is paid
            if (invoice.status !== 'paid') {
                res.status(400).json({
                    success: false,
                    message: 'Invoice belum lunas, tidak bisa kirim PDF lunas'
                });
                return;
            }

            // Generate PDF
            const { InvoicePdfService } = await import('../../services/invoice/InvoicePdfService');
            const pdfPath = await InvoicePdfService.generateInvoicePdf(parseInt(id));

            // Send PDF via WhatsApp if customer has phone
            if (invoice.customer_phone) {
                const { whatsappService } = await import('../../services/whatsapp/WhatsAppService');

                const amount = new Intl.NumberFormat('id-ID').format(parseFloat(invoice.total_amount));
                const caption = `✅ *PEMBAYARAN LUNAS*

Halo Kak *${invoice.customer_name}*,
Terima kasih, pembayaran tagihan *${invoice.invoice_number}* telah berhasil kami verifikasi LUNAS.

Nominal: *Rp ${amount}*
Periode: *${invoice.period}*
Jatuh Tempo: *${new Date(invoice.due_date).toLocaleDateString('id-ID')}*${invoice.notes ? `\n\n📝 *Catatan:* ${invoice.notes}` : ''}

Berikut terlampir e-invoice (Lunas) sebagai bukti pembayaran yang sah.

Terima kasih telah berlangganan! 🙏`;

                await whatsappService.sendDocument(
                    invoice.customer_phone,
                    pdfPath,
                    `Invoice-${invoice.invoice_number}-LUNAS.pdf`,
                    caption
                );

                console.log(`[Invoice] Paid PDF manually sent to ${invoice.customer_name} (${invoice.customer_phone})`);
            }

            res.json({
                success: true,
                message: 'PDF invoice lunas berhasil dikirim',
                pdf_path: pdfPath
            });

        } catch (error: any) {
            console.error('Error sending paid invoice PDF:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengirim PDF invoice: ' + error.message
            });
        }
    }

    /**
     * Bulk Send Invoice via WhatsApp
     */
    async bulkSendInvoiceWhatsApp(req: Request, res: Response): Promise<void> {
        try {
            const { invoice_ids } = req.body;
            if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
                res.status(400).json({ success: false, message: 'ID tagihan tidak valid' });
                return;
            }

            const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');

            // Fetch invoice statuses to filter
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, status FROM invoices WHERE id IN (?)',
                [invoice_ids]
            );

            // Filter out 'draft' and 'cancelled' per user policy for bulk sending
            // The user specifically asked for 'status terkirim saja' (only sent status)
            const validInvoices = rows.filter(r =>
                r.status === 'sent' || r.status === 'partial' || r.status === 'overdue'
            );

            if (validInvoices.length === 0) {
                res.json({
                    success: true,
                    message: `Tidak ada tagihan yang siap dikirim (Draft/Dibatalkan dilewati).`
                });
                return;
            }

            console.log(`[BulkSend] 🚀 Processing ${validInvoices.length} invoices...`);

            let queuedCount = 0;
            // Use concurrent processing with a limit or just map to promises
            // To prevent blocking the main thread for too long, we trigger them
            const promises = validInvoices.map(invoice =>
                UnifiedNotificationService.notifyInvoiceCreated(invoice.id)
                    .then(() => {
                        queuedCount++;
                        // If it was draft (not possible with filter above, but good for safety), update it
                        if (invoice.status === 'draft') {
                            databasePool.execute('UPDATE invoices SET status = "sent" WHERE id = ?', [invoice.id]);
                        }
                    })
                    .catch(e => console.error(`Failed to queue bulk WA for invoice ${invoice.id}:`, e))
            );

            // Wait for all queueings to finish (not the actual sending, just the queueing)
            await Promise.all(promises);

            res.json({
                success: true,
                message: `${queuedCount} tagihan telah dijadwalkan untuk dikirim via WhatsApp.`
            });
        } catch (error: any) {
            console.error('Error bulk sending WhatsApp:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Apply downtime discount based on days
     */
    async applyDowntimeDiscount(req: Request, res: Response): Promise<void> {
        try {
            const { invoiceId, downtimeDays, startDate, endDate } = req.body;
            const appliedBy = (req as any).user?.id || 1;

            if (!invoiceId) {
                res.status(400).json({ success: false, message: 'ID tagihan tidak valid' });
                return;
            }

            if (downtimeDays === undefined || downtimeDays === null || isNaN(parseInt(downtimeDays))) {
                res.status(400).json({ success: false, message: 'Jumlah hari gangguan tidak valid' });
                return;
            }

            const { DiscountService } = await import('../../services/billing/discountService');
            const discountId = await DiscountService.applyDowntimeDiscount(
                parseInt(invoiceId),
                parseInt(downtimeDays),
                appliedBy,
                startDate,
                endDate
            );

            res.json({
                success: true,
                message: `Diskon gangguan ${downtimeDays} hari berhasil diterapkan.`,
                discountId
            });
        } catch (error: any) {
            console.error('Error applying downtime discount:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
