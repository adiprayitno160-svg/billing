const { Client } = require('ssh2'); 
const conn = new Client(); 

console.log('Connecting to SSH 192.168.239.154 to install PDF dependencies...');

conn.on('ready', () => { 
  console.log('SSH Connection ready! Executing installation commands...');
  
  // Use echo 'adi' | sudo -S to bypass sudo password prompt
  const cmd = `
    echo 'adi' | sudo -S apt-get update && 
    echo 'adi' | sudo -S apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 && 
    cd /var/www/billing && 
    npm install puppeteer && 
    pm2 restart all
  `;
  
  conn.exec(cmd, (err, stream) => { 
    if (err) {
       console.error('Error executing install:', err);
       conn.end();
       return;
    }
    
    stream.on('close', (code) => { 
      console.log(`\nInstallation completed with exit code: ${code}`);
      if (code === 0) {
          console.log('✅ PDF Generation dependencies installed successfully!');
      } else {
          console.log('❌ Installation failed or finished with warnings.');
      }
      conn.end();
    })
    .on('data', d => process.stdout.write(d.toString()))
    .stderr.on('data', d => process.stderr.write(d.toString())); 
  }); 
}).on('error', (err) => {
    console.error('SSH Connection Error:', err.message);
}).connect({
    host: '192.168.239.154', 
    port: 22, 
    username: 'adi', 
    password: 'adi',
    readyTimeout: 15000
});
