const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: '192.168.239.154',
  port: 22,
  username: 'adi',
  password: 'adi'
};

const filesToUpload = [
  {
    local: 'c:\\laragon\\www\\billing\\views\\billing\\tagihan-detail.ejs',
    remote: '/var/www/billing/views/billing/tagihan-detail.ejs'
  },
  {
    local: 'c:\\laragon\\www\\billing\\views\\billing\\tagihan-print.ejs',
    remote: '/var/www/billing/views/billing/tagihan-print.ejs'
  },
  {
    local: 'c:\\laragon\\www\\billing\\views\\ftth\\olt_add.ejs',
    remote: '/var/www/billing/views/ftth/olt_add.ejs'
  },
  {
    local: 'c:\\laragon\\www\\billing\\views\\ftth\\olt_edit.ejs',
    remote: '/var/www/billing/views/ftth/olt_edit.ejs'
  },
  {
    local: 'c:\\laragon\\www\\billing\\views\\layouts\\main.ejs',
    remote: '/var/www/billing/views/layouts/main.ejs'
  },
  {
    local: 'c:\\laragon\\www\\billing\\src\\controllers\\billing\\invoiceController.ts',
    remote: '/var/www/billing/src/controllers/billing/invoiceController.ts'
  },
  {
    local: 'c:\\laragon\\www\\billing\\src\\routes\\billing.ts',
    remote: '/var/www/billing/src/routes/billing.ts'
  }
];

const conn = new Client();

async function uploadFiles(sftp) {
  for (const file of filesToUpload) {
    console.log(`Uploading ${file.local} -> ${file.remote}...`);
    await new Promise((resolve, reject) => {
      sftp.fastPut(file.local, file.remote, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

conn.on('ready', () => {
  console.log('SSH Ready');
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP Error:', err);
      conn.end();
      return;
    }

    try {
      await uploadFiles(sftp);
      console.log('All files uploaded successfully.');
      
      console.log('Starting remote build and restart...');
      conn.exec('cd /var/www/billing && npm run build && pm2 restart billing-app', (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()))
              .on('stderr', d => process.stderr.write(d.toString()))
              .on('close', () => {
                console.log('\nDeployment completed successfully.');
                conn.end();
              });
      });
    } catch (uploadError) {
      console.error('Upload failed:', uploadError);
      conn.end();
    }
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect(config);
