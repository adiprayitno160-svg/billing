$User = "adi"
$Pass = "adi"
$Ip = "192.168.239.154"
$RemotePath = "/home/adi/billing-update"
$TargetDir = "/var/www/billing"

# 1. Create remote temp directories
echo y | plink -ssh -l $User -pw $Pass $Ip "mkdir -p $RemotePath/views/dashboard $RemotePath/views/monitoring $RemotePath/views/partials $RemotePath/views/billing $RemotePath/views/customers $RemotePath/src/services/monitoring $RemotePath/src/services/billing $RemotePath/src/services/whatsapp $RemotePath/src/controllers/monitoring $RemotePath/src/controllers/billing $RemotePath/src/routes $RemotePath/src/schedulers"

# 2. Transfer all modified files using pscp
Write-Output "Transferring files..."
$files = @(
    "src\controllers\dashboardController.ts",
    "src\controllers\customerController.ts",
    "src\controllers\monitoring\networkMonitoringController.ts",
    "src\routes\index.ts",
    "src\routes\networkMonitoring.ts",
    "src\services\billing\CompensationService.ts",
    "src\services\billing\discountService.ts",
    "src\services\billing\isolationService.ts",
    "src\services\monitoring\AdvancedMonitoringService.ts",
    "src\services\pppoeService.ts",
    "src\server.ts",
    "src\schedulers\monitoringScheduler.ts",
    "views\billing\payment-form.ejs",
    "views\billing\tagihan-detail.ejs",
    "views\customers\detail.ejs",
    "views\dashboard\index.ejs",
    "views\partials\sidebar.ejs",
    "views\monitoring\enhanced-network-map.ejs",
    "views\monitoring\odp-problems.ejs",
    "src\services\whatsapp\WhatsAppService.ts",
    "src\services\whatsapp\index.ts"
)

foreach ($file in $files) {
    Write-Output "Uploading $file ..."
    $localPath = "c:\laragon\www\billing\$file"
    $remoteFileDir = $file | Split-Path -Parent
    $linuxDir = $remoteFileDir -replace "\\", "/"
    echo y | pscp -pw $Pass $localPath "$User@${Ip}:$RemotePath/$linuxDir/"
}

# 3. Apply updates on server
Write-Output "Applying updates and restarting..."
$commands = "
echo '$Pass' | sudo -S cp -r $RemotePath/* $TargetDir/
cd $TargetDir
echo '$Pass' | sudo -S npm run build
echo '$Pass' | sudo -S fuser -k 3002/tcp || true
echo '$Pass' | sudo -S pm2 delete billing-app || true
echo '$Pass' | sudo -S pm2 start dist/server.js --name billing-app --cwd $TargetDir
echo '$Pass' | sudo -S pm2 save
rm -rf $RemotePath
"

echo y | plink -ssh -l $User -pw $Pass $Ip $commands

Write-Output "Deployment Done!"
