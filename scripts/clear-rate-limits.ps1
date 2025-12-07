# Script to clear all rate limit locks
# This will allow users who were locked out to try again

$apiUrl = "http://localhost:3000/api/beta-codes"

Write-Host "Clearing rate limit locks..." -ForegroundColor Cyan

# Note: This would require an API endpoint to clear rate limits
# For now, you can manually delete the betaAccessRateLimits collection in Firebase Console
Write-Host ""
Write-Host "To clear rate limits:" -ForegroundColor Yellow
Write-Host "1. Go to Firebase Console -> Firestore Database" -ForegroundColor White
Write-Host "2. Find the collection: betaAccessRateLimits" -ForegroundColor White
Write-Host "3. Delete all documents in that collection" -ForegroundColor White
Write-Host ""
Write-Host "Or wait 15 minutes for the lockout to expire automatically." -ForegroundColor Green

