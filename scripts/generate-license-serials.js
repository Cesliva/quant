/**
 * Generate License Serial Keys
 * 
 * Usage:
 *   node scripts/generate-license-serials.js [type] [count]
 * 
 * Examples:
 *   node scripts/generate-license-serials.js single-user 10
 *   node scripts/generate-license-serials.js multi-user 5
 */

const crypto = require('crypto');

function generateLicenseSerial() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars (0, O, I, 1)
  let serial = "";
  
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      serial += "-";
    }
    serial += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return serial;
}

const type = process.argv[2] || "single-user";
const count = parseInt(process.argv[3] || "10", 10);

if (type !== "single-user" && type !== "multi-user") {
  console.error("Error: Type must be 'single-user' or 'multi-user'");
  process.exit(1);
}

if (isNaN(count) || count < 1 || count > 100) {
  console.error("Error: Count must be between 1 and 100");
  process.exit(1);
}

console.log(`\n🔑 Generating ${count} ${type} license serial keys...\n`);
console.log("=".repeat(60));

const serials = [];
for (let i = 0; i < count; i++) {
  serials.push(generateLicenseSerial());
}

console.log("\nLicense Serial Keys Generated\n");
console.log("=".repeat(60));
console.log(`\nType: ${type === "single-user" ? "Single-User (Full Settings Access)" : "Multi-User (Admin-Only Settings)"}\n`);

serials.forEach((serial, index) => {
  console.log(`${(index + 1).toString().padStart(3, " ")}. ${serial}`);
});

console.log("\n" + "=".repeat(60));
console.log("\n📋 Copy these serials and create them using the API or Firebase:\n");
console.log("To create these licenses, use:");
console.log("  POST /api/license-serials");
console.log("  {");
console.log(`    "type": "${type}",`);
console.log("    "maxUses": 1,  // For single-user, set to 1");
console.log("    "expiresInDays": 90  // Optional");
console.log("  }\n");
console.log("Or use Firebase Console to add them manually to:");
console.log("  /licenseSerials/{serialHash}\n");
console.log("=".repeat(60) + "\n");

