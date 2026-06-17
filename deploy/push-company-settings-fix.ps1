# Upload only the 3 files missing/outdated on production.
# Run: powershell -ExecutionPolicy Bypass -File deploy\push-company-settings-fix.ps1

$Port = "65002"
$User = "u161582953"
$Host = "82.25.113.25"
$Api = "/home/u161582953/domains/danypathmart.store/public_html/api"
$Root = (Join-Path $PSScriptRoot ".." | Resolve-Path).Path

Write-Host "Uploading fixed company-settings index.php ..."
scp -P $Port "$Root\backend\api\admin\company-settings\index.php" "${User}@${Host}:${Api}/api/admin/company-settings/"

Write-Host "Uploading diagnostic scripts ..."
scp -P $Port "$Root\backend\scripts\check-company-settings.php" "$Root\backend\scripts\migrate-production.php" "${User}@${Host}:${Api}/scripts/"

Write-Host "Done. On server:"
Write-Host "  cd ~/domains/danypathmart.store/public_html/api"
Write-Host "  php scripts/migrate-production.php"
Write-Host "  php scripts/check-company-settings.php"
