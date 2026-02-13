$User = "adi"
$Pass = "adi"
$Ip = "192.168.239.154"
$RemotePath = "/home/adi/billing-update-noc"
$TargetDir = "/var/www/billing"

# 1. Create remote temp directories
Write-Output "Creating remote directories..."
echo y | plink -ssh -l $User -pw $Pass $Ip "mkdir -p $RemotePath/src/services/monitoring $RemotePath/src/controllers/monitoring $RemotePath/src/routes $RemotePath/src/schedulers $RemotePath/views/monitoring $RemotePath/views/partials"

# 2. Transfer modified files
Write-Output "Transferring NOC files..."
$files = @(
    "src\services\monitoring\NocIntelligenceService.ts",
    "src\controllers\monitoring\monitoringController.ts",
    "src\routes\monitoring.ts",
    "src\schedulers\monitoringScheduler.ts",
    "views\monitoring\noc-dashboard.ejs",
    "views\partials\sidebar.ejs"
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
echo '$Pass' | sudo -S pm2 reload billing-app || pm2 start dist/server.js --name billing-app
rm -rf $RemotePath
"

echo y | plink -ssh -l $User -pw $Pass $Ip $commands

Write-Output "NOC Deployment Completed Successfully!"
