"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const axios_1 = __importDefault(require("axios"));
const pool_1 = __importDefault(require("../../db/pool"));
class GitHubService {
    static async getSetting(key) {
        const [rows] = await pool_1.default.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
        return rows.length > 0 && rows[0] ? rows[0].setting_value : null;
    }
    static async setSetting(key, value) {
        await pool_1.default.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
    }
    /**
     * Get current app version from database
     */
    static async getCurrentVersion() {
        const version = await this.getSetting('app_version');
        return version || '1.0.0';
    }
    /**
     * Get MAJOR version from VERSION_MAJOR file (for About page)
     * This excludes hotfixes (2.0.8.x) and only shows stable releases (2.0.8)
     */
    static getMajorVersion() {
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
        }
        catch (error) {
            console.error('Error reading version from package.json:', error);
            // Fallback to VERSION_MAJOR file
            try {
                const fs = require('fs');
                const path = require('path');
                const versionPath = path.join(__dirname, '../../../VERSION_MAJOR');
                const version = fs.readFileSync(versionPath, 'utf-8').trim();
                return version;
            }
            catch (err1) {
                // Fallback to VERSION file and extract major.minor.patch
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const versionPath = path.join(__dirname, '../../../VERSION');
                    const fullVersion = fs.readFileSync(versionPath, 'utf-8').trim();
                    const majorMatch = fullVersion.match(/^(\d+\.\d+\.\d+)/);
                    return majorMatch ? majorMatch[1] : '1.0.0';
                }
                catch (err2) {
                    console.error('All version sources failed, using fallback');
                    return '1.0.0'; // Ultimate fallback
                }
            }
        }
    }
    /**
     * Get GitHub repository info
     */
    static async getRepoInfo() {
        const owner = await this.getSetting('github_repo_owner');
        const repo = await this.getSetting('github_repo_name');
        if (!owner || !repo) {
            throw new Error('GitHub repository not configured');
        }
        return { owner, repo };
    }
    /**
     * Fetch latest release from GitHub
     */
    static async getLatestRelease(channel = 'stable') {
        try {
            const { owner, repo } = await this.getRepoInfo();
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
            const response = await axios_1.default.get(apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Billing-System-Auto-Update'
                },
                timeout: 10000
            });
            const releases = response.data;
            // Filter based on channel
            let filteredReleases = releases.filter(release => !release.draft);
            if (channel === 'stable') {
                // Stable: only non-prerelease
                filteredReleases = filteredReleases.filter(release => !release.prerelease);
            }
            else if (channel === 'beta') {
                // Beta: include prerelease
                // All releases
            }
            return filteredReleases.length > 0 && filteredReleases[0] ? filteredReleases[0] : null;
        }
        catch (error) {
            console.error('Error fetching GitHub releases:', error.message);
            return null;
        }
    }
    /**
     * Compare two semantic versions
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    static compareVersions(v1, v2) {
        const clean1 = v1.replace(/^v/, '');
        const clean2 = v2.replace(/^v/, '');
        const parts1 = clean1.split('.').map(Number);
        const parts2 = clean2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            if (part1 > part2)
                return 1;
            if (part1 < part2)
                return -1;
        }
        return 0;
    }
    /**
     * Check if update is available
     */
    static async checkForUpdates() {
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
    static async checkForMajorUpdates() {
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
    static async getAllReleases(limit = 10) {
        try {
            const { owner, repo } = await this.getRepoInfo();
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
            const response = await axios_1.default.get(apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Billing-System-Auto-Update'
                },
                params: { per_page: limit },
                timeout: 10000
            });
            return response.data.filter((r) => !r.draft);
        }
        catch (error) {
            console.error('Error fetching releases:', error);
            return [];
        }
    }
    /**
     * Download release from GitHub
     */
    static async downloadRelease(downloadUrl, destinationPath) {
        const response = await (0, axios_1.default)({
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
exports.GitHubService = GitHubService;
//# sourceMappingURL=GitHubService.js.map