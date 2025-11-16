import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { RouterOSAPI } from 'node-routeros';
import { MikrotikConnectionPool } from '../../services/mikrotik/MikrotikConnectionPool';
import { MikrotikHealthCheck } from '../../services/mikrotik/MikrotikHealthCheck';

/**
 * Controller untuk Speed Profile Management (PPPoE Profiles)
 * Manage Mikrotik PPPoE profiles untuk prepaid customers
 */
class PrepaidSpeedProfileController {
  // Simple cache untuk speed up
  private static profilesCache: any[] | null = null;
  private static cacheTime: number = 0;
  private static CACHE_TTL = 60000; // 60 seconds cache

  constructor() {
    this.index = this.index.bind(this);
    this.createProfile = this.createProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.deleteProfile = this.deleteProfile.bind(this);
    this.getProfilesFromMikrotik = this.getProfilesFromMikrotik.bind(this);
  }

  /**
   * Show speed profiles page (WITH AUTO-FIX)
   */
  async index(req: Request, res: Response) {
    const startTime = Date.now();
    console.log('[SpeedProfile] Page request started');

    try {
      // STEP 1: Auto health check (FAST!)
      const health = await MikrotikHealthCheck.checkHealth();
      
      if (!health.isOnline) {
        console.log('[SpeedProfile] 🔴 Mikrotik OFFLINE - Using offline mode');
        
        // Show offline mode with helpful message
        return res.render('prepaid/speed-profiles', {
          title: 'Speed Profiles Management',
          currentPath: '/prepaid/speed-profiles',
          profiles: PrepaidSpeedProfileController.profilesCache || [],
          mikrotikConfigured: true,
          mikrotikOffline: true,
          offlineReason: health.error || 'Connection timeout',
          success: req.query.success || null,
          error: null, // Don't show error, just offline notice
          cached: true,
          cacheAge: PrepaidSpeedProfileController.profilesCache ? 
            Math.floor((Date.now() - PrepaidSpeedProfileController.cacheTime) / 1000) : 0
        });
      }
      
      console.log('[SpeedProfile] ✅ Mikrotik ONLINE');
      
      // Get Mikrotik settings (quick DB query)
      let mikrotikSettings: any[] = [];
      
      try {
        const [settings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
        );
        mikrotikSettings = settings as any[];
        
        if (mikrotikSettings.length === 0) {
          const [anySettings] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM mikrotik_settings LIMIT 1'
          );
          mikrotikSettings = anySettings as any[];
        }
      } catch (dbError) {
        console.error('[SpeedProfile] Database error:', dbError);
      }

      if (mikrotikSettings.length === 0) {
        return res.render('prepaid/speed-profiles', {
          title: 'Speed Profiles Management',
          currentPath: '/prepaid/speed-profiles',
          error: 'Mikrotik belum dikonfigurasi',
          profiles: [],
          mikrotikConfigured: false
        });
      }

      const settings = mikrotikSettings[0];

      // Check cache first (FAST!)
      const now = Date.now();
      const forceRefresh = req.query.refresh === '1';
      
      if (!forceRefresh && PrepaidSpeedProfileController.profilesCache && 
          (now - PrepaidSpeedProfileController.cacheTime) < PrepaidSpeedProfileController.CACHE_TTL) {
        console.log(`[SpeedProfile] Using cache (${PrepaidSpeedProfileController.profilesCache.length} profiles) - Response time: ${Date.now() - startTime}ms`);
        return res.render('prepaid/speed-profiles', {
          title: 'Speed Profiles Management',
          currentPath: '/prepaid/speed-profiles',
          profiles: PrepaidSpeedProfileController.profilesCache,
          mikrotikConfigured: true,
          mikrotikHost: settings.host,
          mikrotikPort: settings.api_port || 8728,
          success: req.query.success || null,
          error: req.query.error || null,
          cached: true,
          cacheAge: Math.floor((now - PrepaidSpeedProfileController.cacheTime) / 1000)
        });
      }

      // Get PPPoE profiles from Mikrotik (with timeout)
      let profiles: any[] = [];
      let connectionError = null;

      try {
        console.log('[SpeedProfile] Fetching from Mikrotik...');
        profiles = await this.getProfilesFromMikrotik(settings);
        
        // Update cache
        PrepaidSpeedProfileController.profilesCache = profiles;
        PrepaidSpeedProfileController.cacheTime = Date.now();
        
        console.log(`[SpeedProfile] Found ${profiles.length} PPPoE profiles - Response time: ${Date.now() - startTime}ms`);
      } catch (error) {
        console.error('[SpeedProfile] Error fetching profiles:', error);
        connectionError = error instanceof Error ? error.message : 'Unknown error';
        
        // Use old cache if available (fallback)
        if (PrepaidSpeedProfileController.profilesCache) {
          console.log('[SpeedProfile] Using stale cache as fallback');
          profiles = PrepaidSpeedProfileController.profilesCache;
          connectionError += ' (showing cached data)';
        }
      }

      res.render('prepaid/speed-profiles', {
        title: 'Speed Profiles Management',
        currentPath: '/prepaid/speed-profiles',
        profiles: profiles || [],
        mikrotikConfigured: true,
        mikrotikHost: settings.host,
        mikrotikPort: settings.api_port || 8728,
        success: req.query.success || null,
        error: connectionError ? `Koneksi Mikrotik error: ${connectionError}` : (req.query.error || null),
        cached: false,
        responseTime: Date.now() - startTime
      });
    } catch (error) {
      console.error('[SpeedProfile] Page error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.render('prepaid/speed-profiles', {
        title: 'Speed Profiles Management',
        currentPath: '/prepaid/speed-profiles',
        error: `Error: ${errorMessage}`,
        profiles: [],
        mikrotikConfigured: false
      });
    }
  }

  /**
   * Create new PPPoE profile in Mikrotik
   */
  async createProfile(req: Request, res: Response) {
    try {
      const { profile_name, download_speed, upload_speed, address_list, comment } = req.body;

      if (!profile_name || !download_speed || !upload_speed) {
        return res.redirect('/prepaid/speed-profiles?error=Profile name dan speed harus diisi');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        const [anySettings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings LIMIT 1'
        );
        if (anySettings.length === 0) {
          return res.redirect('/prepaid/speed-profiles?error=Mikrotik belum dikonfigurasi');
        }
      }

      const settings = mikrotikSettings.length > 0 ? mikrotikSettings[0] : (await pool.query<RowDataPacket[]>('SELECT * FROM mikrotik_settings LIMIT 1'))[0][0];

      // Connect to Mikrotik
      const api = new RouterOSAPI({
        host: settings?.host || '',
        port: settings?.api_port || 8728,
        user: settings?.username || '',
        password: settings?.password || '',
        timeout: 10000
      });

      await api.connect();

      // Create rate-limit string
      const rateLimit = `${upload_speed}M/${download_speed}M`;

      // Check if profile exists
      const existing = await api.write('/ppp/profile/print', [`?name=${profile_name}`]);
      
      if (Array.isArray(existing) && existing.length > 0) {
        api.close();
        return res.redirect('/prepaid/speed-profiles?error=Profile sudah ada dengan nama tersebut');
      }

      // Create profile
      const params = [
        `=name=${profile_name}`,
        `=rate-limit=${rateLimit}`,
        `=only-one=yes`
      ];

      if (address_list) {
        params.push(`=address-list=${address_list}`);
      }

      if (comment) {
        params.push(`=comment=${comment}`);
      }

      await api.write('/ppp/profile/add', params);
      api.close();

      console.log(`✅ [SpeedProfile] Created profile: ${profile_name} (${rateLimit})`);
      
      // Clear cache untuk force refresh
      this.clearCache();

      res.redirect('/prepaid/speed-profiles?success=Profile berhasil dibuat&refresh=1');
    } catch (error) {
      console.error('[SpeedProfile] Create error:', error);
      res.redirect(`/prepaid/speed-profiles?error=Gagal membuat profile: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Update existing PPPoE profile
   */
  async updateProfile(req: Request, res: Response) {
    try {
      const { profile_id } = req.params;
      const { download_speed, upload_speed, address_list, comment } = req.body;

      if (!download_speed || !upload_speed) {
        return res.redirect('/prepaid/speed-profiles?error=Speed harus diisi');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        const [anySettings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings LIMIT 1'
        );
        if (anySettings.length === 0) {
          return res.redirect('/prepaid/speed-profiles?error=Mikrotik belum dikonfigurasi');
        }
      }

      const settings = mikrotikSettings.length > 0 ? mikrotikSettings[0] : (await pool.query<RowDataPacket[]>('SELECT * FROM mikrotik_settings LIMIT 1'))[0][0];

      // Connect to Mikrotik
      const api = new RouterOSAPI({
        host: settings?.host || '',
        port: settings?.api_port || 8728,
        user: settings?.username || '',
        password: settings?.password || '',
        timeout: 10000
      });

      await api.connect();

      // Create rate-limit string
      const rateLimit = `${upload_speed}M/${download_speed}M`;

      // Update profile
      const params = [
        `=.id=${profile_id}`,
        `=rate-limit=${rateLimit}`
      ];

      if (address_list) {
        params.push(`=address-list=${address_list}`);
      }

      if (comment) {
        params.push(`=comment=${comment}`);
      }

      await api.write('/ppp/profile/set', params);
      api.close();

      console.log(`✅ [SpeedProfile] Updated profile ID: ${profile_id}`);
      
      // Clear cache untuk force refresh
      this.clearCache();

      res.redirect('/prepaid/speed-profiles?success=Profile berhasil diupdate&refresh=1');
    } catch (error) {
      console.error('[SpeedProfile] Update error:', error);
      res.redirect(`/prepaid/speed-profiles?error=Gagal update profile: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Delete PPPoE profile
   */
  async deleteProfile(req: Request, res: Response) {
    try {
      const { profile_id } = req.params;

      if (!profile_id) {
        return res.redirect('/prepaid/speed-profiles?error=Profile ID tidak valid');
      }

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        const [anySettings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings LIMIT 1'
        );
        if (anySettings.length === 0) {
          return res.redirect('/prepaid/speed-profiles?error=Mikrotik belum dikonfigurasi');
        }
      }

      const settings = mikrotikSettings.length > 0 ? mikrotikSettings[0] : (await pool.query<RowDataPacket[]>('SELECT * FROM mikrotik_settings LIMIT 1'))[0][0];

      // Connect to Mikrotik
      const api = new RouterOSAPI({
        host: settings?.host || '',
        port: settings?.api_port || 8728,
        user: settings?.username || '',
        password: settings?.password || '',
        timeout: 10000
      });

      await api.connect();

      // Delete profile
      await api.write('/ppp/profile/remove', [`=.id=${profile_id}`]);
      api.close();

      console.log(`✅ [SpeedProfile] Deleted profile ID: ${profile_id}`);
      
      // Clear cache untuk force refresh
      this.clearCache();

      res.redirect('/prepaid/speed-profiles?success=Profile berhasil dihapus&refresh=1');
    } catch (error) {
      console.error('[SpeedProfile] Delete error:', error);
      res.redirect(`/prepaid/speed-profiles?error=Gagal hapus profile: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Get all PPPoE profiles from Mikrotik (USING CONNECTION POOL)
   */
  private async getProfilesFromMikrotik(settings: any): Promise<any[]> {
    try {
      console.log('[SpeedProfile] Fetching profiles via connection pool...');
      
      // Use connection pool with caching
      const profiles = await MikrotikConnectionPool.executeCommand(
        '/ppp/profile/print',
        [],
        'ppp_profiles', // Cache key
        120000 // 2 minutes cache
      );

      if (!Array.isArray(profiles)) {
        return [];
      }

      // Map profiles
      const mappedProfiles = profiles.map((profile: any) => ({
        id: profile['.id'],
        name: profile.name,
        rateLimit: profile['rate-limit'] || '-',
        addressList: profile['address-list'] || '-',
        localAddress: profile['local-address'] || '-',
        remoteAddress: profile['remote-address'] || '-',
        onlyOne: profile['only-one'] || 'no',
        comment: profile.comment || '',
        isPrepaid: profile.name?.includes('prepaid') || false
      }));
      
      console.log(`[SpeedProfile] Got ${mappedProfiles.length} profiles from Mikrotik`);
      return mappedProfiles;
      
    } catch (error) {
      console.error('[SpeedProfile] Error getting profiles:', error);
      throw error;
    }
  }
  
  /**
   * Clear cache (called after create/update/delete)
   */
  private clearCache(): void {
    // Clear local cache
    PrepaidSpeedProfileController.profilesCache = null;
    PrepaidSpeedProfileController.cacheTime = 0;
    
    // Clear connection pool cache
    MikrotikConnectionPool.clearCache('ppp_profiles');
    
    console.log('[SpeedProfile] All caches cleared');
  }
}

export default new PrepaidSpeedProfileController();

