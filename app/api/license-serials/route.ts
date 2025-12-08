import { NextRequest, NextResponse } from "next/server";
import {
  createLicenseSerial,
  generateLicenseSerial,
  getDocument,
  type LicenseType,
} from "@/lib/utils/licenseSerial";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getDocument as getFirestoreDocument, deleteDocument } from "@/lib/firebase/firestore";
import { queryDocuments } from "@/lib/firebase/firestore";
import { where } from "firebase/firestore";

/**
 * GET - List all license serials
 */
export async function GET(request: NextRequest) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as LicenseType | null;

    try {
      const licenses = await queryDocuments<{
        serial: string;
        type: LicenseType;
        status: string;
        currentUses: number;
        maxUses?: number;
        createdAt: any;
      }>(
        "licenseSerials",
        type ? [where("type", "==", type)] : []
      );

      return NextResponse.json({
        success: true,
        licenses: licenses.map((license) => ({
          id: license.serial,
          type: license.type,
          status: license.status,
          currentUses: license.currentUses || 0,
          maxUses: license.maxUses,
          createdAt: license.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("Failed to list licenses:", error);
      return NextResponse.json(
        { error: "Failed to list license serials" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("License serials GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get license serials" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new license serial
 */
export async function POST(request: NextRequest) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { type, maxUses, expiresInDays, description } = body;

    if (!type || (type !== "single-user" && type !== "multi-user")) {
      return NextResponse.json(
        { error: "License type must be 'single-user' or 'multi-user'" },
        { status: 400 }
      );
    }

    const result = await createLicenseSerial(type as LicenseType, {
      maxUses,
      expiresInDays,
      description,
    });

    return NextResponse.json({
      success: true,
      serial: result.serial,
      license: {
        type: result.licenseSerial.type,
        status: result.licenseSerial.status,
        maxUses: result.licenseSerial.maxUses,
        expiresAt: result.licenseSerial.expiresAt,
      },
    });
  } catch (error: any) {
    console.error("Create license serial error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create license serial" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a license serial
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const serialHash = searchParams.get("serialHash");

    if (!serialHash) {
      return NextResponse.json(
        { error: "Serial hash is required" },
        { status: 400 }
      );
    }

    await deleteDocument("licenseSerials", serialHash);

    return NextResponse.json({
      success: true,
      message: "License serial deleted",
    });
  } catch (error: any) {
    console.error("Delete license serial error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete license serial" },
      { status: 500 }
    );
  }
}

