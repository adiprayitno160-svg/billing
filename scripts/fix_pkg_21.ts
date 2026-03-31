
import { databasePool } from '../src/db/pool';

async function fix() {
    try {
        console.log("Fixing Package 21...");
        const [result] = await databasePool.query<any>(`
            UPDATE static_ip_packages 
            SET 
                max_limit_download = '10M', 
                max_limit_upload = '10M', 
                child_download_limit = '10M', 
                child_upload_limit = '10M', 
                child_limit_at_download = '2M', 
                child_limit_at_upload = '2M', 
                limit_at_download = '2M', 
                limit_at_upload = '2M' 
            WHERE id = 21
        `);
        console.log("Rows affected:", result.affectedRows);
        console.log("Changed rows:", result.changedRows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
fix();
