Param(
  [Parameter(Mandatory=$true)][string]$Tag,
  [Parameter(Mandatory=$true)][string]$Server, # user@host
  [string]$RemotePath = "/opt/billing"
)

$ErrorActionPreference = 'Stop'

Write-Host "📦 Preparing release $Tag"

git fetch origin --tags | Out-Null

# Create tag if missing
try {
  git rev-parse $Tag | Out-Null
  Write-Host "🔖 Tag $Tag already exists"
} catch {
  Write-Host "🔖 Creating tag $Tag"
  git tag $Tag
  git push origin $Tag
}

# Find changelog
$changelog = "CHANGELOG_$Tag.md"
if (-not (Test-Path $changelog)) {
  # keep as-is; release can be created without notes
  $notesArg = @()
} else {
  $notesArg = @("--notes-file", $changelog)
}

Write-Host "🚀 Creating GitHub release $Tag"
try {
  gh release create $Tag --title $Tag @notesArg
} catch {
  Write-Host "(info) Release may already exist"
}

Write-Host "🛳️  Deploying to $Server:$RemotePath"
$cmd = @"
set -e
cd '$RemotePath'
git fetch --tags --force
git checkout -f '$Tag'
npm install --no-audit --no-fund
npm run build
pm2 restart billing-app || pm2 start dist/server.js --name billing-app
pm2 list
"@

ssh $Server $cmd

Write-Host "✅ Release $Tag created and deployed."



