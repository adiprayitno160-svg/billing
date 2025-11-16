import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Simplified Controller untuk Admin Prepaid Management
 * Minimal dependencies, error handling
 */
class PrepaidAdminControllerSimple {
  /**
   * Dashboard Prepaid
   */
  async dashboard(req: Request, res: Response) {
    try {
      // Simple stats with fallback
      const stats = {
        active_customers: 0,
        expired_customers: 0,
        expiring_soon: 0,
        total_revenue_today: 0
      };

      res.render('prepaid/admin/dashboard', {
        title: 'Dashboard Prepaid',
        layout: 'layouts/main',
        stats: stats,
        activeCustomers: [],
        expiringSoon: [],
        recentTransactions: [],
        revenueToday: { total_transactions: 0, revenue: 0 }
      });
    } catch (error) {
      console.error('Prepaid dashboard error:', error);
      res.status(500).send(`
        <h1>Server Error</h1>
        <p>Error: ${error}</p>
        <p>Stack: ${error instanceof Error ? error.stack : 'Unknown'}</p>
        <a href="/">Back to Home</a>
      `);
    }
  }

  /**
   * Customer Prepaid List
   */
  async customers(req: Request, res: Response) {
    try {
      let customers: any[] = [];
      
      try {
        const [result] = await pool.query<RowDataPacket[]>(
          `SELECT c.* FROM customers c WHERE c.billing_mode = 'prepaid' LIMIT 50`
        );
        customers = result;
      } catch (queryError) {
        console.warn('Query error, using empty array:', queryError);
      }

      res.render('prepaid/admin/customers', {
        title: 'Customer Prepaid',
        layout: 'layouts/main',
        customers: customers
      });
    } catch (error) {
      console.error('Prepaid customers error:', error);
      res.status(500).send(`
        <h1>Server Error - Customers</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
    }
  }

  /**
   * Packages Management
   */
  async packages(req: Request, res: Response) {
    try {
      let packages: any[] = [];
      
      try {
        const [result] = await pool.query<RowDataPacket[]>(
          `SELECT pp.* FROM prepaid_packages pp ORDER BY pp.price ASC LIMIT 50`
        );
        packages = result;
      } catch (queryError) {
        console.warn('Query error, using empty array:', queryError);
      }

      res.render('prepaid/admin/packages', {
        title: 'Paket Prepaid',
        layout: 'layouts/main',
        packages: packages
      });
    } catch (error) {
      console.error('Prepaid packages error:', error);
      res.status(500).send(`
        <h1>Server Error - Packages</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
    }
  }

  /**
   * Speed Profiles Management
   */
  async speedProfiles(req: Request, res: Response) {
    try {
      let profiles: any[] = [];
      
      try {
        const [result] = await pool.query<RowDataPacket[]>(
          `SELECT * FROM speed_profiles WHERE is_active = 1 LIMIT 50`
        );
        profiles = result;
      } catch (queryError) {
        console.warn('Query error, using empty array:', queryError);
      }

      res.render('prepaid/admin/speed-profiles', {
        title: 'Speed Profiles',
        layout: 'layouts/main',
        profiles: profiles
      });
    } catch (error) {
      console.error('Speed profiles error:', error);
      res.status(500).send(`
        <h1>Server Error - Speed Profiles</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
    }
  }

  /**
   * Address List Management (Portal Redirect)
   */
  async addressList(req: Request, res: Response) {
    try {
      res.render('prepaid/admin/address-list', {
        title: 'Portal Redirect Management',
        layout: 'layouts/main',
        customers: []
      });
    } catch (error) {
      console.error('Address list error:', error);
      res.status(500).send(`
        <h1>Server Error - Address List</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
    }
  }

  /**
   * Active Subscriptions
   */
  async subscriptions(req: Request, res: Response) {
    try {
      let subscriptions: any[] = [];
      
      try {
        const [result] = await pool.query<RowDataPacket[]>(
          `SELECT pps.* FROM prepaid_package_subscriptions pps 
           WHERE pps.status = 'active' LIMIT 50`
        );
        subscriptions = result;
      } catch (queryError) {
        console.warn('Query error, using empty array:', queryError);
      }

      res.render('prepaid/admin/subscriptions', {
        title: 'Active Subscriptions',
        layout: 'layouts/main',
        subscriptions: subscriptions
      });
    } catch (error) {
      console.error('Subscriptions error:', error);
      res.status(500).send(`
        <h1>Server Error - Subscriptions</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
    }
  }

  /**
   * Reports
   */
  async reports(req: Request, res: Response) {
    try {
      res.render('prepaid/admin/reports', {
        title: 'Laporan Prepaid',
        layout: 'layouts/main',
        revenueByDay: [],
        packagePopularity: [],
        monthlyRevenue: []
      });
    } catch (error) {
      console.error('Reports error:', error);
      res.status(500).send(`
        <h1>Server Error - Reports</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
    }
  }

  /**
   * Manual trigger scheduler (for testing)
   */
  async triggerScheduler(req: Request, res: Response) {
    try {
      res.json({
        success: true,
        message: 'Scheduler triggered (demo mode)'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add customer to portal redirect (manual)
   */
  async addToPortalRedirect(req: Request, res: Response) {
    try {
      req.flash('success', 'Feature coming soon');
      res.redirect('/prepaid/address-list');
    } catch (error) {
      console.error('Add to redirect error:', error);
      req.flash('error', 'Server error');
      res.redirect('/prepaid/address-list');
    }
  }

  /**
   * Remove customer from portal redirect
   */
  async removeFromPortalRedirect(req: Request, res: Response) {
    try {
      req.flash('success', 'Feature coming soon');
      res.redirect('/prepaid/address-list');
    } catch (error) {
      console.error('Remove from redirect error:', error);
      req.flash('error', 'Server error');
      res.redirect('/prepaid/address-list');
    }
  }
}

export default new PrepaidAdminControllerSimple();

