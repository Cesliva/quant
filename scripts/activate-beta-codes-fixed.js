/**
 * Script to activate beta codes via API
 * Run with: node scripts/activate-beta-codes-fixed.js
 */

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function activateCode(code) {
  try {
    const response = await fetch(`${API_URL}/api/beta-codes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code,
        maxUses: 10, // Allow 10 uses per code
        expiresInDays: 30, // Expires in 30 days
        description: `Beta access code - ${code}`,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Activated: ${code}`);
      return true;
    } else {
      console.error(`❌ Failed to activate ${code}:`, data.error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error activating ${code}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("🔐 Activating Beta Access Codes\n");
  console.log("=".repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const code of codes) {
    const success = await activateCode(code);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n✅ Successfully activated: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log("\nNote: If running locally, make sure your dev server is running.");
  console.log("If codes already exist, they will show as errors (that's okay).");
}

main().catch(console.error);

