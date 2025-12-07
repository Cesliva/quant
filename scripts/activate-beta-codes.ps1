# PowerShell script to activate beta codes via API
# Make sure your dev server is running on http://localhost:3000

$codes = @(
    "SNSA-88KR-ASKU",
    "Y3G7-VXWS-4SK9",
    "3GB2-8G5A-4CXE",
    "Z5AF-J69B-LV9L",
    "QGME-C3FU-HU2D",
    "ACWV-XJMA-7LER",
    "YKPE-UHC9-HBFX",
    "4RQX-Q83W-W9WK",
    "JWYF-7TGS-2CYP",
    "CZKR-NHCR-ZALL"
)

$apiUrl = "http://localhost:3000/api/beta-codes"
$successCount = 0
$failCount = 0

Write-Host "Activating Beta Access Codes" -ForegroundColor Cyan
Write-Host ("=" * 60)

foreach ($code in $codes) {
    try {
        $body = @{
            code = $code
            maxUses = 10
            expiresInDays = 30
            description = "Beta access code - $code"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "Activated: $code" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "Failed to activate $code (Status: $($response.StatusCode))" -ForegroundColor Red
            $failCount++
        }
    } catch {
        $errorMessage = $_.Exception.Message
        if ($errorMessage -like "*already exists*" -or $errorMessage -like "*409*") {
            Write-Host "Already exists: $code" -ForegroundColor Yellow
            $successCount++
        } else {
            Write-Host "Error activating $code : $errorMessage" -ForegroundColor Red
            $failCount++
        }
    }
    
    Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host ("=" * 60)
Write-Host "Successfully activated: $successCount" -ForegroundColor Green
$failColor = if ($failCount -gt 0) { "Red" } else { "Green" }
Write-Host "Failed: $failCount" -ForegroundColor $failColor
Write-Host ""
Write-Host "Note: Make sure your dev server is running on http://localhost:3000"
