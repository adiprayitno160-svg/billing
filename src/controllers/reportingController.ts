import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';

export class ReportingController {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    // Comprehensive dashboard analytics
    public getDashboardAnalytics = async (req: Request, res: Response) => {
        try {
            const { period = '30' } = req.query;
            const days = parseInt(period as string);

            // ONT Analytics
            const [ontAnalytics] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_onts,
                    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_onts,
                    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_onts,
                    SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_onts,
                    AVG(CASE WHEN status = 'online' THEN 1 ELSE 0 END) * 100 as uptime_percentage,
                    COUNT(DISTINCT pon_port) as active_pon_ports
                FROM ont_devices
            `);

            // Customer Analytics
            const [customerAnalytics] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_customers,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_customers,
                    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_customers,
                    COUNT(DISTINCT customer_type) as customer_types
                FROM customers
            `);

            // Billing Analytics
            const [billingAnalytics] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_bills,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
                    SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_bills,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_bills,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue,
                    AVG(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as avg_bill_amount,
                    SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as outstanding_amount
                FROM billing_records
                WHERE billing_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            `, [days]);

            // PON Port Analytics
            const [ponAnalytics] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_ports,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as active_ports,
                    AVG(utilization_percentage) as avg_utilization,
                    MAX(utilization_percentage) as max_utilization,
                    SUM(connected_onts) as total_connected_onts
                FROM pon_ports
            `);

            // Recent Activity
            const [recentActivity] = await this.db.execute(`
                SELECT 
                    'ont_status_change' as activity_type,
                    CONCAT('ONT ', mac_address, ' status changed to ', status) as description,
                    last_updated as timestamp
                FROM ont_devices
                WHERE last_updated >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                
                UNION ALL
                
                SELECT 
                    'billing_created' as activity_type,
                    CONCAT('Bill created for customer ID ', customer_id) as description,
                    created_at as timestamp
                FROM billing_records
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                
                ORDER BY timestamp DESC
                LIMIT 20
            `);

            res.json({
                success: true,
                data: {
                    ont_analytics: Array.isArray(ontAnalytics) ? ontAnalytics[0] : {},
                    customer_analytics: Array.isArray(customerAnalytics) ? customerAnalytics[0] : {},
                    billing_analytics: Array.isArray(billingAnalytics) ? billingAnalytics[0] : {},
                    pon_analytics: Array.isArray(ponAnalytics) ? ponAnalytics[0] : {},
                    recent_activity: recentActivity,
                    period_days: days,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting dashboard analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil analytics dashboard'
            });
        }
    };

    // ONT Performance Report
    public getONTPerformanceReport = async (req: Request, res: Response) => {
        try {
            const { start_date, end_date, pon_port, status } = req.query;

            let query = `
                SELECT 
                    o.id,
                    o.mac_address,
                    o.serial_number,
                    o.status,
                    o.pon_port,
                    o.olt_line_card,
                    o.online_time,
                    o.last_down_time,
                    o.last_updated,
                    c.customer_name,
                    c.customer_phone,
                    c.customer_address,
                    CASE 
                        WHEN o.status = 'online' AND o.last_updated >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 'Excellent'
                        WHEN o.status = 'online' AND o.last_updated >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 'Good'
                        WHEN o.status = 'online' THEN 'Fair'
                        ELSE 'Poor'
                    END as performance_rating
                FROM ont_devices o
                LEFT JOIN customers c ON o.customer_id = c.id
            `;

            const conditions = [];
            const params: any[] = [];

            if (start_date) {
                conditions.push('o.last_updated >= ?');
                params.push(start_date);
            }

            if (end_date) {
                conditions.push('o.last_updated <= ?');
                params.push(end_date);
            }

            if (pon_port) {
                conditions.push('o.pon_port = ?');
                params.push(pon_port);
            }

            if (status) {
                conditions.push('o.status = ?');
                params.push(status);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY o.last_updated DESC';

            const [onts] = await this.db.execute(query, params);

            // Performance summary
            const [performanceSummary] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_onts,
                    SUM(CASE WHEN status = 'online' AND last_updated >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 ELSE 0 END) as excellent_count,
                    SUM(CASE WHEN status = 'online' AND last_updated >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND last_updated < DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 ELSE 0 END) as good_count,
                    SUM(CASE WHEN status = 'online' AND last_updated < DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as fair_count,
                    SUM(CASE WHEN status != 'online' THEN 1 ELSE 0 END) as poor_count
                FROM ont_devices o
                ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
            `, params);

            res.json({
                success: true,
                data: {
                    onts: onts,
                    performance_summary: Array.isArray(performanceSummary) ? performanceSummary[0] : {},
                    filters: {
                        start_date,
                        end_date,
                        pon_port,
                        status
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting ONT performance report:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil laporan performa ONT'
            });
        }
    };

    // Billing Analytics Report
    public getBillingAnalyticsReport = async (req: Request, res: Response) => {
        try {
            const { start_date, end_date, customer_type } = req.query;

            let query = `
                SELECT 
                    br.id,
                    br.customer_id,
                    br.amount,
                    br.status,
                    br.billing_date,
                    br.due_date,
                    br.paid_date,
                    br.created_at,
                    c.customer_name,
                    c.customer_phone,
                    c.customer_type,
                    DATEDIFF(NOW(), br.due_date) as days_overdue
                FROM billing_records br
                LEFT JOIN customers c ON br.customer_id = c.id
            `;

            const conditions = [];
            const params: any[] = [];

            if (start_date) {
                conditions.push('br.billing_date >= ?');
                params.push(start_date);
            }

            if (end_date) {
                conditions.push('br.billing_date <= ?');
                params.push(end_date);
            }

            if (customer_type) {
                conditions.push('c.customer_type = ?');
                params.push(customer_type);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY br.billing_date DESC';

            const [bills] = await this.db.execute(query, params);

            // Billing summary
            const [billingSummary] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_bills,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
                    SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_bills,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_bills,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue,
                    SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as outstanding_amount,
                    SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as overdue_amount,
                    AVG(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as avg_paid_amount,
                    AVG(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as avg_unpaid_amount
                FROM billing_records br
                LEFT JOIN customers c ON br.customer_id = c.id
                ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
            `, params);

            // Monthly revenue trend
            const [monthlyTrend] = await this.db.execute(`
                SELECT 
                    DATE_FORMAT(billing_date, '%Y-%m') as month,
                    COUNT(*) as bill_count,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as revenue,
                    SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as outstanding
                FROM billing_records br
                LEFT JOIN customers c ON br.customer_id = c.id
                ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') + ' AND ' : 'WHERE '}
                billing_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY month
                ORDER BY month
            `, [...params]);

            res.json({
                success: true,
                data: {
                    bills: bills,
                    billing_summary: Array.isArray(billingSummary) ? billingSummary[0] : {},
                    monthly_trend: monthlyTrend,
                    filters: {
                        start_date,
                        end_date,
                        customer_type
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting billing analytics report:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil laporan analytics billing'
            });
        }
    };

    // PON Port Utilization Report
    public getPONUtilizationReport = async (req: Request, res: Response) => {
        try {
            const [ponPorts] = await this.db.execute(`
                SELECT 
                    p.port_number,
                    p.status,
                    p.tx_power,
                    p.rx_power,
                    p.connected_onts,
                    p.max_onts,
                    p.utilization_percentage,
                    p.last_updated,
                    COUNT(o.id) as actual_onts,
                    CASE 
                        WHEN p.utilization_percentage >= 90 THEN 'Critical'
                        WHEN p.utilization_percentage >= 75 THEN 'High'
                        WHEN p.utilization_percentage >= 50 THEN 'Medium'
                        ELSE 'Low'
                    END as utilization_level
                FROM pon_ports p
                LEFT JOIN ont_devices o ON p.port_number = o.pon_port
                GROUP BY p.port_number
                ORDER BY p.utilization_percentage DESC
            `);

            // Utilization summary
            const [utilizationSummary] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_ports,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as active_ports,
                    AVG(utilization_percentage) as avg_utilization,
                    MAX(utilization_percentage) as max_utilization,
                    MIN(utilization_percentage) as min_utilization,
                    SUM(CASE WHEN utilization_percentage >= 90 THEN 1 ELSE 0 END) as critical_ports,
                    SUM(CASE WHEN utilization_percentage >= 75 AND utilization_percentage < 90 THEN 1 ELSE 0 END) as high_ports,
                    SUM(CASE WHEN utilization_percentage >= 50 AND utilization_percentage < 75 THEN 1 ELSE 0 END) as medium_ports,
                    SUM(CASE WHEN utilization_percentage < 50 THEN 1 ELSE 0 END) as low_ports
                FROM pon_ports
            `);

            res.json({
                success: true,
                data: {
                    pon_ports: ponPorts,
                    utilization_summary: Array.isArray(utilizationSummary) ? utilizationSummary[0] : {},
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting PON utilization report:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil laporan utilisasi PON'
            });
        }
    };

    // Customer Analytics Report
    public getCustomerAnalyticsReport = async (req: Request, res: Response) => {
        try {
            const { customer_type, is_active } = req.query;

            let query = `
                SELECT 
                    c.id,
                    c.customer_name,
                    c.customer_phone,
                    c.customer_email,
                    c.customer_address,
                    c.customer_type,
                    c.is_active,
                    c.created_at,
                    COUNT(o.id) as ont_count,
                    SUM(CASE WHEN o.status = 'online' THEN 1 ELSE 0 END) as online_onts,
                    SUM(CASE WHEN o.status = 'offline' THEN 1 ELSE 0 END) as offline_onts,
                    COUNT(br.id) as total_bills,
                    SUM(CASE WHEN br.status = 'paid' THEN br.amount ELSE 0 END) as total_paid,
                    SUM(CASE WHEN br.status = 'unpaid' THEN br.amount ELSE 0 END) as total_unpaid,
                    SUM(CASE WHEN br.status = 'overdue' THEN br.amount ELSE 0 END) as total_overdue
                FROM customers c
                LEFT JOIN ont_devices o ON c.id = o.customer_id
                LEFT JOIN billing_records br ON c.id = br.customer_id
            `;

            const conditions = [];
            const params: any[] = [];

            if (customer_type) {
                conditions.push('c.customer_type = ?');
                params.push(customer_type);
            }

            if (is_active !== undefined) {
                conditions.push('c.is_active = ?');
                params.push(is_active);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' GROUP BY c.id ORDER BY c.created_at DESC';

            const [customers] = await this.db.execute(query, params);

            // Customer summary
            const [customerSummary] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_customers,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_customers,
                    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_customers,
                    COUNT(DISTINCT customer_type) as customer_types,
                    AVG(ont_count) as avg_onts_per_customer
                FROM (
                    SELECT 
                        c.id,
                        c.is_active,
                        c.customer_type,
                        COUNT(o.id) as ont_count
                    FROM customers c
                    LEFT JOIN ont_devices o ON c.id = o.customer_id
                    GROUP BY c.id
                ) as customer_stats
            `);

            res.json({
                success: true,
                data: {
                    customers: customers,
                    customer_summary: Array.isArray(customerSummary) ? customerSummary[0] : {},
                    filters: {
                        customer_type,
                        is_active
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting customer analytics report:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil laporan analytics customer'
            });
        }
    };

    // Export report to CSV
    public exportReport = async (req: Request, res: Response) => {
        try {
            const { report_type, format = 'csv' } = req.query;

            if (format !== 'csv') {
                return res.status(400).json({
                    success: false,
                    message: 'Format export hanya mendukung CSV'
                });
            }

            let data: any[] = [];
            let filename = '';

            switch (report_type) {
                case 'ont_performance':
                    const [ontData] = await this.db.execute(`
                        SELECT 
                            mac_address,
                            serial_number,
                            status,
                            pon_port,
                            online_time,
                            last_down_time,
                            last_updated
                        FROM ont_devices
                        ORDER BY last_updated DESC
                    `);
                    data = Array.isArray(ontData) ? ontData : [];
                    filename = 'ont_performance_report.csv';
                    break;

                case 'billing_analytics':
                    const [billingData] = await this.db.execute(`
                        SELECT 
                            customer_id,
                            amount,
                            status,
                            billing_date,
                            due_date,
                            paid_date
                        FROM billing_records
                        ORDER BY billing_date DESC
                    `);
                    data = Array.isArray(billingData) ? billingData : [];
                    filename = 'billing_analytics_report.csv';
                    break;

                case 'pon_utilization':
                    const [ponData] = await this.db.execute(`
                        SELECT 
                            port_number,
                            status,
                            connected_onts,
                            max_onts,
                            utilization_percentage,
                            last_updated
                        FROM pon_ports
                        ORDER BY port_number
                    `);
                    data = Array.isArray(ponData) ? ponData : [];
                    filename = 'pon_utilization_report.csv';
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Tipe report tidak valid'
                    });
            }

            // Convert to CSV
            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                const csvContent = [
                    headers.join(','),
                    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
                ].join('\n');

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(csvContent);
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Tidak ada data untuk di-export'
                });
            }
        } catch (error) {
            console.error('Error exporting report:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal export report'
            });
        }
    };
}

