const { Client } = require('ssh2');

const conn = new Client();

console.log('Connecting to SSH 192.168.239.154...');

conn.on('ready', () => {
    console.log('SSH Connection ready!');
    
    // Attempt to locate the app
    conn.exec('pm2 jlist', (err, stream) => {
        if (err) {
            console.error('Error running pm2 jlist:', err);
            conn.end();
            return;
        }
        
        let data = '';
        stream.on('data', (d) => {
            data += d.toString();
        }).on('close', () => {
            try {
                let apps = [];
                // Sometime pm2 outputs some warnings before JSON, let's find the array
                const jsonStart = data.indexOf('[');
                const jsonEnd = data.lastIndexOf(']') + 1;
                
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    apps = JSON.parse(data.substring(jsonStart, jsonEnd));
                }
                
                let appDir = null;
                const billingApp = apps.find(a => a.name === 'billing-app' || (a.pm2_env && a.pm2_env.pm_cwd && a.pm2_env.pm_cwd.includes('billing')));
                
                if (billingApp && billingApp.pm2_env && billingApp.pm2_env.pm_cwd) {
                    appDir = billingApp.pm2_env.pm_cwd;
                    console.log('Found app via PM2 at:', appDir);
                }
                
                if (!appDir) {
                    // Fallback guess: maybe it's in /var/www/billing or ~/billing or C:/laragon/www/billing
                    console.log('Could not find app via PM2, will try common paths...');
                    const findCmd = 'find /var/www /home /c -name "ecosystem.config.js" -path "*billing*" 2>/dev/null | head -n 1';
                    conn.exec(findCmd, (err2, stream2) => {
                        let findData = '';
                        stream2.on('data', d => { findData += d.toString(); })
                               .on('close', () => {
                                   findData = findData.trim();
                                   if (findData) {
                                       appDir = findData.replace('/ecosystem.config.js', '');
                                       console.log('Found app via fallback find at:', appDir);
                                       executeDeploy(appDir);
                                   } else {
                                       console.error('Could not determine app directory! Please execute manually.');
                                       conn.end();
                                   }
                               });
                    });
                } else {
                    executeDeploy(appDir);
                }
            } catch (e) {
                console.error('Failed to parse pm2 jlist:', e.message);
                conn.end();
            }
        });
    });
}).on('error', (err) => {
    console.error('SSH Connection Error:', err.message);
}).connect({
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi',
    readyTimeout: 10000
});

function executeDeploy(appDir) {
    // Also include a step to fix any potential uncommitted changes or ownership issues in remote if needed, 
    // but a clean pull is best.
    const cmd = `cd "${appDir}" && git fetch && git reset --hard origin/main && pm2 restart all`;
    console.log('Executing command:', cmd);
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Error executing deploy:', err);
            conn.end();
            return;
        }
        
        stream.on('data', d => process.stdout.write('[STDOUT] ' + d.toString()))
              .on('stderr', d => process.stderr.write('[STDERR] ' + d.toString()))
              .on('close', (code) => {
                  console.log(`Command completed with exit code: ${code}`);
                  conn.end();
              });
    });
}
