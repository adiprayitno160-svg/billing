/**
 * Advanced Prepaid Admin Controller
 * 
 * Handles admin-facing routes for advanced prepaid system
 */

import { Request, Response } from 'express';
import { AdvancedPackageService, AdvancedSubscriptionService, VoucherService, ReferralService, AnalyticsService } from '../../../services/prepaid/advanced';

export class AdvancedPrepaidAdminController {
  /**
   * Dashboard overview
   */
  async dashboard(req: Request, res: Response): Promise<void> {
    try {
      const analytics = await AnalyticsService.getDashboardData();
      const topPackages = await AnalyticsService.getPackagePerformance(10);
      
      res.render('prepaid/advanced/admin/dashboard', {
        title: 'Advanced Prepaid Dashboard',
        analytics,
        topPackages,
        currentPath: '/prepaid/advanced/dashboard'
      });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load dashboard',
        error: error.message
      });
    }
  }
  
  /**
   * Package management
   */
  async packages(req: Request, res: Response): Promise<void> {
    try {
      const filters: any = {
        is_active: req.query.status !== 'inactive'
      };
      
      if (req.query.type) {
        filters.package_type = req.query.type;
      }
      
      if (req.query.connection_type) {
        filters.connection_type = req.query.connection_type;
      }
      
      const packages = await AdvancedPackageService.getAllPackages(filters);
      
      res.render('prepaid/advanced/admin/packages', {
        title: 'Package Management',
        packages,
        filters: req.query,
        currentPath: '/prepaid/advanced/packages'
      });
    } catch (error: any) {
      console.error('Packages error:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load packages',
        error: error.message
      });
    }
  }
  
  /**
   * Create package form
   */
  async showCreatePackage(req: Request, res: Response): Promise<void> {
    try {
      res.render('prepaid/advanced/admin/package-form', {
        title: 'Create Package',
        package: null,
        mode: 'create',
        currentPath: '/prepaid/advanced/packages'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load form',
        error: error.message
      });
    }
  }
  
  /**
   * Edit package form
   */
  async showEditPackage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
      const pkg = await AdvancedPackageService.getPackageById(packageId);
      
      if (!pkg) {
        return res.status(404).render('error', {
          title: 'Not Found',
          message: 'Package not found'
        });
      }
      
      res.render('prepaid/advanced/admin/package-form', {
        title: 'Edit Package',
        package: pkg,
        mode: 'edit',
        currentPath: '/prepaid/advanced/packages'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load package',
        error: error.message
      });
    }
  }
  
  /**
   * Create package
   */
  async createPackage(req: Request, res: Response): Promise<void> {
    try {
      const packageData = {
        name: req.body.name,
        description: req.body.description,
        package_code: req.body.package_code,
        package_type: req.body.package_type,
        tier_level: parseInt(req.body.tier_level) || 1,
        connection_type: req.body.connection_type,
        download_mbps: parseFloat(req.body.download_mbps),
        upload_mbps: parseFloat(req.body.upload_mbps),
        duration_days: parseInt(req.body.duration_days),
        duration_hours: parseInt(req.body.duration_hours) || 0,
        base_price: parseFloat(req.body.base_price),
        discount_price: req.body.discount_price ? parseFloat(req.body.discount_price) : undefined,
        promo_price: req.body.promo_price ? parseFloat(req.body.promo_price) : undefined,
        data_quota_gb: req.body.data_quota_gb ? parseFloat(req.body.data_quota_gb) : undefined,
        data_quota_type: req.body.data_quota_type || 'none',
        mikrotik_profile_name: req.body.mikrotik_profile_name || undefined,
        speed_profile_id: req.body.speed_profile_id ? parseInt(req.body.speed_profile_id) : undefined,
        parent_download_queue: req.body.parent_download_queue || undefined,
        parent_upload_queue: req.body.parent_upload_queue || undefined,
        is_bundle: req.body.is_bundle === '1',
        features: req.body.features ? JSON.parse(req.body.features) : undefined,
        max_devices: parseInt(req.body.max_devices) || 1,
        allow_sharing: req.body.allow_sharing === '1',
        allow_rollover: req.body.allow_rollover === '1',
        rollover_days: parseInt(req.body.rollover_days) || 7,
        auto_renew_enabled: req.body.auto_renew_enabled === '1',
        auto_renew_discount: req.body.auto_renew_discount ? parseFloat(req.body.auto_renew_discount) : undefined,
        is_active: req.body.is_active !== '0',
        is_featured: req.body.is_featured === '1',
        is_popular: req.body.is_popular === '1',
        sort_order: parseInt(req.body.sort_order) || 0,
        tags: req.body.tags ? req.body.tags.split(',').map((t: string) => t.trim()) : undefined
      };
      
      const packageId = await AdvancedPackageService.createPackage(packageData);
      
      res.redirect(`/prepaid/advanced/packages?success=Package created successfully`);
    } catch (error: any) {
      res.redirect(`/prepaid/advanced/packages/create?error=${encodeURIComponent(error.message)}`);
    }
  }
  
  /**
   * Update package
   */
  async updatePackage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
      
      const updates: any = {
        name: req.body.name,
        description: req.body.description,
        package_type: req.body.package_type,
        tier_level: parseInt(req.body.tier_level) || 1,
        connection_type: req.body.connection_type,
        download_mbps: parseFloat(req.body.download_mbps),
        upload_mbps: parseFloat(req.body.upload_mbps),
        duration_days: parseInt(req.body.duration_days),
        base_price: parseFloat(req.body.base_price),
        is_active: req.body.is_active !== '0'
      };
      
      if (req.body.discount_price) updates.discount_price = parseFloat(req.body.discount_price);
      if (req.body.promo_price) updates.promo_price = parseFloat(req.body.promo_price);
      
      await AdvancedPackageService.updatePackage(packageId, updates);
      
      res.redirect(`/prepaid/advanced/packages?success=Package updated successfully`);
    } catch (error: any) {
      res.redirect(`/prepaid/advanced/packages/edit/${req.params.id}?error=${encodeURIComponent(error.message)}`);
    }
  }
  
  /**
   * Subscriptions list
   */
  async subscriptions(req: Request, res: Response): Promise<void> {
    try {
      let subscriptions: any[] = [];
      
      if (req.query.customer_id) {
        const customerId = parseInt(req.query.customer_id as string);
        subscriptions = await AdvancedSubscriptionService.getCustomerSubscriptions(customerId);
      } else if (req.query.status) {
        // Get all subscriptions with status
        // Need to add method to service
      }
      
      res.render('prepaid/advanced/admin/subscriptions', {
        title: 'Subscriptions',
        subscriptions,
        filters: req.query,
        currentPath: '/prepaid/advanced/subscriptions'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load subscriptions',
        error: error.message
      });
    }
  }
  
  /**
   * Vouchers management
   */
  async vouchers(req: Request, res: Response): Promise<void> {
    try {
      const vouchers = await VoucherService.getAllVouchers(req.query.active !== 'false');
      
      res.render('prepaid/advanced/admin/vouchers', {
        title: 'Voucher Management',
        vouchers,
        currentPath: '/prepaid/advanced/vouchers'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load vouchers',
        error: error.message
      });
    }
  }
  
  /**
   * Referrals management
   */
  async referrals(req: Request, res: Response): Promise<void> {
    try {
      let referrals: any[] = [];
      
      if (req.query.customer_id) {
        const customerId = parseInt(req.query.customer_id as string);
        referrals = await ReferralService.getReferralsByReferrer(customerId);
      }
      
      res.render('prepaid/advanced/admin/referrals', {
        title: 'Referral Program',
        referrals,
        currentPath: '/prepaid/advanced/referrals'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load referrals',
        error: error.message
      });
    }
  }
  
  /**
   * Analytics page
   */
  async analytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = await AnalyticsService.getDashboardData();
      const topPackages = await AnalyticsService.getPackagePerformance(20);
      
      res.render('prepaid/advanced/admin/analytics', {
        title: 'Analytics & Reports',
        analytics,
        topPackages,
        currentPath: '/prepaid/advanced/analytics'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load analytics',
        error: error.message
      });
    }
  }
}

export default new AdvancedPrepaidAdminController();




