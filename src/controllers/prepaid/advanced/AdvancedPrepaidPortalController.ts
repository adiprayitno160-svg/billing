/**
 * Advanced Prepaid Portal Controller
 * 
 * Customer-facing portal for advanced prepaid system
 */

import { Request, Response } from 'express';
import { AdvancedPackageService, AdvancedSubscriptionService, VoucherService, ReferralService, UsageTrackingService } from '../../../services/prepaid/advanced';

export class AdvancedPrepaidPortalController {
  /**
   * Portal dashboard
   */
  async dashboard(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).portalCustomerId;
      
      if (!customerId) {
        return res.redirect('/prepaid/advanced/portal/login');
      }
      
      // Get active subscription
      const subscription = await AdvancedSubscriptionService.getActiveSubscription(customerId);
      
      // Get usage stats if subscription exists
      let usageStats = null;
      if (subscription) {
        usageStats = await UsageTrackingService.getUsageStats(subscription.id!);
      }
      
      // Get customer subscriptions history
      const subscriptions = await AdvancedSubscriptionService.getCustomerSubscriptions(customerId);
      
      // Get referral stats
      const referralStats = await ReferralService.getReferralStats(customerId);
      
      res.render('prepaid/advanced/portal/dashboard', {
        title: 'My Dashboard',
        subscription,
        usageStats,
        subscriptions,
        referralStats,
        layout: 'layouts/portal'
      });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load dashboard',
        error: error.message,
        layout: 'layouts/portal'
      });
    }
  }
  
  /**
   * Packages listing
   */
  async packages(req: Request, res: Response): Promise<void> {
    try {
      const filters: any = {
        is_active: true
      };
      
      if (req.query.type) {
        filters.package_type = req.query.type;
      }
      
      if (req.query.connection_type) {
        filters.connection_type = req.query.connection_type;
      }
      
      const packages = await AdvancedPackageService.getAllPackages(filters);
      const featured = await AdvancedPackageService.getFeaturedPackages(3);
      const popular = await AdvancedPackageService.getPopularPackages(5);
      
      res.render('prepaid/advanced/portal/packages', {
        title: 'Choose Package',
        packages,
        featured,
        popular,
        filters: req.query,
        layout: 'layouts/portal'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load packages',
        error: error.message,
        layout: 'layouts/portal'
      });
    }
  }
  
  /**
   * Package details
   */
  async packageDetail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const packageId = parseInt(id);
      const pkg = await AdvancedPackageService.getPackageById(packageId);
      
      if (!pkg || !pkg.is_active) {
        return res.status(404).render('error', {
          title: 'Package Not Found',
          message: 'Package tidak ditemukan',
          layout: 'layouts/portal'
        });
      }
      
      const pricing = AdvancedPackageService.calculateFinalPrice(pkg);
      
      res.render('prepaid/advanced/portal/package-detail', {
        title: pkg.name,
        package: pkg,
        pricing,
        layout: 'layouts/portal'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load package',
        error: error.message,
        layout: 'layouts/portal'
      });
    }
  }
  
  /**
   * Purchase package (review & payment)
   */
  async purchasePackage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).portalCustomerId;
      const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const packageId = parseInt(id);
      
      if (!customerId) {
        return res.redirect('/prepaid/advanced/portal/login');
      }
      
      const pkg = await AdvancedPackageService.getPackageById(packageId);
      if (!pkg || !pkg.is_active) {
        return res.redirect('/prepaid/advanced/portal/packages?error=Package not found');
      }
      
      // Check for voucher
      let voucher = null;
      let voucherDiscount = 0;
      if (req.query.voucher) {
        const validation = await VoucherService.validateVoucher(
          req.query.voucher as string,
          packageId,
          pkg.base_price,
          customerId
        );
        
        if (validation.valid) {
          voucher = validation.voucher;
          voucherDiscount = validation.discount_amount || 0;
        }
      }
      
      const pricing = AdvancedPackageService.calculateFinalPrice(pkg, voucherDiscount);
      
      // Get referral code if available
      const referralStats = await ReferralService.getReferralStats(customerId);
      
      res.render('prepaid/advanced/portal/purchase', {
        title: 'Purchase Package',
        package: pkg,
        pricing,
        voucher,
        voucherDiscount,
        referralCode: referralStats.referral_code,
        layout: 'layouts/portal'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to process purchase',
        error: error.message,
        layout: 'layouts/portal'
      });
    }
  }
  
  /**
   * Process purchase
   */
  async processPurchase(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).portalCustomerId;
      const packageId = parseInt(req.body.package_id);
      
      if (!customerId) {
        return res.redirect('/prepaid/advanced/portal/login');
      }
      
      // Validate voucher if provided
      let voucherCode = null;
      let voucherDiscount = 0;
      if (req.body.voucher_code) {
        const pkg = await AdvancedPackageService.getPackageById(packageId);
        if (pkg) {
          const validation = await VoucherService.validateVoucher(
            req.body.voucher_code,
            packageId,
            pkg.base_price,
            customerId
          );
          
          if (validation.valid) {
            voucherCode = req.body.voucher_code;
            voucherDiscount = validation.discount_amount || 0;
          } else {
            return res.redirect(`/prepaid/advanced/portal/packages/${packageId}?error=${encodeURIComponent(validation.error || 'Invalid voucher')}`);
          }
        }
      }
      
      // Process payment (this would integrate with payment service)
      // For now, create subscription directly
      
      const result = await AdvancedSubscriptionService.activateSubscription({
        customer_id: customerId,
        package_id: packageId,
        voucher_code: voucherCode || undefined,
        referral_code: req.body.referral_code || undefined,
        auto_renew: req.body.auto_renew === '1'
      });
      
      if (result.success) {
        // Apply voucher if used
        if (voucherCode && result.subscription_id) {
          // This would be handled in payment processing
        }
        
        res.redirect(`/prepaid/advanced/portal/dashboard?success=Package activated successfully`);
      } else {
        res.redirect(`/prepaid/advanced/portal/packages/${packageId}?error=${encodeURIComponent(result.error || 'Failed to activate package')}`);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      res.redirect(`/prepaid/advanced/portal/packages?error=${encodeURIComponent(error.message)}`);
    }
  }
  
  /**
   * Usage history
   */
  async usageHistory(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).portalCustomerId;
      
      if (!customerId) {
        return res.redirect('/prepaid/advanced/portal/login');
      }
      
      const subscription = await AdvancedSubscriptionService.getActiveSubscription(customerId);
      
      if (!subscription) {
        return res.render('prepaid/advanced/portal/no-subscription', {
          title: 'No Active Subscription',
          layout: 'layouts/portal'
        });
      }
      
      // Get date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const usageHistory = await UsageTrackingService.getUsageHistory(
        subscription.id!,
        startDate,
        endDate
      );
      
      const usageStats = await UsageTrackingService.getUsageStats(subscription.id!);
      
      res.render('prepaid/advanced/portal/usage-history', {
        title: 'Usage History',
        subscription,
        usageHistory,
        usageStats,
        layout: 'layouts/portal'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load usage history',
        error: error.message,
        layout: 'layouts/portal'
      });
    }
  }
  
  /**
   * Referral page
   */
  async referrals(req: Request, res: Response): Promise<void> {
    try {
      const customerId = (req.session as any).portalCustomerId;
      
      if (!customerId) {
        return res.redirect('/prepaid/advanced/portal/login');
      }
      
      const referralStats = await ReferralService.getReferralStats(customerId);
      const referrals = await ReferralService.getReferralsByReferrer(customerId);
      
      res.render('prepaid/advanced/portal/referrals', {
        title: 'Referral Program',
        referralStats,
        referrals,
        layout: 'layouts/portal'
      });
    } catch (error: any) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load referrals',
        error: error.message,
        layout: 'layouts/portal'
      });
    }
  }
}

export default new AdvancedPrepaidPortalController();




