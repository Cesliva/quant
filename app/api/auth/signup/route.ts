import { NextRequest, NextResponse } from "next/server";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { setDocument } from "@/lib/firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, companyName } = body;

    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!auth) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Generate company ID
    const companyId = crypto.randomUUID();

    // Create company document
    await setDocument(
      `companies/${companyId}`,
      {
        companyName,
        createdAt: new Date(),
        ownerId: user.uid,
        settings: {
          materialRate: 1.10,
          laborRate: 45.00,
          coatingTypes: [
            { type: "None", costPerSF: 0 },
            { type: "Galvanizing", costPerPound: 0.45 },
            { type: "Paint", costPerSF: 2.50 },
            { type: "Powder Coat", costPerSF: 3.00 },
          ],
        },
      },
      false
    );

    // Create user document
    await setDocument(
      `companies/${companyId}/members/${user.uid}`,
      {
        userId: user.uid,
        email,
        name,
        role: "admin",
        permissions: {
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewReports: true,
          canManageUsers: true,
        },
        status: "active",
        joinedAt: new Date(),
      },
      false
    );

    // Create user document with company reference
    await setDocument(
      `users/${user.uid}`,
      {
        email,
        name,
        company: companyId,
        createdAt: new Date(),
      },
      false
    );

    return NextResponse.json({
      success: true,
      userId: user.uid,
      companyId,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

