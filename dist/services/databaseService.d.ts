export interface DatabaseStatus {
    connected: boolean;
    version: string;
    uptime: string;
    totalTables: number;
    totalRows: number;
    lastBackup?: string;
}
export interface SchemaIssue {
    table: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    fixCommand: string;
}
export declare function getDatabaseStatus(): Promise<DatabaseStatus>;
export declare function checkDatabaseSchema(): Promise<SchemaIssue[]>;
export declare function fixMissingColumns(): Promise<void>;
export declare function runMigration(migrationType?: string): Promise<void>;
//# sourceMappingURL=databaseService.d.ts.map