"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, Check, X } from "lucide-react";

const PREDEFINED_CODES = [
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

export default function BetaCodesPage() {
  const [codes, setCodes] = useState<Array<{ code: string; maxUses: number; expiresInDays: number; status: "pending" | "creating" | "success" | "error"; error?: string }>>(
    PREDEFINED_CODES.map(code => ({
      code,
      maxUses: 10,
      expiresInDays: 30,
      status: "pending" as const,
    }))
  );

  const createCode = async (index: number) => {
    const codeData = codes[index];
    setCodes(prev => {
      const newCodes = [...prev];
      newCodes[index].status = "creating";
      return newCodes;
    });

    try {
      const response = await fetch("/api/beta-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeData.code,
          maxUses: codeData.maxUses,
          expiresInDays: codeData.expiresInDays,
          description: `Beta tester code #${index + 1}`,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create code");
      }

      setCodes(prev => {
        const newCodes = [...prev];
        newCodes[index].status = "success";
        return newCodes;
      });
    } catch (error: any) {
      setCodes(prev => {
        const newCodes = [...prev];
        newCodes[index].status = "error";
        newCodes[index].error = error.message;
        return newCodes;
      });
    }
  };

  const createAllCodes = async () => {
    for (let i = 0; i < codes.length; i++) {
      if (codes[i].status === "pending") {
        await createCode(i);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Beta Access Codes</h1>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage beta access codes for testers
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Predefined Codes</CardTitle>
            <Button
              variant="primary"
              onClick={createAllCodes}
              disabled={codes.every(c => c.status !== "pending")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create All Codes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {codes.map((codeData, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <code className="text-lg font-mono font-semibold text-gray-900">
                      {codeData.code}
                    </code>
                    {codeData.status === "success" && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <Check className="w-4 h-4" />
                        Created
                      </span>
                    )}
                    {codeData.status === "error" && (
                      <span className="flex items-center gap-1 text-sm text-red-600">
                        <X className="w-4 h-4" />
                        {codeData.error}
                      </span>
                    )}
                    {codeData.status === "creating" && (
                      <span className="text-sm text-blue-600">Creating...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>Uses: {codeData.maxUses}</span>
                    <span>Expires: {codeData.expiresInDays} days</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createCode(index)}
                  disabled={codeData.status === "creating" || codeData.status === "success"}
                >
                  {codeData.status === "pending" && "Create"}
                  {codeData.status === "creating" && "Creating..."}
                  {codeData.status === "success" && "Created"}
                  {codeData.status === "error" && "Retry"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share Codes Securely</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>✅ Once codes are created, share them securely with beta testers:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Send via email or secure messaging</li>
              <li>Never share codes in public channels</li>
              <li>One code per tester (for tracking)</li>
              <li>Codes expire in 30 days (configurable)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

