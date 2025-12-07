/**
 * Quick script to generate beta access codes
 * Run with: node scripts/generate-beta-codes.js
 * 
 * This generates secure codes that you can then add to Firebase manually
 * or use the API to create them.
 */

function generateSecureCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0, O, I, 1)
  const segments = [4, 4, 4];
  
  return segments.map(segmentLength => {
    return Array.from({ length: segmentLength }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }).join("-");
}

console.log("🔐 Beta Access Codes Generated\n");
console.log("=".repeat(60));
console.log("Copy these codes and create them using the API or Firebase:\n");

// Generate 10 codes
const codes = [];
for (let i = 0; i < 10; i++) {
  const code = generateSecureCode();
  codes.push(code);
  console.log(`${i + 1}. ${code}`);
}

console.log("\n" + "=".repeat(60));
console.log("\nTo create these codes, use:");
console.log("1. POST /api/beta-codes with the code");
console.log("2. Or use Firebase Console to add them manually");
console.log("\nExample API call:");
console.log(`POST /api/beta-codes`);
console.log(`{`);
console.log(`  "code": "${codes[0]}",`);
console.log(`  "maxUses": 10,`);
console.log(`  "expiresInDays": 30`);
console.log(`}`);

