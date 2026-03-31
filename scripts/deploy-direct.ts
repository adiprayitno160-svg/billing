import { NodeSSH } from 'node-ssh';
import path from 'path';

async function deploy() {
  const ssh = new NodeSSH();
  const remotePath = '/home/adi/billing'; // Adjust based on reality, I'll check /var/www/billing too
  
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    // Check if path exists
    const checkPath = await ssh.execCommand('ls -d /home/adi/billing');
    let target = '/home/adi/billing';
    if (checkPath.code !== 0) {
        target = '/var/www/billing';
    }
    console.log(`Target directory: ${target}`);

    console.log('Uploading UnifiedNotificationService.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/services/notification/UnifiedNotificationService.ts',
      `${target}/src/services/notification/UnifiedNotificationService.ts`
    );

    console.log('Uploading invoiceController.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/controllers/billing/invoiceController.ts',
      `${target}/src/controllers/billing/invoiceController.ts`
    );

    console.log('Fixing build: Uploading clean monitoringController.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/controllers/monitoring/monitoringController.ts',
      `${target}/src/controllers/monitoring/monitoringController.ts`
    );

    console.log('Fixing build: Uploading matching monitoring.ts routes...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/routes/monitoring.ts',
      `${target}/src/routes/monitoring.ts`
    );

    console.log('Uploading fix-and-restore.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/scripts/fix-and-restore.ts',
      `${target}/scripts/fix-and-restore.ts`
    );

    console.log('Uploading excelController.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/controllers/excelController.ts',
      `${target}/src/controllers/excelController.ts`
    );

    console.log('Uploading StaticIpImportController.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/controllers/StaticIpImportController.ts',
      `${target}/src/controllers/StaticIpImportController.ts`
    );

    console.log('Uploading staticIpClientService.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/services/staticIpClientService.ts',
      `${target}/src/services/staticIpClientService.ts`
    );

    console.log('Uploading isolationService.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/services/billing/isolationService.ts',
      `${target}/src/services/billing/isolationService.ts`
    );

    console.log('Uploading cleanup-system.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/scripts/cleanup-system.ts',
      `${target}/scripts/cleanup-system.ts`
    );

    console.log('Uploading settings.ts routes...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/routes/settings.ts',
      `${target}/src/routes/settings.ts`
    );

    console.log('Uploading companyController.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/controllers/settings/companyController.ts',
      `${target}/src/controllers/settings/companyController.ts`
    );

    console.log('Uploading PrepaidBotHandler.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/services/whatsapp/PrepaidBotHandler.ts',
      `${target}/src/services/whatsapp/PrepaidBotHandler.ts`
    );

    console.log('Uploading company.ejs...');
    await ssh.putFile(
      'c:/laragon/www/billing/views/settings/company.ejs',
      `${target}/views/settings/company.ejs`
    );

    console.log('Uploading AdvancedPaymentVerificationService.ts...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/services/ai/AdvancedPaymentVerificationService.ts',
      `${target}/src/services/ai/AdvancedPaymentVerificationService.ts`
    );

    console.log('Uploading index.ts routes...');
    await ssh.putFile(
      'c:/laragon/www/billing/src/routes/index.ts',
      `${target}/src/routes/index.ts`
    );

    console.log('Running build on server...');
    const buildResult = await ssh.execCommand('npm run build', { cwd: target });
    console.log('Build output:', buildResult.stdout);
    
    if (buildResult.code === 0) {
        console.log('Running cleanup and optimization...');
        await ssh.execCommand('npx ts-node scripts/cleanup-system.ts', { cwd: target });

        console.log('Running fix and restore...');
        const restoreResult = await ssh.execCommand('npx ts-node scripts/fix-and-restore.ts', { cwd: target });
        console.log('Restore output:', restoreResult.stdout);
        if (restoreResult.stderr) console.error('Restore errors:', restoreResult.stderr);

        console.log('Restarting app...');
        await ssh.execCommand('pm2 reload all && pm2 reload billing', { cwd: target });
        console.log('Deployment complete!');
    } else {
        console.error('Build failed!', buildResult.stderr);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
