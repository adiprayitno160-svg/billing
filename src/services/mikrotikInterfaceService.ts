
import { databasePool } from '../db/pool';
import { RouterOSAPI } from 'node-routeros';

export async function getMikrotikInterfaces(): Promise<string[]> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        const settings = Array.isArray(rows) && rows.length > 0 ? rows[0] as any : null;

        if (!settings) {
            console.error("No MikroTik config found when fetching interfaces.");
            return [];
        }

        const api = new RouterOSAPI({
            host: settings.host,
            port: settings.port,
            user: settings.username,
            password: settings.password,
            timeout: 5000 // Short timeout
        });

        try {
            await api.connect();
            const interfaces = await api.write('/interface/print');
            await api.close();
            return interfaces.map((i: any) => i.name).sort();
        } catch (err) {
            console.error("Failed to fetch interfaces from MikroTik:", err);
            return [];
        }
    } catch (dbErr) {
        console.error("DB Error fetching interfaces:", dbErr);
        return [];
    } finally {
        conn.release();
    }
}
