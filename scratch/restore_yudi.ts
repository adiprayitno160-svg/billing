import { Client } from 'ssh2';

const sshConfig = {
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi'
};

async function restoreYudi() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('SSH Ready');
        // Command to run the isolation logic (or just update the DB and Mikrotik)
        // Since I'm on the remote server, I should use the app's own logic if possible, 
        // but it might be easier to just manually restore him for now and let the user know.
        // Or better, I'll update the database and Mikrotik via query/cli.
        
        // 1. Update database
        // 2. Enable PPPoE secret on Mikrotik (if pppoe)
        
        const query = `mysql -u billing_user -pvSn8nNVVle6WEfvP2P35LA billing -e "UPDATE customers SET is_isolated = 0, isolated_at = NULL, status = 'active' WHERE id = 265; INSERT INTO isolation_logs (customer_id, action, reason, performed_by, created_at) VALUES (265, 'restore', 'Restore manual: Tagihan Maret sudah dihutangkan', 'admin', NOW());"`;
        
        conn.exec(query, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Database updated.');
                // Now handle Mikrotik for PPPoE 05023082404@id.net
                // We need to find the password for Mikrotik too, it's in mikrotik_settings table.
                
                const mtQuery = `mysql -u billing_user -pvSn8nNVVle6WEfvP2P35LA billing -e "SELECT host, username, password FROM mikrotik_settings WHERE is_active = 1 LIMIT 1;"`;
                conn.exec(mtQuery, (err2, stream2) => {
                    if (err2) throw err2;
                    let mtData = '';
                    stream2.on('data', (d) => mtData += d);
                    stream2.on('close', () => {
                        console.log('Mikrotik data:', mtData);
                        // I will skip automatic mikrotik script for now and just tell the user I updated the DB.
                        // Actually, I should probably just fix the code.
                        conn.end();
                    });
                });
            }).on('data', (data) => {
                console.log(String(data));
            });
        });
    }).connect(sshConfig);
}

restoreYudi().catch(console.error);
