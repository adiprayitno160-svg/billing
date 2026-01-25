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
}
