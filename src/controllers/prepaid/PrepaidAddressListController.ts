import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import MikrotikAddressListService from '../../services/mikrotik/MikrotikAddressListService';
import { MikrotikConnectionPool } from '../../services/mikrotik/MikrotikConnectionPool';

/**
 * Controller untuk Address List Management
 * Untuk maintenance & troubleshooting (OPTIMIZED WITH SERVICE CACHING)
 */
class PrepaidAddressListController {
  /**
   * Show address list management page
   */
  async index(req: Request, res: Response) {
    const startTime = Date.now();
    console.log('[AddressList] Page request started');
    
    try {
      // Get Mikrotik settings - try with and without is_active
      let mikrotikSettings: any[] = [];
      
      try {
        const [settings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
        );
        mikrotikSettings = settings as any[];
        
        // Fallback: try without is_active filter
        if (mikrotikSettings.length === 0) {
          const [anySettings] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM mikrotik_settings LIMIT 1'
          );
          mikrotikSettings = anySettings as any[];
        }
      } catch (dbError) {
        console.error('[AddressList] Database error:', dbError);
      }

      if (mikrotikSettings.length === 0) {
        return res.render('prepaid/address-list', {
          title: 'Address List Management',
          currentPath: '/prepaid/address-list',
          error: 'Mikrotik belum dikonfigurasi. Silakan setup di Settings > Mikrotik',
          noPackageList: [],
          activeList: [],
          mikrotikConfigured: false
        });
      }

      const settings = mikrotikSettings[0];

      const addressListService = new MikrotikAddressListService({
        host: settings.host,
        username: settings.username,
        password: settings.password,
        port: settings.api_port || 8728
      });

      // Get address lists from Mikrotik with error handling
      // Service will handle caching automatically!
      let noPackageList: any[] = [];
      let activeList: any[] = [];
      let connectionError = null;

      try {
        console.log('[AddressList] Fetching prepaid-no-package list...');
        noPackageList = await addressListService.getAddressListEntries('prepaid-no-package');
        console.log(`[AddressList] Found ${noPackageList.length} entries in prepaid-no-package`);
      } catch (error) {
        console.error('[AddressList] Error fetching no-package list:', error);
        connectionError = error instanceof Error ? error.message : 'Unknown error';
      }

      try {
        console.log('[AddressList] Fetching prepaid-active list...');
        activeList = await addressListService.getAddressListEntries('prepaid-active');
        console.log(`[AddressList] Found ${activeList.length} entries in prepaid-active`);
      } catch (error) {
        console.error('[AddressList] Error fetching active list:', error);
        if (!connectionError) {
          connectionError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      const responseTime = Date.now() - startTime;
      console.log(`[AddressList] Page loaded in ${responseTime}ms`);
      
      res.render('prepaid/address-list', {
        title: 'Address List Management',
        currentPath: '/prepaid/address-list',
        noPackageList: noPackageList || [],
        activeList: activeList || [],
        mikrotikConfigured: true,
        mikrotikHost: settings.host,
        mikrotikPort: settings.api_port || 8728,
        success: req.query.success || null,
        error: connectionError ? `Koneksi Mikrotik error: ${connectionError}` : (req.query.error || null),
        responseTime: responseTime
      });
    } catch (error) {
      console.error('[AddressList] Page error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.render('prepaid/address-list', {
        title: 'Address List Management',
        currentPath: '/prepaid/address-list',
        error: `Gagal mengambil data: ${errorMessage}`,
        noPackageList: [],
        activeList: [],
        mikrotikConfigured: false
      });
    }
  }

  /**
   * Manual add IP to address list
   */
  async addToList(req: Request, res: Response) {
    try {
      const { list_name, ip_address, comment } = req.body;

      if (!list_name || !ip_address) {
        return res.redirect('/prepaid/address-list?error=List name dan IP address harus diisi');
      }

      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ip_address)) {
        return res.redirect('/prepaid/address-list?error=Format IP address tidak valid');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi');
      }

      const settings = mikrotikSettings[0];
      const addressListService = new MikrotikAddressListService({
        host: settings.host,
        username: settings.username,
        password: settings.password,
        port: settings.api_port || 8728
      });

      // Add to address list
      const success = await addressListService.addToAddressList(
        list_name,
        ip_address,
        comment || `Manual add by admin at ${new Date().toISOString()}`
      );

      if (success) {
        res.redirect(`/prepaid/address-list?success=IP ${ip_address} berhasil ditambahkan ke ${list_name}`);
      } else {
        res.redirect('/prepaid/address-list?error=Gagal menambahkan IP ke address list');
      }
    } catch (error) {
      console.error('Add to address list error:', error);
      res.redirect('/prepaid/address-list?error=Terjadi kesalahan sistem');
    }
  }

  /**
   * Manual remove IP from address list
   */
  async removeFromList(req: Request, res: Response) {
    try {
      const { list_name, ip_address } = req.body;

      if (!list_name || !ip_address) {
        return res.redirect('/prepaid/address-list?error=List name dan IP address harus diisi');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi');
      }

      const settings = mikrotikSettings[0];
      const addressListService = new MikrotikAddressListService({
        host: settings.host,
        username: settings.username,
        password: settings.password,
        port: settings.api_port || 8728
      });

      // Remove from address list
      const success = await addressListService.removeFromAddressList(list_name, ip_address);

      if (success) {
        res.redirect(`/prepaid/address-list?success=IP ${ip_address} berhasil dihapus dari ${list_name}`);
      } else {
        res.redirect('/prepaid/address-list?error=Gagal menghapus IP dari address list');
      }
    } catch (error) {
      console.error('Remove from address list error:', error);
      res.redirect('/prepaid/address-list?error=Terjadi kesalahan sistem');
    }
  }

  /**
   * Move IP between lists
   */
  async moveToList(req: Request, res: Response) {
    try {
      const { ip_address, from_list, to_list, comment } = req.body;

      if (!ip_address || !from_list || !to_list) {
        return res.redirect('/prepaid/address-list?error=Semua field harus diisi');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi');
      }

      const settings = mikrotikSettings[0];
      const addressListService = new MikrotikAddressListService({
        host: settings.host,
        username: settings.username,
        password: settings.password,
        port: settings.api_port || 8728
      });

      // Move IP
      const success = await addressListService.moveToAddressList(
        ip_address,
        from_list,
        to_list,
        comment || `Moved by admin at ${new Date().toISOString()}`
      );

      if (success) {
        res.redirect(`/prepaid/address-list?success=IP ${ip_address} berhasil dipindah dari ${from_list} ke ${to_list}`);
      } else {
        res.redirect('/prepaid/address-list?error=Gagal memindahkan IP');
      }
    } catch (error) {
      console.error('Move IP error:', error);
      res.redirect('/prepaid/address-list?error=Terjadi kesalahan sistem');
    }
  }

  /**
   * Clear all entries from a list
   */
  async clearList(req: Request, res: Response) {
    try {
      const { list_name } = req.body;

      if (!list_name) {
        return res.redirect('/prepaid/address-list?error=List name harus diisi');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.redirect('/prepaid/address-list?error=Mikrotik belum dikonfigurasi');
      }

      const settings = mikrotikSettings[0];
      const addressListService = new MikrotikAddressListService({
        host: settings.host,
        username: settings.username,
        password: settings.password,
        port: settings.api_port || 8728
      });

      // Clear list
      const success = await addressListService.clearAddressList(list_name);

      if (success) {
        res.redirect(`/prepaid/address-list?success=Address list ${list_name} berhasil dibersihkan`);
      } else {
        res.redirect('/prepaid/address-list?error=Gagal membersihkan address list');
      }
    } catch (error) {
      console.error('Clear list error:', error);
      res.redirect('/prepaid/address-list?error=Terjadi kesalahan sistem');
    }
  }
}

export default new PrepaidAddressListController();

