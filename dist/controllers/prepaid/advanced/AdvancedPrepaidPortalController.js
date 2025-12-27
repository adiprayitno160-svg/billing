"use strict";
/**
 * Advanced Prepaid Portal Controller
 *
 * Customer-facing portal for advanced prepaid system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedPrepaidPortalController = void 0;
const advanced_1 = require("../../../services/prepaid/advanced");
class AdvancedPrepaidPortalController {
    /**
     * Portal dashboard
     */
    async dashboard(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            if (!customerId) {
                return res.redirect('/prepaid/advanced/portal/login');
            }
            // Get active subscription
            const subscription = await advanced_1.AdvancedSubscriptionService.getActiveSubscription(customerId);
            // Get usage stats if subscription exists
            let usageStats = null;
            if (subscription) {
                usageStats = await advanced_1.UsageTrackingService.getUsageStats(subscription.id);
            }
            // Get customer subscriptions history
            const subscriptions = await advanced_1.AdvancedSubscriptionService.getCustomerSubscriptions(customerId);
            // Get referral stats
            const referralStats = await advanced_1.ReferralService.getReferralStats(customerId);
            res.render('prepaid/advanced/portal/dashboard', {
                title: 'My Dashboard',
                subscription,
                usageStats,
                subscriptions,
                referralStats,
                layout: 'layouts/portal'
            });
        }
        catch (error) {
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
    async packages(req, res) {
        try {
            const filters = {
                is_active: true
            };
            if (req.query.type) {
                filters.package_type = req.query.type;
            }
            if (req.query.connection_type) {
                filters.connection_type = req.query.connection_type;
            }
            const packages = await advanced_1.AdvancedPackageService.getAllPackages(filters);
            const featured = await advanced_1.AdvancedPackageService.getFeaturedPackages(3);
            const popular = await advanced_1.AdvancedPackageService.getPopularPackages(5);
            res.render('prepaid/advanced/portal/packages', {
                title: 'Choose Package',
                packages,
                featured,
                popular,
                filters: req.query,
                layout: 'layouts/portal'
            });
        }
        catch (error) {
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
    async packageDetail(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id is required' });
            }
            const packageId = parseInt(id);
            const pkg = await advanced_1.AdvancedPackageService.getPackageById(packageId);
            if (!pkg || !pkg.is_active) {
                return res.status(404).render('error', {
                    title: 'Package Not Found',
                    message: 'Package tidak ditemukan',
                    layout: 'layouts/portal'
                });
            }
            const pricing = advanced_1.AdvancedPackageService.calculateFinalPrice(pkg);
            res.render('prepaid/advanced/portal/package-detail', {
                title: pkg.name,
                package: pkg,
                pricing,
                layout: 'layouts/portal'
            });
        }
        catch (error) {
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
    async purchasePackage(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id is required' });
            }
            const packageId = parseInt(id);
            if (!customerId) {
                return res.redirect('/prepaid/advanced/portal/login');
            }
            const pkg = await advanced_1.AdvancedPackageService.getPackageById(packageId);
            if (!pkg || !pkg.is_active) {
                return res.redirect('/prepaid/advanced/portal/packages?error=Package not found');
            }
            // Check for voucher
            let voucher = null;
            let voucherDiscount = 0;
            if (req.query.voucher) {
                const validation = await advanced_1.VoucherService.validateVoucher(req.query.voucher, packageId, pkg.base_price, customerId);
                if (validation.valid) {
                    voucher = validation.voucher;
                    voucherDiscount = validation.discount_amount || 0;
                }
            }
            const pricing = advanced_1.AdvancedPackageService.calculateFinalPrice(pkg, voucherDiscount);
            // Get referral code if available
            const referralStats = await advanced_1.ReferralService.getReferralStats(customerId);
            res.render('prepaid/advanced/portal/purchase', {
                title: 'Purchase Package',
                package: pkg,
                pricing,
                voucher,
                voucherDiscount,
                referralCode: referralStats.referral_code,
                layout: 'layouts/portal'
            });
        }
        catch (error) {
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
    async processPurchase(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const packageId = parseInt(req.body.package_id);
            if (!customerId) {
                return res.redirect('/prepaid/advanced/portal/login');
            }
            // Validate voucher if provided
            let voucherCode = null;
            let voucherDiscount = 0;
            if (req.body.voucher_code) {
                const pkg = await advanced_1.AdvancedPackageService.getPackageById(packageId);
                if (pkg) {
                    const validation = await advanced_1.VoucherService.validateVoucher(req.body.voucher_code, packageId, pkg.base_price, customerId);
                    if (validation.valid) {
                        voucherCode = req.body.voucher_code;
                        voucherDiscount = validation.discount_amount || 0;
                    }
                    else {
                        return res.redirect(`/prepaid/advanced/portal/packages/${packageId}?error=${encodeURIComponent(validation.error || 'Invalid voucher')}`);
                    }
                }
            }
            // Process payment (this would integrate with payment service)
            // For now, create subscription directly
            const result = await advanced_1.AdvancedSubscriptionService.activateSubscription({
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
            }
            else {
                res.redirect(`/prepaid/advanced/portal/packages/${packageId}?error=${encodeURIComponent(result.error || 'Failed to activate package')}`);
            }
        }
        catch (error) {
            console.error('Purchase error:', error);
            res.redirect(`/prepaid/advanced/portal/packages?error=${encodeURIComponent(error.message)}`);
        }
    }
    /**
     * Usage history
     */
    async usageHistory(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            if (!customerId) {
                return res.redirect('/prepaid/advanced/portal/login');
            }
            const subscription = await advanced_1.AdvancedSubscriptionService.getActiveSubscription(customerId);
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
            const usageHistory = await advanced_1.UsageTrackingService.getUsageHistory(subscription.id, startDate, endDate);
            const usageStats = await advanced_1.UsageTrackingService.getUsageStats(subscription.id);
            res.render('prepaid/advanced/portal/usage-history', {
                title: 'Usage History',
                subscription,
                usageHistory,
                usageStats,
                layout: 'layouts/portal'
            });
        }
        catch (error) {
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
    async referrals(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            if (!customerId) {
                return res.redirect('/prepaid/advanced/portal/login');
            }
            const referralStats = await advanced_1.ReferralService.getReferralStats(customerId);
            const referrals = await advanced_1.ReferralService.getReferralsByReferrer(customerId);
            res.render('prepaid/advanced/portal/referrals', {
                title: 'Referral Program',
                referralStats,
                referrals,
                layout: 'layouts/portal'
            });
        }
        catch (error) {
            res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load referrals',
                error: error.message,
                layout: 'layouts/portal'
            });
        }
    }
}
exports.AdvancedPrepaidPortalController = AdvancedPrepaidPortalController;
exports.default = new AdvancedPrepaidPortalController();
//# sourceMappingURL=AdvancedPrepaidPortalController.js.map