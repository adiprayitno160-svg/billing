const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function main() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected to SSH');

    const files = [
      { local: 'src/services/ai/AdvancedPaymentVerificationService.ts', remote: '/var/www/billing/src/services/ai/AdvancedPaymentVerificationService.ts' },
      { local: 'src/services/payment/GeminiService.ts', remote: '/var/www/billing/src/services/payment/GeminiService.ts' },
      { local: 'src/services/notification/NotificationScheduler.ts', remote: '/var/www/billing/src/services/notification/NotificationScheduler.ts' },
      { local: 'src/services/notification/UnifiedNotificationService.ts', remote: '/var/www/billing/src/services/notification/UnifiedNotificationService.ts' },
      { local: 'dist/services/ai/AdvancedPaymentVerificationService.js', remote: '/var/www/billing/dist/services/ai/AdvancedPaymentVerificationService.js' },
      { local: 'dist/services/payment/GeminiService.js', remote: '/var/www/billing/dist/services/payment/GeminiService.js' },
      { local: 'dist/services/notification/NotificationScheduler.js', remote: '/var/www/billing/dist/services/notification/NotificationScheduler.js' },
      { local: 'dist/services/notification/UnifiedNotificationService.js', remote: '/var/www/billing/dist/services/notification/UnifiedNotificationService.js' }
    ];

    for (let f of files) {
      await ssh.putFile(f.local, f.remote);
      console.log('Uploaded: ' + f.local);
    }
    
    console.log('Reloading PM2...');
    const result = await ssh.execCommand('pm2 reload billing-app', { cwd: '/var/www/billing' });
    console.log('PM2 Result: ', result.stdout);
    ssh.dispose();
  } catch(err) {
    console.error(err);
    ssh.dispose();
  }
}
main();
