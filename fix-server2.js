const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function fix() {
  try {
    console.log('=== Connecting to server ===');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    // Step 1: Use debian-sys-maint to login and reset root password
    console.log('=== Step 1: Login with debian-sys-maint and reset root password ===');
    const resetResult = await run(
      "mysql -u debian-sys-maint -paDUBYeKVdD7klQgH -e \"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'BillingRoot123'; FLUSH PRIVILEGES;\""
    );

    // Step 2: Verify root login with new password
    console.log('\n=== Step 2: Verify root login ===');
    const verifyResult = await run("mysql -u root -pBillingRoot123 -e 'SELECT 1 AS test;'");

    // Step 3: Update .env with correct DB_PASSWORD
    console.log('\n=== Step 3: Update .env ===');
    await run("sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=BillingRoot123/' /var/www/billing/.env");
    await run('grep DB_ /var/www/billing/.env');

    // Step 4: Ensure MySQL socket dir exists and restart MySQL properly
    console.log('\n=== Step 4: Ensure MySQL is running properly ===');
    await run('echo adi | sudo -S mkdir -p /var/run/mysqld && echo adi | sudo -S chown mysql:mysql /var/run/mysqld');
    await run('echo adi | sudo -S systemctl restart mysql');
    await new Promise(r => setTimeout(r, 3000));
    await run('echo adi | sudo -S systemctl status mysql');

    // Step 5: Verify root login again after MySQL restart
    console.log('\n=== Step 5: Verify root login after restart ===');
    await run("mysql -u root -pBillingRoot123 -e 'SELECT 1 AS test;'");

    // Step 6: Build
    console.log('\n=== Step 6: Build application ===');
    await run('cd /var/www/billing && npm run build');

    // Step 7: Restart PM2
    console.log('\n=== Step 7: Restart PM2 ===');
    await run('pm2 delete billing-app || true');
    await run('pm2 start ecosystem.config.js --env production');
    await new Promise(r => setTimeout(r, 5000));

    // Step 8: Check status
    console.log('\n=== Step 8: Check PM2 status ===');
    await run('pm2 list');
    await run('pm2 logs billing-app --lines 30 --nostream');

    // Step 9: Test HTTP
    console.log('\n=== Step 9: Test HTTP ===');
    await run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ || echo "curl failed"');

    console.log('\n=== ALL DONE ===');
  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

fix();
