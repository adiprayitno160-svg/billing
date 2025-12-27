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
export declare class GitHubService {
    private static getSetting;
    private static setSetting;
    /**
     * Get current app version from database
     */
    static getCurrentVersion(): Promise<string>;
    /**
     * Get MAJOR version from VERSION_MAJOR file (for About page)
     * This excludes hotfixes (2.0.8.x) and only shows stable releases (2.0.8)
     */
    static getMajorVersion(): string;
    /**
     * Get GitHub repository info
     */
    static getRepoInfo(): Promise<{
        owner: string;
        repo: string;
    }>;
    /**
     * Fetch latest release from GitHub
     */
    static getLatestRelease(channel?: string): Promise<GitHubRelease | null>;
    /**
     * Compare two semantic versions
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    static compareVersions(v1: string, v2: string): number;
    /**
     * Check if update is available
     */
    static checkForUpdates(): Promise<{
        available: boolean;
        currentVersion: string;
        latestVersion: string;
        changelog: string;
        publishedAt: string;
        downloadUrl: string;
    }>;
    /**
     * Check for MAJOR updates ONLY (About page)
     * Ignores hotfixes like 2.0.8.1, 2.0.8.2, etc
     * Only checks for major releases like 2.0.8 -> 2.0.9
     */
    static checkForMajorUpdates(): Promise<{
        available: boolean;
        currentVersion: string;
        latestVersion: string;
        changelog: string;
        publishedAt: string;
        downloadUrl: string;
    }>;
    /**
     * Get all releases (for history/changelog)
     */
    static getAllReleases(limit?: number): Promise<GitHubRelease[]>;
    /**
     * Download release from GitHub
     */
    static downloadRelease(downloadUrl: string, destinationPath: string): Promise<void>;
}
export {};
//# sourceMappingURL=GitHubService.d.ts.map