$User = "adi"
$Pass = "adi"
$Ip = "192.168.239.154"
$RemotePath = "/home/adi/billing-update-alert"
$TargetDir = "/var/www/billing"

# 1. Create remote temp directories
Write-Output "Creating remote directories..."
echo y | plink -ssh -l $User -pw $Pass $Ip "mkdir -p $RemotePath/src/services/monitoring"

# 2. Transfer modified files
Write-Output "Transferring Alert notification files..."
$files = @(
    "src\services\monitoring\CustomerNotificationService.ts",
    "src\services\monitoring\AdvancedMonitoringService.ts"
)

foreach ($file in $files) {
    Write-Output "Uploading $file ..."
    $localPath = "c:\laragon\www\billing\$file"
    $remoteFileDir = $file | Split-Path -Parent
    $linuxDir = $remoteFileDir -replace "\\", "/"
    echo y | pscp -pw $Pass $localPath "$User@${Ip}:$RemotePath/$linuxDir/"
}

# 3. Apply updates on server
Write-Output "Applying updates and rebuilding..."
$commands = "
echo '$Pass' | sudo -S cp -r $RemotePath/* $TargetDir/
cd $TargetDir
echo '$Pass' | sudo -S npm run build
echo '$Pass' | sudo -S pm2 reload billing-app || pm2 start dist/server.js --name billing-app
rm -rf $RemotePath
"

echo y | plink -ssh -l $User -pw $Pass $Ip $commands

Write-Output "Alert System Deployment Completed!"
