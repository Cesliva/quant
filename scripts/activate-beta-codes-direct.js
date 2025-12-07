/**
 * Script to activate beta codes directly using Firebase
 * Run with: node scripts/activate-beta-codes-direct.js
 * 
 * This script uses the same Firebase functions as the API, so it doesn't require the server to be running.
 */

// Import the beta access functions
const { createBetaCode } = require('../lib/utils/betaAccessSecure');

// Since we're in Node.js, we need to handle the imports differently
// Let's use a different approach - create codes directly using Firebase Admin

const codes = [
  "SNSA-88KR-ASKU",
  "Y3G7-VXWS-4SK9",
  "3GB2-8G5A-4CXE",
  "Z5AF-J69B-LV9L",
  "QGME-C3FU-HU2D",
  "ACWV-XJMA-7LER",
  "YKPE-UHC9-HBFX",
  "4RQX-Q83W-W9WK",
  "JWYF-7TGS-2CYP",
  "CZKR-NHCR-ZALL",
];

async function activateCodesDirectly() {
  // We need to use dynamic import since this is ES modules
  try {
    const { createBetaCode } = await import('../lib/utils/betaAccessSecure.js');
    
    console.log("🔐 Activating Beta Access Codes\n");
    console.log("=".repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (const code of codes) {
      try {
        await createBetaCode(code, {
          maxUses: 10,
          expiresInDays: 30,
          description: `Beta access code - ${code}`,
        });
        console.log(`✅ Activated: ${code}`);
        successCount++;
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`⚠️  Already exists: ${code}`);
          successCount++; // Count as success since it exists
        } else {
          console.error(`❌ Failed to activate ${code}:`, error.message);
          failCount++;
        }
      }
      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log("\n" + "=".repeat(60));
    console.log(`\n✅ Successfully activated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\nNote: Make sure Firebase is configured in your .env.local file");
    process.exit(1);
  }
}

activateCodesDirectly().catch(console.error);

