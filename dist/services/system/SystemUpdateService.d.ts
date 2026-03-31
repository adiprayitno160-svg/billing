export declare class SystemUpdateService {
    /**
     * Check for updates from remote repository
     */
    static checkForUpdates(): Promise<{
        hasUpdate: boolean;
        behind: number;
        commits: {
            hash: string;
            date: string;
            message: string;
            author: string;
        }[];
    }>;
    /**
     * Perform update: Pull, Install, Build, Restart
     */
    static performUpdate(): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=SystemUpdateService.d.ts.map