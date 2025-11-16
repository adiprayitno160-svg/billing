/**
 * Prepaid Package Management Controller
 * Admin interface untuk mengelola paket prepaid (PPPoE & Static IP)
 */

import { Request, Response } from 'express';
import { PrepaidPackageService, PrepaidPackage } from '../../services/prepaid/PrepaidPackageService';
import { PrepaidQueueService } from '../../services/prepaid/PrepaidQueueService';
import { getPppProfiles, updatePppProfile } from '../../services/mikrotikService';

class PrepaidPackageManagementController {
  constructor() {
    this.index = this.index.bind(this);
    this.showCreateForm = this.showCreateForm.bind(this);
    this.createPackage = this.createPackage.bind(this);
    this.showEditForm = this.showEditForm.bind(this);
    this.updatePackage = this.updatePackage.bind(this);
    this.deletePackage = this.deletePackage.bind(this);
    this.getParentQueues = this.getParentQueues.bind(this);
    this.getProfileRateLimit = this.getProfileRateLimit.bind(this);
  }

  /**
   * Display all packages (admin view)
   */
  async index(req: Request, res: Response): Promise<void> {
    try {
      console.log('[PrepaidPackageManagementController] Loading packages...');
      
      // Simple direct query untuk speed
      const packages = await PrepaidPackageService.getAllPackages();
      
      console.log('[PrepaidPackageManagementController] Loaded', packages.length, 'packages');

      res.render('prepaid/admin/packages-management', {
        title: 'Manajemen Paket Prepaid',
        packages: packages || [],
        success: req.query.success || null,
        error: req.query.error || null,
      });
    } catch (error) {
      console.error('[PrepaidPackageManagementController] ERROR:', error);
      
      // Fallback: render dengan empty packages
      try {
        res.render('prepaid/admin/packages-management', {
          title: 'Manajemen Paket Prepaid',
          packages: [],
          success: null,
          error: error instanceof Error ? error.message : 'Failed to load packages. Check if migration has been run.',
        });
      } catch (renderError) {
        // Last resort: simple error response
        res.status(500).send(`
          <h1>Error Loading Packages</h1>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <h2>Possible Solutions:</h2>
          <ol>
            <li>Run migration: <code>mysql -u root -p billing_db < migrations/complete_prepaid_system.sql</code></li>
            <li>Compile TypeScript: <code>npm run build</code></li>
            <li>Restart server: <code>pm2 restart billing-system</code></li>
            <li>Check logs for details</li>
          </ol>
          <a href="/prepaid/dashboard">Back to Dashboard</a>
        `);
      }
    }
  }

  /**
   * Show create package form
   */
  async showCreateForm(req: Request, res: Response): Promise<void> {
    try {
      // Get parent queues from Mikrotik
      let parentQueues = { download: ['DOWNLOAD ALL'], upload: ['UPLOAD ALL'] };
      
      try {
        parentQueues = await PrepaidPackageService.getParentQueuesFromMikrotik();
      } catch (error) {
        console.warn('Failed to get parent queues from Mikrotik, using defaults');
      }

      res.render('prepaid/admin/package-form', {
        title: 'Buat Paket Prepaid Baru',
        package: null,
        parentQueues,
        isEdit: false,
      });
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error in showCreateForm:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load form'));
    }
  }

  /**
   * Create new package
   */
  async createPackage(req: Request, res: Response): Promise<void> {
    try {
      const packageData: PrepaidPackage = {
        name: req.body.name,
        description: req.body.description || '',
        connection_type: req.body.connection_type,
        mikrotik_profile_name: req.body.mikrotik_profile_name || undefined,
        parent_download_queue: req.body.parent_download_queue || undefined,
        parent_upload_queue: req.body.parent_upload_queue || undefined,
        download_mbps: parseFloat(req.body.download_mbps),
        upload_mbps: parseFloat(req.body.upload_mbps),
        duration_days: parseInt(req.body.duration_days),
        price: parseFloat(req.body.price),
        is_active: req.body.is_active === 'true' || req.body.is_active === '1',
        download_limit: req.body.download_limit || undefined,
        upload_limit: req.body.upload_limit || undefined,
      };

      const packageId = await PrepaidPackageService.createPackage(packageData);

      // If PPPoE package, update MikroTik profile rate limit
      if (packageData.connection_type === 'pppoe' && packageData.mikrotik_profile_name) {
        try {
          const mikrotikConfig = await PrepaidQueueService.getMikrotikConfig();
          if (mikrotikConfig) {
            // Get profile from MikroTik to find its ID
            const configWithTls: { host: string; port: number; username: string; password: string; use_tls: boolean } = {
                ...mikrotikConfig,
                use_tls: mikrotikConfig.use_tls ?? false
            };
            const profiles = await getPppProfiles(configWithTls);
            const profile = profiles.find(p => p.name === packageData.mikrotik_profile_name);
            
            if (profile && profile['.id']) {
              // Build rate-limit string from download_limit and upload_limit
              // Format: upload_limit/download_limit (e.g., "10M/20M")
              // If empty, use "0" for unlimited
              const downloadLimit = packageData.download_limit || '0';
              const uploadLimit = packageData.upload_limit || '0';
              const rateLimit = `${uploadLimit}/${downloadLimit}`;
              
              // Update profile in MikroTik
              await updatePppProfile(configWithTls, profile['.id'], {
                'rate-limit': rateLimit
              });
              
              console.log(`[PrepaidPackageManagementController] Updated MikroTik profile "${packageData.mikrotik_profile_name}" with rate-limit: ${rateLimit}`);
            } else {
              console.warn(`[PrepaidPackageManagementController] Profile "${packageData.mikrotik_profile_name}" not found in MikroTik`);
            }
          } else {
            console.warn('[PrepaidPackageManagementController] MikroTik not configured, skipping profile update');
          }
        } catch (mikrotikError) {
          console.error('[PrepaidPackageManagementController] Error updating MikroTik profile:', mikrotikError);
          // Don't fail the entire create if MikroTik update fails
          // The database create was successful, so we still redirect with success
        }
      }

      res.redirect('/prepaid/packages?success=' + encodeURIComponent('Paket berhasil dibuat'));
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error creating package:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create package';
      res.redirect('/prepaid/packages?error=' + encodeURIComponent(errorMessage));
    }
  }

  /**
   * Show edit package form
   */
  async showEditForm(req: Request, res: Response): Promise<void> {
    try {
      const packageId = parseInt(req.params.package_id);
      const packageData = await PrepaidPackageService.getPackageById(packageId);

      if (!packageData) {
        return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
      }

      // Get parent queues from Mikrotik
      let parentQueues = { download: ['DOWNLOAD ALL'], upload: ['UPLOAD ALL'] };
      
      try {
        parentQueues = await PrepaidPackageService.getParentQueuesFromMikrotik();
      } catch (error) {
        console.warn('Failed to get parent queues from Mikrotik, using defaults');
      }

      res.render('prepaid/admin/package-form', {
        title: 'Edit Paket Prepaid',
        package: packageData,
        parentQueues,
        isEdit: true,
      });
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error in showEditForm:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load package'));
    }
  }

  /**
   * Update package
   */
  async updatePackage(req: Request, res: Response): Promise<void> {
    try {
      const packageId = parseInt(req.params.package_id);

      const packageData: Partial<PrepaidPackage> = {
        name: req.body.name,
        description: req.body.description || '',
        connection_type: req.body.connection_type,
        mikrotik_profile_name: req.body.mikrotik_profile_name || undefined,
        parent_download_queue: req.body.parent_download_queue || undefined,
        parent_upload_queue: req.body.parent_upload_queue || undefined,
        download_mbps: parseFloat(req.body.download_mbps),
        upload_mbps: parseFloat(req.body.upload_mbps),
        duration_days: parseInt(req.body.duration_days),
        price: parseFloat(req.body.price),
        is_active: req.body.is_active === 'true' || req.body.is_active === '1',
        download_limit: req.body.download_limit || undefined,
        upload_limit: req.body.upload_limit || undefined,
      };

      // Update database
      await PrepaidPackageService.updatePackage(packageId, packageData);

      // If PPPoE package, update MikroTik profile rate limit
      if (packageData.connection_type === 'pppoe' && packageData.mikrotik_profile_name) {
        try {
          const mikrotikConfig = await PrepaidQueueService.getMikrotikConfig();
          if (mikrotikConfig) {
            // Get profile from MikroTik to find its ID
            const configWithTls: { host: string; port: number; username: string; password: string; use_tls: boolean } = {
                ...mikrotikConfig,
                use_tls: mikrotikConfig.use_tls ?? false
            };
            const profiles = await getPppProfiles(configWithTls);
            const profile = profiles.find(p => p.name === packageData.mikrotik_profile_name);
            
            if (profile && profile['.id']) {
              // Build rate-limit string from download_limit and upload_limit
              // Format: upload_limit/download_limit (e.g., "10M/20M")
              // If empty, use "0" for unlimited
              const downloadLimit = packageData.download_limit || '0';
              const uploadLimit = packageData.upload_limit || '0';
              const rateLimit = `${uploadLimit}/${downloadLimit}`;
              
              // Update profile in MikroTik
              await updatePppProfile(configWithTls, profile['.id'], {
                'rate-limit': rateLimit
              });
              
              console.log(`[PrepaidPackageManagementController] Updated MikroTik profile "${packageData.mikrotik_profile_name}" with rate-limit: ${rateLimit}`);
            } else {
              console.warn(`[PrepaidPackageManagementController] Profile "${packageData.mikrotik_profile_name}" not found in MikroTik`);
            }
          } else {
            console.warn('[PrepaidPackageManagementController] MikroTik not configured, skipping profile update');
          }
        } catch (mikrotikError) {
          console.error('[PrepaidPackageManagementController] Error updating MikroTik profile:', mikrotikError);
          // Don't fail the entire update if MikroTik update fails
          // The database update was successful, so we still redirect with success
        }
      }

      res.redirect('/prepaid/packages?success=' + encodeURIComponent('Paket berhasil diupdate'));
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error updating package:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update package';
      res.redirect('/prepaid/packages?error=' + encodeURIComponent(errorMessage));
    }
  }

  /**
   * Delete package
   */
  async deletePackage(req: Request, res: Response): Promise<void> {
    try {
      const packageId = parseInt(req.params.package_id);
      await PrepaidPackageService.deletePackage(packageId);

      res.json({ success: true, message: 'Paket berhasil dihapus' });
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error deleting package:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete package';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }

  /**
   * API: Get parent queues from Mikrotik (for AJAX dropdown)
   */
  async getParentQueues(req: Request, res: Response): Promise<void> {
    try {
      const parentQueues = await PrepaidPackageService.getParentQueuesFromMikrotik();
      res.json({ success: true, data: parentQueues });
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error getting parent queues:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get parent queues',
      });
    }
  }

  /**
   * API: Get rate limit from MikroTik profile (for auto-fill download limit)
   */
  async getProfileRateLimit(req: Request, res: Response): Promise<void> {
    try {
      const profileName = req.query.profile_name as string;
      
      if (!profileName) {
        return res.status(400).json({
          success: false,
          error: 'Profile name is required',
        });
      }

      const mikrotikConfig = await PrepaidQueueService.getMikrotikConfig();
      if (!mikrotikConfig) {
        res.status(500).json({
          success: false,
          error: 'Mikrotik not configured',
        });
      }

      const profiles = await getPppProfiles(mikrotikConfig);
      const profile = profiles.find(p => p.name === profileName);

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found in MikroTik',
        });
      }

      // Get download limit (rate_limit_rx), default to '0' if empty (unlimited)
      const downloadLimit = profile['rate-limit-rx'] || '0';

      res.json({
        success: true,
        data: {
          download_limit: downloadLimit,
          // Upload limit tidak bisa diambil dari MikroTik (harus manual)
          upload_limit: null,
        },
      });
    } catch (error) {
      console.error('[PrepaidPackageManagementController] Error getting profile rate limit:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get profile rate limit',
      });
    }
  }
}

export default new PrepaidPackageManagementController();

