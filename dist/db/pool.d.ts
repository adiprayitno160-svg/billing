import * as mysql from 'mysql2/promise';
export declare const databasePool: mysql.Pool;
export declare function checkDatabaseConnection(): Promise<void>;
export declare const db: mysql.Pool;
export default databasePool;
export declare function ensureInitialSchema(): Promise<void>;
//# sourceMappingURL=pool.d.ts.map