import { Request, Response } from 'express';
import { databasePool } from '../db/pool';

export async function getBillingDashboard(req: Request, res: Response): Promise<void> {
    try {
        // Get billing statistics
        const [
            totalInvoicesP,
            paidInvoicesP,
            unpaidInvoicesP,
            overdueInvoicesP,
            totalRevenueP,
            monthlyRevenueP
        ] = await Promise.all([
            databasePool.query('SELECT COUNT(*) AS cnt FROM invoices'),
            databasePool.query("SELECT COUNT(*) AS cnt FROM invoices WHERE status='paid'"),
            databasePool.query("SELECT COUNT(*) AS cnt FROM invoices WHERE status IN ('draft', 'sent', 'partial')"),
            databasePool.query("SELECT COUNT(*) AS cnt FROM invoices WHERE status='overdue'"),
            databasePool.query("SELECT SUM(total_amount) AS total FROM invoices WHERE status='paid'"),
            databasePool.query("SELECT SUM(total_amount) AS total FROM invoices WHERE status='paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())")
        ]);

        const totalInvoices = (totalInvoicesP[0] as any)[0]?.cnt ?? 0;
        const paidInvoices = (paidInvoicesP[0] as any)[0]?.cnt ?? 0;
        const unpaidInvoices = (unpaidInvoicesP[0] as any)[0]?.cnt ?? 0;
        const overdueInvoices = (overdueInvoicesP[0] as any)[0]?.cnt ?? 0;
        const totalRevenue = (totalRevenueP[0] as any)[0]?.total ?? 0;
        const monthlyRevenue = (monthlyRevenueP[0] as any)[0]?.total ?? 0;

        res.render('billing/dashboard', {
            title: 'Billing Dashboard',
            stats: {
                totalInvoices,
                paidInvoices,
                unpaidInvoices,
                overdueInvoices,
                totalRevenue,
                monthlyRevenue
            }
        });
    } catch (error) {
        console.error('Error getting billing dashboard:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Gagal memuat dashboard billing'
        });
    }
}

export async function getTagihanList(req: Request, res: Response): Promise<void> {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string || '';
        const search = req.query.search as string || '';
        const hideIsolated = req.query.hide_isolated as string || '';
        
        const offset = (page - 1) * limit;

        // Build query conditions
        let whereConditions = [];
        let queryParams: any[] = [];

        if (status) {
            whereConditions.push('i.status = ?');
            queryParams.push(status);
        }

        if (search) {
            whereConditions.push('(c.full_name LIKE ? OR c.phone LIKE ? OR i.invoice_number LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Filter isolated customers
        if (hideIsolated === '1') {
            whereConditions.push('(c.is_isolated IS NULL OR c.is_isolated = 0)');
        } else if (hideIsolated === 'only') {
            whereConditions.push('c.is_isolated = 1');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Get invoices with customer info
        const invoicesQuery = `
            SELECT 
                i.*,
                c.full_name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
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

        const invoices = invoicesResult[0] as any[];
        const totalCount = (countResult[0] as any)[0]?.total ?? 0;
        const totalPages = Math.ceil(totalCount / limit);

        res.render('billing/tagihan', {
            title: 'Daftar Tagihan',
            invoices,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit
            },
            filters: {
                status,
                search
            }
        });
    } catch (error) {
        console.error('Error getting tagihan list:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Gagal memuat daftar tagihan'
        });
    }
}

export async function getTagihanDetail(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        
        const invoiceQuery = `
            SELECT 
                i.*,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email,
                c.address as customer_address
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `;

        const [invoiceResult] = await databasePool.query(invoiceQuery, [id]);
        const invoice = (invoiceResult as any[])[0];

        if (!invoice) {
            return res.status(404).render('error', {
                title: 'Not Found',
                message: 'Tagihan tidak ditemukan'
            });
        }

        res.render('billing/tagihan-detail', {
            title: 'Detail Tagihan',
            invoice
        });
    } catch (error) {
        console.error('Error getting tagihan detail:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Gagal memuat detail tagihan'
        });
    }
}

export async function updateTagihanStatus(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'];
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

        res.json({
            success: true,
            message: 'Status tagihan berhasil diperbarui'
        });
    } catch (error) {
        console.error('Error updating tagihan status:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui status tagihan'
        });
    }
}
