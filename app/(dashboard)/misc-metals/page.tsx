"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import { Sparkles, Loader2, Save, ArrowLeft } from "lucide-react";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { createDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import Link from "next/link";

interface ParsedLineItem {
  itemDescription: string;
  category: string;
  subCategory: string;
  materialType: "Material" | "Plate";
  sizeDesignation?: string;
  grade?: string;
  lengthFt?: number;
  lengthIn?: number;
  qty?: number;
  totalWeight?: number;
  totalSurfaceArea?: number;
  thickness?: number;
  width?: number;
  plateLength?: number;
  plateQty?: number;
  plateTotalWeight?: number;
  plateSurfaceArea?: number;
  laborUnload?: number;
  laborCut?: number;
  laborDrillPunch?: number;
  laborFit?: number;
  laborWeld?: number;
  laborPrepClean?: number;
  laborHandleMove?: number;
  laborLoadShip?: number;
  totalLabor?: number;
  coatingSystem?: string;
  materialCost?: number;
  laborCost?: number;
  coatingCost?: number;
  handlingCost?: number;
  totalCost?: number;
  notes?: string;
}

function MiscMetalsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId");
  const companyId = useCompanyId();
  
  const [description, setDescription] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedLineItem[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (companyId) {
      loadCompanySettings(companyId).then(setCompanySettings);
    }
  }, [companyId]);

  const handleParse = async () => {
    if (!description.trim()) {
      alert("Please enter a description");
      return;
    }

    setIsParsing(true);
    try {
      const response = await fetch("/api/misc-metals-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse description");
      }

      const data = await response.json();
      setParsedItems(data.items || []);
    } catch (error: any) {
      console.error("Parse error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveToProject = async () => {
    if (!projectId || !isFirebaseConfigured()) {
      alert("Please select a project first. Add ?projectId=YOUR_PROJECT_ID to the URL");
      return;
    }

    try {
      const linesPath = `companies/${companyId}/projects/${projectId}/estimatingLines`;
      
      for (const item of parsedItems) {
        const lineData: Partial<EstimatingLine> = {
          ...item,
          lineId: `M${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          status: "Active",
          category: item.category || "Misc Metals",
          drawingNumber: "",
          detailNumber: "",
        };
        
        await createDocument(linesPath, lineData);
      }

      alert(`Successfully added ${parsedItems.length} line(s) to project`);
      router.push(`/projects/${projectId}/estimating`);
    } catch (error: any) {
      console.error("Save error:", error);
      alert(`Error saving: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          {projectId && (
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </Link>
          )}
        </div>
        <h1 className="text-3xl font-bold mb-2">Misc Metals AI Estimator</h1>
        <p className="text-gray-600">
          Describe your misc metals items in natural language and get instant material, labor, and cost calculations based on your company standards.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Enter Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: 40 ft sch 40 three line pipe rail 42 inch high posts at 6 ft OC with vent holes for galvanizing"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
              />
              <p className="text-xs text-gray-500 mt-2">
                Examples: pipe rail, roof access ladder, cage ladder, track gates, sump pit frames, grates, ladders
              </p>
            </div>
            <Button
              onClick={handleParse}
              disabled={isParsing || !description.trim()}
              className="w-full"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Parse & Calculate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {parsedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parsed Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {parsedItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{item.itemDescription}</h3>
                      <p className="text-sm text-gray-600">
                        {item.category} - {item.subCategory}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        ${item.totalCost?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Material</p>
                      <p className="font-semibold">${item.materialCost?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Labor</p>
                      <p className="font-semibold">${item.laborCost?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Coating</p>
                      <p className="font-semibold">${item.coatingCost?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Handling</p>
                      <p className="font-semibold">${item.handlingCost?.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-sm text-gray-500 italic">{item.notes}</p>
                  )}
                </div>
              ))}

              {projectId && (
                <Button
                  onClick={handleSaveToProject}
                  className="w-full mt-4"
                  variant="primary"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save to Project ({parsedItems.length} items)
                </Button>
              )}
              {!projectId && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> To save these items to a project, add <code className="bg-yellow-100 px-1 rounded">?projectId=YOUR_PROJECT_ID</code> to the URL or navigate from a project page.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MiscMetalsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MiscMetalsContent />
    </Suspense>
  );
}

