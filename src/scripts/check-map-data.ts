
import { databasePool } from '../db/pool';

async function check() {
    try {
        console.log('--- maintenance_schedules structure ---');
        try {
            const [cols]: any = await databasePool.query('DESCRIBE maintenance_schedules');
            console.table(cols);
        } catch (e: any) {
            console.log('maintenance_schedules table does not exist:', e.message);
        }

        console.log('--- ftth_olt structure ---');
        const [olts]: any = await databasePool.query('DESCRIBE ftth_olt');
        console.table(olts);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
