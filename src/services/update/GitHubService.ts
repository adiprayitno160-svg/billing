import axios from 'axios';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  zipball_url: string;
  tarball_url: string;
  prerelease: boolean;
  draft: boolean;
}

interface SystemSetting extends RowDataPacket {
  setting_key: string;
  setting_value: string;
  setting_type: string;
}

export class GitHubService {
  private static async getSetting(key: string): Promise<string | null> {
    const [rows] = await pool.query<SystemSetting[]>(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    );
    return rows.length > 0 && rows[0] ? rows[0].setting_value : null;
  }

  private static async setSetting(key: string, value: string): Promise<void> {
    await pool.query(
      'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
      [value, key]
    );
  }

  /**
   * Get current app version from database
   */
  static async getCurrentVersion(): Promise<string> {
    const version = await this.getSetting('app_version');
    return version || '1.0.0';
  }

  /**
   * Get MAJOR version from VERSION_MAJOR file (for About page)
   * This excludes hotfixes (2.0.8.x) and only shows stable releases (2.0.8)
   */
  static getMajorVersion(): string {
    try {
      // PRIMARY SOURCE: package.json
      const fs = require('fs');
      const path = require('path');
      const packagePath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const pkgVersion = packageJson.version || '1.0.0';

      // Extract major.minor.patch from package.json version (e.g., 2.1.23 → 2.1.23)
      const majorMatch = pkgVersion.match(/^(\d+\.\d+\.\d+)/);
      if (majorMatch) {
        return majorMatch[1];
      }
      return pkgVersion;
    } catch (error) {
      console.error('Error reading version from package.json:', error);
      // Fallback to VERSION_MAJOR file
      try {
        const fs = require('fs');
        const path = require('path');
        const versionPath = path.join(__dirname, '../../../VERSION_MAJOR');
        const version = fs.readFileSync(versionPath, 'utf-8').trim();
        return version;
      } catch (err1) {
        // Fallback to VERSION file and extract major.minor.patch
        try {
          const fs = require('fs');
          const path = require('path');
          const versionPath = path.join(__dirname, '../../../VERSION');
          const fullVersion = fs.readFileSync(versionPath, 'utf-8').trim();
          const majorMatch = fullVersion.match(/^(\d+\.\d+\.\d+)/);
          return majorMatch ? majorMatch[1] : '1.0.0';
        } catch (err2) {
          console.error('All version sources failed, using fallback');
          return '1.0.0'; // Ultimate fallback
        }
      }
    }
  }

  /**
   * Get GitHub repository info
   */
  static async getRepoInfo(): Promise<{ owner: string; repo: string }> {
    const owner = await this.getSetting('github_repo_owner');
    const repo = await this.getSetting('github_repo_name');

    // Provide defaults if not configured in database
    return {
      owner: owner || 'adiprayitno160-svg',
      repo: repo || 'billing'
    };
  }

  /**
   * Fetch latest release from GitHub
   */
  /**
   * Fetch latest release from GitHub
   * Now supporting Tags as fallback if they are newer than Releases
   */
  static async getLatestRelease(channel: string = 'stable'): Promise<GitHubRelease | null> {
    try {
      const { owner, repo } = await this.getRepoInfo();

      // 1. Fetch Releases
      const releasesUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
      let latestRelease: GitHubRelease | null = null;

      try {
        const response = await axios.get(releasesUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Billing-System-Auto-Update'
          },
          timeout: 5000
        });

        const releases: GitHubRelease[] = response.data;
        let filteredReleases = releases.filter(release => !release.draft);
        if (channel === 'stable') {
          filteredReleases = filteredReleases.filter(release => !release.prerelease);
        }

        if (filteredReleases.length > 0) {
          latestRelease = filteredReleases[0];
        }
      } catch (err) {
        console.warn('Failed to fetch releases, trying tags...', err);
      }

      // 2. Fetch Tags (Fallback or Newer Check)
      // GitHub Releases sometimes lag or users only push tags. 
      // We check tags to see if there is a version newer than the latest release.
      const tagsUrl = `https://api.github.com/repos/${owner}/${repo}/tags`;
      let latestTagRelease: GitHubRelease | null = null;

      try {
        const response = await axios.get(tagsUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Billing-System-Auto-Update'
          },
          timeout: 5000
        });

        const tags = response.data;
        if (tags && tags.length > 0) {
          // Tags are usually sorted by creation, but not always guaranteed by semver in API
          // However, usually the 0-th element is the latest pushed tag.
          // Let's assume tags[0] is the candidate.
          const tag = tags[0];
          const tagName = tag.name;

          // Simulate a Release object from Tag
          latestTagRelease = {
            tag_name: tagName,
            name: tagName,
            body: `Release based on tag ${tagName}`,
            published_at: new Date().toISOString(), // Tags API doesn't list date directly without commit fetch
            zipball_url: tag.zipball_url,
            tarball_url: tag.tarball_url,
            prerelease: false,
            draft: false
          };
        }
      } catch (err) {
        console.warn('Failed to fetch tags', err);
      }

      // 3. Determine the winner
      if (!latestRelease && !latestTagRelease) return null;
      if (!latestRelease) return latestTagRelease;
      if (!latestTagRelease) return latestRelease;

      // Compare versions
      const releaseVer = latestRelease.tag_name;
      const tagVer = latestTagRelease.tag_name;

      if (this.compareVersions(tagVer, releaseVer) > 0) {
        console.log(`Found newer tag ${tagVer} (vs release ${releaseVer})`);
        return latestTagRelease;
      }

      return latestRelease;

    } catch (error: any) {
      console.error('Error fetching GitHub update info:', error.message);
      return null;
    }
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  static compareVersions(v1: string, v2: string): number {
    const clean1 = v1.replace(/^v/, '');
    const clean2 = v2.replace(/^v/, '');

    const parts1 = clean1.split('.').map(Number);
    const parts2 = clean2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  /**
   * Check if update is available
   */
  static async checkForUpdates(): Promise<{
    available: boolean;
    currentVersion: string;
    latestVersion: string;
    changelog: string;
    publishedAt: string;
    downloadUrl: string;
  }> {
    const currentVersion = await this.getCurrentVersion();
    const channel = await this.getSetting('update_channel') || 'stable';
    const latestRelease = await this.getLatestRelease(channel);

    // Update last check time
    await this.setSetting('last_update_check', new Date().toISOString());

    if (!latestRelease) {
      return {
        available: false,
        currentVersion,
        latestVersion: currentVersion,
        changelog: '',
        publishedAt: '',
        downloadUrl: ''
      };
    }

    const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix for consistency
    const available = this.compareVersions(latestVersion, currentVersion) > 0;

    return {
      available,
      currentVersion,
      latestVersion,
      changelog: latestRelease.body || 'No changelog available',
      publishedAt: latestRelease.published_at,
      downloadUrl: latestRelease.zipball_url
    };
  }

  /**
   * Check for MAJOR updates ONLY (About page)
   * Ignores hotfixes like 2.0.8.1, 2.0.8.2, etc
   * Only checks for major releases like 2.0.8 -> 2.0.9
   */
  static async checkForMajorUpdates(): Promise<{
    available: boolean;
    currentVersion: string;
    latestVersion: string;
    changelog: string;
    publishedAt: string;
    downloadUrl: string;
  }> {
    const currentVersion = this.getMajorVersion(); // Read from VERSION_MAJOR file
    const channel = await this.getSetting('update_channel') || 'stable';
    const latestRelease = await this.getLatestRelease(channel);

    // Update last check time
    await this.setSetting('last_update_check', new Date().toISOString());

    if (!latestRelease) {
      return {
        available: false,
        currentVersion,
        latestVersion: currentVersion,
        changelog: '',
        publishedAt: '',
        downloadUrl: ''
      };
    }

    // Extract MAJOR version from GitHub release (strip hotfix numbers)
    let latestVersion = latestRelease.tag_name.replace(/^v/, '');
    const majorMatch = latestVersion.match(/^(\d+\.\d+\.\d+)/);
    if (majorMatch && majorMatch[1]) {
      latestVersion = majorMatch[1]; // Only take major.minor.patch
    }

    // Compare ONLY major versions (ignore hotfixes)
    const currentMajor = currentVersion.split('.').slice(0, 3).join('.');
    const latestMajor = latestVersion.split('.').slice(0, 3).join('.');
    const available = this.compareVersions(latestMajor, currentMajor) > 0;

    return {
      available,
      currentVersion: currentMajor,
      latestVersion: latestMajor,
      changelog: latestRelease.body || 'No changelog available',
      publishedAt: latestRelease.published_at,
      downloadUrl: latestRelease.zipball_url
    };
  }

  /**
   * Get all releases (for history/changelog)
   */
  static async getAllReleases(limit: number = 10): Promise<GitHubRelease[]> {
    try {
      const { owner, repo } = await this.getRepoInfo();
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;

      const response = await axios.get(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Billing-System-Auto-Update'
        },
        params: { per_page: limit },
        timeout: 10000
      });

      return response.data.filter((r: GitHubRelease) => !r.draft);
    } catch (error) {
      console.error('Error fetching releases:', error);
      return [];
    }
  }

  /**
   * Download release from GitHub
   */
  static async downloadRelease(downloadUrl: string, destinationPath: string): Promise<void> {
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 300000, // 5 minutes
      headers: {
        'User-Agent': 'Billing-System-Auto-Update'
      }
    });

    const fs = require('fs');
    const writer = fs.createWriteStream(destinationPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

