import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import PrepaidActivationService from '../../services/prepaid/PrepaidActivationService';
import SpeedProfileService from '../../services/prepaid/SpeedProfileService';

/**
 * Controller untuk Prepaid Package Selection
 * Handle package listing, selection, dan info
 */
class PrepaidPackageController {
  /**
   * Show package selection page
   */
  async showPackages(req: Request, res: Response) {
    try {
      const customerId = (req.session as any)?.portalCustomerId || 1; // Default to customer 1 for testing

      // Get customer details
      const [customerRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ? LIMIT 1',
        [customerId]
      );

      const customer = customerRows.length > 0 ? customerRows[0] : {
        id: customerId,
        name: 'Demo Customer',
        customer_code: 'DEMO001'
      };

      // Get active packages with speed profiles
      const [packages] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pp.*,
          sp.name as speed_profile_name,
          sp.download_mbps,
          sp.upload_mbps
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.is_active = 1 AND (pp.status = 'active' OR pp.status IS NULL)
         ORDER BY pp.price ASC`
      );

      // Get active subscription
      let activeSubscription = null;
      try {
        activeSubscription = await PrepaidActivationService.getActiveSubscription(customerId);
      } catch (e) {
        console.warn('No active subscription:', e);
      }

      res.render('prepaid/portal-packages', {
        title: 'Pilih Paket Internet',
        layout: false,
        customer: customer,
        packages: packages,
        activeSubscription: activeSubscription,
        customerName: (req.session as any)?.customerName || customer.name,
        error: req.query.error || null,
        success: req.query.success || null
      });
    } catch (error) {
      console.error('Package list error:', error);
      res.status(500).send(`Server error: ${error}`);
    }
  }

  /**
   * Show package detail
   */
  async showPackageDetail(req: Request, res: Response) {
    try {
      const packageId = parseInt(req.params.id);
      const customerId = (req.session as any).portalCustomerId;

      // Get package details
      const [packageRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pp.*,
          sp.name as speed_profile_name,
          sp.download_mbps,
          sp.upload_mbps,
          sp.burst_limit_mbps,
          sp.burst_time_seconds
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.id = ?`,
        [packageId]
      );

      if (packageRows.length === 0) {
        return res.redirect('/prepaid/portal/packages?error=Paket tidak ditemukan');
      }

      const packageData = packageRows[0];

      // Get customer
      const [customerRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );

      res.render('prepaid/portal-package-detail', {
        title: `Paket ${packageData.name}`,
        layout: false,
        package: packageData,
        customer: customerRows[0],
        customerName: (req.session as any).customerName
      });
    } catch (error) {
      console.error('Package detail error:', error);
      res.status(500).send('Server error');
    }
  }

  /**
   * Select package for purchase (redirect to payment)
   */
  async selectPackage(req: Request, res: Response) {
    try {
      const packageId = parseInt(req.body.package_id);
      const customerId = (req.session as any).portalCustomerId;

      if (!packageId) {
        return res.redirect('/prepaid/portal/packages?error=Paket harus dipilih');
      }

      // Validate package exists
      const [packageRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM prepaid_packages WHERE id = ? AND is_active = 1',
        [packageId]
      );

      if (packageRows.length === 0) {
        return res.redirect('/prepaid/portal/packages?error=Paket tidak valid');
      }

      // Store selected package in session
      if (req.session) {
        (req.session as any).selectedPackageId = packageId;
        (req.session as any).selectedPackagePrice = packageRows[0].price;
      }

      // Redirect to payment page
      res.redirect(`/prepaid/portal/payment/${packageId}`);
    } catch (error) {
      console.error('Package selection error:', error);
      res.redirect('/prepaid/portal/packages?error=Terjadi kesalahan');
    }
  }

  /**
   * Get all active packages (API endpoint)
   */
  async getActivePackagesAPI(req: Request, res: Response) {
    try {
      const [packages] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pp.*,
          sp.name as speed_profile_name,
          sp.download_mbps,
          sp.upload_mbps
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.is_active = 1 AND (pp.status = 'active' OR pp.status IS NULL)
         ORDER BY pp.price ASC`
      );

      res.json({
        success: true,
        packages: packages
      });
    } catch (error) {
      console.error('Get packages API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get packages'
      });
    }
  }

  /**
   * Get package by ID (API endpoint)
   */
  async getPackageByIdAPI(req: Request, res: Response) {
    try {
      const packageId = parseInt(req.params.id);

      const [packageRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pp.*,
          sp.name as speed_profile_name,
          sp.download_mbps,
          sp.upload_mbps,
          sp.burst_limit_mbps,
          sp.burst_time_seconds
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.id = ?`,
        [packageId]
      );

      if (packageRows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        });
      }

      res.json({
        success: true,
        package: packageRows[0]
      });
    } catch (error) {
      console.error('Get package API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get package'
      });
    }
  }
}

export default new PrepaidPackageController();

