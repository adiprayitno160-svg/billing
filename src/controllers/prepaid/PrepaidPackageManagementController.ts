/**
 * Prepaid Package Management Controller
 * Admin interface untuk mengelola paket prepaid (PPPoE & Static IP)
 */

import { Request, Response } from 'express';
import { PrepaidPackageService, PrepaidPackage } from '../../services/prepaid/PrepaidPackageService';
import { PrepaidQueueService } from '../../services/prepaid/PrepaidQueueService';

class PrepaidPackageManagementController {
  constructor() {
    this.index = this.index.bind(this);
    this.showCreateForm = this.showCreateForm.bind(this);
    this.createPackage = this.createPackage.bind(this);
    this.showEditForm = this.showEditForm.bind(this);
    this.updatePackage = this.updatePackage.bind(this);
    this.deletePackage = this.deletePackage.bind(this);
    this.getParentQueues = this.getParentQueues.bind(this);
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
      };

      const packageId = await PrepaidPackageService.createPackage(packageData);

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
      };

      await PrepaidPackageService.updatePackage(packageId, packageData);

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
}

export default new PrepaidPackageManagementController();

