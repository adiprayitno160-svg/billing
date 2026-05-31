import { databasePool } from './src/db/pool';

(async () => {
    try {
        const [odp] = await databasePool.query(`DESCRIBE ftth_odp`);
        const [odc] = await databasePool.query(`DESCRIBE ftth_odc`);
        const [olt] = await databasePool.query(`DESCRIBE ftth_olt`);
        console.log("ODP:", odp);
        console.log("ODC:", odc);
        console.log("OLT:", olt);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
