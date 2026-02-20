$User = "adi"
$Pass = "adi"
$Ip = "192.168.239.154"
$RemotePath = "/home/adi/billing-update"
$TargetDir = "/var/www/billing"

# 1. Create remote temp directories
echo y | plink -ssh -l $User -pw $Pass $Ip "mkdir -p $RemotePath/views/dashboard $RemotePath/views/monitoring $RemotePath/views/partials $RemotePath/views/billing $RemotePath/views/customers $RemotePath/views/layouts $RemotePath/src/services/monitoring $RemotePath/src/services/billing $RemotePath/src/services/whatsapp $RemotePath/src/services/customer $RemotePath/src/services/notification $RemotePath/src/services/pppoe $RemotePath/src/controllers/monitoring $RemotePath/src/controllers/billing $RemotePath/src/routes $RemotePath/src/schedulers $RemotePath/src/utils"

# 2. Transfer all modified files using pscp
Write-Output "Transferring files..."
$files = @(
    "src\controllers\dashboardController.ts",
    "src\controllers\customerController.ts",
    "src\controllers\StaticIpImportController.ts",
    "src\controllers\monitoring\networkMonitoringController.ts",
    "src\controllers\billing\paymentController.ts",
    "src\routes\index.ts",
    "src\routes\networkMonitoring.ts",
    "src\routes\billing.ts",
    "src\services\billing\CompensationService.ts",
    "src\services\billing\discountService.ts",
    "src\services\billing\isolationService.ts",
    "src\services\billing\invoiceService.ts",
    "src\services\billing\invoiceSchedulerService.ts",
    "src\services\billing\SubscriptionService.ts",
    "src\services\monitoring\AdvancedMonitoringService.ts",
    "src\services\monitoring\CustomerNotificationService.ts",
    "src\services\monitoring\NetworkMonitoringService.ts",
    "src\services\monitoring\NocIntelligenceService.ts",
    "src\services\monitoring\AiSlaService.ts",
    "src\services\monitoring\PPPoEStaticMonitor.ts",
    "src\services\monitoring\RealtimeMonitoringService.ts",
    "src\services\monitoring\TwoHourNotificationService.ts",
    "src\services\monitoring\incidentAIService.ts",
    "src\services\monitoring\monitoringAnalyticsService.ts",
    "src\services\customer\CustomerNotificationService.ts",
    "src\services\notification\UnifiedNotificationService.ts",
    "src\services\notification\NotificationTemplateService.ts",
    "src\services\pppoeService.ts",
    "src\server.ts",
    "src\schedulers\monitoringScheduler.ts",
    "src\utils\autoFixDatabase.ts",
    "src\fix_whatsapp_sessions.ts",
    "views\billing\payment-form.ejs",
    "views\billing\payment-history.ejs",
    "views\billing\tagihan.ejs",
    "views\billing\tagihan-detail.ejs",
    "views\customers\detail.ejs",
    "views\customers\edit.ejs",
    "views\customers\list.ejs",
    "views\dashboard\index.ejs",
    "views\partials\sidebar.ejs",
    "views\monitoring\enhanced-network-map.ejs",
    "views\monitoring\odp-problems.ejs",
    "src\services\whatsapp\WhatsAppService.ts",
    "src\services\whatsapp\WhatsAppHandler.ts",
    "src\services\whatsapp\WhatsAppSessionService.ts",
    "src\services\whatsapp\index.ts",
    "src\services\pppoe\pppoeActivationService.ts",
    "src\services\scheduler.ts",
    "src\routes\settings.ts",
    "src\services\billing\PaymentShortageService.ts",
    "views\layouts\main.ejs"
)

foreach ($file in $files) {
    Write-Output "Uploading $file ..."
    $localPath = "c:\laragon\www\billing\$file"
    $remoteFileDir = $file | Split-Path -Parent
    $linuxDir = $remoteFileDir -replace "\\", "/"
    if ($linuxDir -eq "") {
        echo y | pscp -pw $Pass $localPath "$User@${Ip}:$RemotePath/"
    }
    else {
        echo y | pscp -pw $Pass $localPath "$User@${Ip}:$RemotePath/$linuxDir/"
    }
}

# 3. Apply updates on server
Write-Output "Applying updates and restarting..."
$remoteCmds = @(
    "echo '$Pass' | sudo -S cp -r $RemotePath/* $TargetDir/",
    "cd $TargetDir",
    "echo '$Pass' | sudo -S npm run build",
    "echo '$Pass' | sudo -S fuser -k 3002/tcp || true",
    "echo '$Pass' | sudo -S pm2 delete billing-app || true",
    "echo '$Pass' | sudo -S pm2 start dist/server.js --name billing-app --cwd $TargetDir",
    "echo '$Pass' | sudo -S pm2 save",
    "rm -rf $RemotePath"
) -join " && "

echo y | plink -batch -ssh -l $User -pw $Pass $Ip $remoteCmds

Write-Output "Deployment Done!"
