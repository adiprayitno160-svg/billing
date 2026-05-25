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

    // Step 1: Check debian-sys-maint credentials (Ubuntu/Debian default)
    console.log('=== Step 1: Finding MySQL credentials ===');
    const debianCnf = await run('echo adi | sudo -S cat /etc/mysql/debian.cnf');
    
    // Step 2: Try to find existing password in any config
    console.log('\n=== Step 2: Check if root can login via sudo mysql ===');
    // On MySQL 8+ with auth_socket, sudo mysql works without password
    const sudoMysqlTest = await run('echo adi | sudo -S mysql -e "SELECT user, host, plugin FROM mysql.user WHERE user=\'root\';"');
    
    if (sudoMysqlTest.code === 0 || !sudoMysqlTest.stderr.includes('Access denied')) {
      // sudo mysql works! Set root password
      console.log('\n=== Step 3: Setting root password via sudo mysql ===');
      await run("echo adi | sudo -S mysql -e \"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'BillingRoot123'; FLUSH PRIVILEGES;\"");
      
      // Verify
      console.log('\n=== Step 4: Verifying root login with new password ===');
      await run("mysql -u root -pBillingRoot123 -e 'SELECT 1 AS test;'");
    } else {
      console.log('sudo mysql did not work, trying skip-grant-tables approach...');
      
      // Stop MySQL, start with skip-grant-tables
      console.log('\n=== Step 3b: Resetting MySQL root password ===');
      await run('echo adi | sudo -S systemctl stop mysql');
      await run('echo adi | sudo -S mysqld_safe --skip-grant-tables --skip-networking &');
      // Wait for mysqld to start
      await new Promise(r => setTimeout(r, 3000));
      await run("mysql -u root -e \"FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'BillingRoot123'; FLUSH PRIVILEGES;\"");
      await run('echo adi | sudo -S kill $(cat /var/run/mysqld/mysqld.pid) || true');
      await run('echo adi | sudo -S systemctl start mysql');
      await new Promise(r => setTimeout(r, 2000));
      
      // Verify
      console.log('\n=== Step 4: Verifying root login ===');
      await run("mysql -u root -pBillingRoot123 -e 'SELECT 1 AS test;'");
    }

    // Step 5: Update .env
    console.log('\n=== Step 5: Updating .env file ===');
    await run("sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=BillingRoot123/' /var/www/billing/.env");
    
    // Verify .env
    console.log('\n=== Verify .env ===');
    await run('grep DB_ /var/www/billing/.env');

    // Step 6: Build
    console.log('\n=== Step 6: Building application ===');
    const buildResult = await run('cd /var/www/billing && npm run build');

    // Step 7: Restart PM2
    console.log('\n=== Step 7: Restarting PM2 ===');
    await run('pm2 reload billing-app');
    
    // Wait for app to start
    await new Promise(r => setTimeout(r, 5000));

    // Step 8: Check PM2 status and logs
    console.log('\n=== Step 8: Checking PM2 status ===');
    await run('pm2 list');
    
    console.log('\n=== Recent logs ===');
    await run('pm2 logs billing-app --lines 20 --nostream');

    console.log('\n=== ALL DONE ===');
  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

fix();
