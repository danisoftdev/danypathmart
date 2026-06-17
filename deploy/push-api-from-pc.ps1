# Upload backend/ to Hostinger public_html/api (keeps server .env untouched).
# Run from repo root on your PC (you will be prompted for SSH password):
#   powershell -ExecutionPolicy Bypass -File deploy/push-api-from-pc.ps1

$ErrorActionPreference = "Stop"

$Host = "82.25.113.25"
$Port = "65002"
$User = "u161582953"
$RemoteApi = "/home/u161582953/domains/danypathmart.store/public_html/api"
$Backend = Join-Path $PSScriptRoot "..\backend" | Resolve-Path

Write-Host "Backend source: $Backend"
Write-Host "Remote API:   ${User}@${Host}:${RemoteApi}"
Write-Host ""

Push-Location $Backend
try {
    if (-not (Test-Path "vendor/autoload.php")) {
        Write-Host "Running composer install --no-dev ..."
        composer install --no-dev --optimize-autoloader --no-interaction
    }

    $folders = @("api", "config", "helpers", "middleware", "scripts", "uploads", "storage")
    foreach ($dir in $folders) {
        if (Test-Path $dir) {
            Write-Host "Uploading $dir/ ..."
            scp -P $Port -r $dir "${User}@${Host}:${RemoteApi}/"
        }
    }

    foreach ($file in @("index.php", "composer.json", "composer.lock", ".htaccess")) {
        if (Test-Path $file) {
            Write-Host "Uploading $file ..."
            scp -P $Port $file "${User}@${Host}:${RemoteApi}/"
        }
    }

    if (Test-Path "vendor") {
        Write-Host "Uploading vendor/ (may take a minute) ..."
        scp -P $Port -r vendor "${User}@${Host}:${RemoteApi}/"
    }

    $Database = Join-Path $PSScriptRoot "..\database" | Resolve-Path
    if (Test-Path $Database) {
        $RemoteDb = "/home/u161582953/domains/danypathmart.store/public_html/database"
        Write-Host "Uploading database/migrations ..."
        scp -P $Port -r (Join-Path $Database "migrations") "${User}@${Host}:${RemoteDb}/"
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done. On the server run:"
Write-Host "  cd ~/domains/danypathmart.store/public_html/api"
Write-Host "  php scripts/migrate-production.php"
Write-Host "  php scripts/check-company-settings.php"
