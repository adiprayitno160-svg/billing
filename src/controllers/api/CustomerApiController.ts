import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';

export const checkPppoeAvailability = async (req: Request, res: Response) => {
    const { username, exclude_id } = req.query;

    if (!username) {
        return res.json({ error: 'Username required' });
    }

    const cleanUsername = String(username).trim();
    let result = {
        existsInDb: false,
        existsInMikrotik: false,
        customerId: null,
        customerName: null,
        customerCode: null,
        password: null,
        profile: null
    };

    try {
        // 1. Check Database
        let query = 'SELECT id, name, customer_code FROM customers WHERE pppoe_username = ?';
        let params: any[] = [cleanUsername];

        if (exclude_id) {
            query += ' AND id != ?';
            params.push(exclude_id);
        }

        query += ' LIMIT 1';

        const [rows] = await databasePool.query<RowDataPacket[]>(query, params);

        if (rows.length > 0) {
            result.existsInDb = true;
            result.customerId = rows[0].id;
            result.customerName = rows[0].name;
            result.customerCode = rows[0].customer_code;
        }

        // 2. Check MikroTik Only if NOT in DB (or if we want to support recovering orphaned)
        if (!result.existsInDb) {
            const config = await getMikrotikConfig();
            if (config) {
                // Dynamic import to avoid issues
                const { RouterOSAPI } = await import('node-routeros');
                const api = new RouterOSAPI({
                    host: config.host,
                    port: config.port,
                    user: config.username,
                    password: config.password,
                    timeout: 5000
                });

                try {
                    await api.connect();
                    // Check Secrets
                    const secrets = await api.write('/ppp/secret/print', [`?name=${cleanUsername}`]);
                    if (secrets && secrets.length > 0) {
                        result.existsInMikrotik = true;
                        result.password = secrets[0].password;
                        result.profile = secrets[0].profile;
                    }
                    await api.close();
                } catch (mtErr) {
                    console.error('MikroTik Check Error:', mtErr);
                }
            }
        }

        res.json(result);

    } catch (err) {
        console.error('Check API Error:', err);
        res.status(500).json({ error: 'System error' });
    }
};
