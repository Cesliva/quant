/**
 * Script to create beta access codes
 * Run with: npx tsx scripts/create-beta-codes.ts
 */

import { createBetaCode, generateSecureCode, updateBetaAccessConfig } from "../lib/utils/betaAccessSecure";
import { isFirebaseConfigured } from "../lib/firebase/config";

async function createBetaCodes() {
  if (!isFirebaseConfigured()) {
    console.error("❌ Firebase is not configured. Please set up Firebase credentials first.");
    process.exit(1);
  }

  try {
    // First, ensure beta access config is set up
    console.log("📋 Setting up beta access configuration...");
    await updateBetaAccessConfig({
      enabled: false, // Require codes
      rateLimitAttempts: 5,
      rateLimitWindowMinutes: 15,
      lockoutDurationMinutes: 15,
      message: "Beta access code is required. Contact support@quant.com for access.",
    });
    console.log("✅ Configuration updated\n");

    // Create different types of codes
    const codes: Array<{ code: string; type: string; options: any }> = [];

    console.log("🔐 Generating beta access codes...\n");

    // 1. Single-use VIP codes (for special testers)
    console.log("Creating single-use VIP codes...");
    for (let i = 0; i < 3; i++) {
      const code = generateSecureCode();
      await createBetaCode(code, {
        maxUses: 1,
        expiresInDays: 60,
        description: `VIP Beta Tester Code #${i + 1} (Single Use)`,
      });
      codes.push({ code, type: "VIP (Single Use)", options: { maxUses: 1, expiresInDays: 60 } });
      console.log(`  ✅ ${code}`);
    }

    // 2. Limited-use team codes (5 uses each)
    console.log("\nCreating limited-use team codes (5 uses each)...");
    for (let i = 0; i < 5; i++) {
      const code = generateSecureCode();
      await createBetaCode(code, {
        maxUses: 5,
        expiresInDays: 90,
        description: `Team Beta Code #${i + 1} (5 Uses)`,
      });
      codes.push({ code, type: "Team (5 Uses)", options: { maxUses: 5, expiresInDays: 90 } });
      console.log(`  ✅ ${code}`);
    }

    // 3. Unlimited codes (for broader testing)
    console.log("\nCreating unlimited codes...");
    for (let i = 0; i < 2; i++) {
      const code = generateSecureCode();
      await createBetaCode(code, {
        // No maxUses = unlimited
        expiresInDays: 120,
        description: `Public Beta Code #${i + 1} (Unlimited Uses)`,
      });
      codes.push({ code, type: "Public (Unlimited)", options: { expiresInDays: 120 } });
      console.log(`  ✅ ${code}`);
    }

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📝 BETA ACCESS CODES CREATED");
    console.log("=".repeat(60) + "\n");

    console.log("⚠️  IMPORTANT: Save these codes now! They won't be shown again.\n");

    codes.forEach((item, index) => {
      console.log(`${index + 1}. Code: ${item.code}`);
      console.log(`   Type: ${item.type}`);
      console.log(`   Expires: ${item.options.expiresInDays} days`);
      if (item.options.maxUses) {
        console.log(`   Uses: ${item.options.maxUses}`);
      } else {
        console.log(`   Uses: Unlimited`);
      }
      console.log("");
    });

    console.log("=".repeat(60));
    console.log("✅ All codes created successfully!");
    console.log("\nShare these codes securely with your beta testers.");
    console.log("Codes are stored securely in Firebase and ready to use.\n");

  } catch (error: any) {
    console.error("❌ Error creating codes:", error.message);
    process.exit(1);
  }
}

// Run the script
createBetaCodes();

