/**
 * Test beta code validation
 */

const crypto = require('crypto');

function hashCode(code) {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

const testCode = "SNSA-88KR-ASKU";
const hash = hashCode(testCode);

console.log("Testing beta code validation:");
console.log("Code:", testCode);
console.log("Expected hash:", hash);
console.log("\nThis hash should match the document ID in Firestore:");
console.log("betaAccessCodes/" + hash);

