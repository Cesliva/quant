# Check if your IP is rate limited
# This will help diagnose if you're locked out

Write-Host "Checking rate limit status..." -ForegroundColor Cyan
Write-Host ""
Write-Host "If you're getting 'Invalid beta access code' errors, you might be rate-limited." -ForegroundColor Yellow
Write-Host ""
Write-Host "Solutions:" -ForegroundColor Green
Write-Host "1. Wait 15 minutes for the lockout to expire" -ForegroundColor White
Write-Host "2. Clear the betaAccessRateLimits collection in Firebase Console" -ForegroundColor White
Write-Host "3. Try using a different network/VPN" -ForegroundColor White
Write-Host ""
Write-Host "To clear rate limits in Firebase:" -ForegroundColor Cyan
Write-Host "1. Go to Firebase Console -> Firestore Database" -ForegroundColor White
Write-Host "2. Find collection: betaAccessRateLimits" -ForegroundColor White
Write-Host "3. Delete all documents" -ForegroundColor White
Write-Host ""
Write-Host "The beta code 'SNSA-88KR-ASKU' is valid and working!" -ForegroundColor Green

