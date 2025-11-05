"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Download, FileText, Package, Users, Paintbrush, DollarSign, Filter } from "lucide-react";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface AIUsageLog {
  id: string;
  type: string;
  timestamp: any;
  cost: number;
  tokens?: number;
  duration?: number;
}

// TODO: REMOVE - This flag enables sample data for testing
// Set to false once Firebase is fully integrated
const USE_SAMPLE_DATA = true;

function ReportsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // When accessed from /reports, params will be empty (no dynamic route)
  // params.id only exists if we're at /projects/[id]/reports
  const projectIdFromRoute = (params as any)?.id as string | undefined;
  // Check URL search params for project ID (from landing page links)
  const projectIdFromQuery = searchParams?.get("projectId");
  const companyId = "default"; // TODO: Get from auth context

  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [aiUsage, setAiUsage] = useState<AIUsageLog[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    projectIdFromRoute || projectIdFromQuery || ""
  );

  // Mock projects list - replace with real Firestore query
  const projects = [
    { id: "1", name: "Downtown Office Building" },
    { id: "2", name: "Industrial Warehouse" },
    { id: "3", name: "Bridge Restoration" },
  ];

  useEffect(() => {
    const currentProjectId = selectedProject || projectIdFromRoute || projectIdFromQuery;
    if (!currentProjectId) return;

    // Use sample data if Firebase is not configured or USE_SAMPLE_DATA is true
    if (USE_SAMPLE_DATA || !isFirebaseConfigured()) {
      const sampleData = getSampleProjectData(currentProjectId);
      setLines(sampleData.lines);
      setAiUsage(sampleData.aiUsage);
      return;
    }

    // Use Firebase if configured
    const linesPath = getProjectPath(companyId, currentProjectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    const aiLogsPath = getProjectPath(companyId, currentProjectId, "aiLogs");
    const unsubscribeAI = subscribeToCollection<AIUsageLog>(
      aiLogsPath,
      (data) => {
        setAiUsage(data);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeAI();
    };
  }, [companyId, selectedProject, projectIdFromRoute, projectIdFromQuery]);

  // Calculations
  const materialTotal = lines.reduce((sum, line) => sum + (line.weight || 0), 0);
  const laborTotal = lines.reduce((sum, line) => sum + (line.laborHours || 0), 0);
  const coatingTotal = lines.reduce((sum, line) => sum + (line.surfaceArea || 0), 0);
  const costTotal = lines.reduce((sum, line) => sum + (line.cost || 0), 0);
  const aiCostTotal = aiUsage.reduce((sum, log) => sum + (log.cost || 0), 0);

  // Material breakdown by shape
  const materialByShape = lines.reduce((acc, line) => {
    const shape = line.shape || "Other";
    if (!acc[shape]) {
      acc[shape] = { weight: 0, count: 0, cost: 0 };
    }
    acc[shape].weight += line.weight || 0;
    acc[shape].count += 1;
    acc[shape].cost += line.cost || 0;
    return acc;
  }, {} as Record<string, { weight: number; count: number; cost: number }>);

  // Unit costs
  const costPerPound = materialTotal > 0 ? costTotal / materialTotal : 0;
  const costPerSF = coatingTotal > 0 ? costTotal / coatingTotal : 0;
  const costPerHour = laborTotal > 0 ? costTotal / laborTotal : 0;

  const handleExport = (type: string) => {
    // TODO: Implement CSV/PDF export
    alert(`${type} export functionality coming soon!`);
  };

  const handleProjectChange = (newProjectId: string) => {
    setSelectedProject(newProjectId);
    // Update URL with project ID as query param
    if (newProjectId) {
      router.push(`/reports?projectId=${newProjectId}`);
    } else {
      router.push("/reports");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Detailed project analysis and summaries
          </p>
        </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            {USE_SAMPLE_DATA && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                Sample Data
              </span>
            )}
          </div>
      </div>

      {!selectedProject && !projectIdFromRoute && !projectIdFromQuery ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Project Selected
            </h3>
            <p className="text-gray-600 mb-6">
              Please select a project to view detailed reports and summaries.
            </p>
            <Link href="/">
              <Button variant="primary">View Projects</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <Button variant="outline" size="sm" onClick={() => handleExport("material")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-1">Total Weight</p>
                <p className="text-2xl font-bold text-gray-900">
                  {materialTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} lbs
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {lines.length} line items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <Button variant="outline" size="sm" onClick={() => handleExport("labor")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-1">Labor Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {laborTotal.toFixed(1)} hrs
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {laborTotal > 0 ? `${(laborTotal / 40).toFixed(1)} weeks` : "0 weeks"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Paintbrush className="w-5 h-5 text-purple-600" />
                  <Button variant="outline" size="sm" onClick={() => handleExport("coating")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-1">Surface Area</p>
                <p className="text-2xl font-bold text-gray-900">
                  {coatingTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} SF
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Paint & Galvanizing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-orange-600" />
                  <Button variant="outline" size="sm" onClick={() => handleExport("cost")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${costTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ${costPerPound.toFixed(2)}/lb
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Material Breakdown */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Material Breakdown</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => handleExport("material-detail")}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(materialByShape).length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {Object.entries(materialByShape).map(([shape, data]) => (
                          <div key={shape} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{shape || "Other"}</p>
                              <p className="text-sm text-gray-600">
                                {data.count} items • {data.weight.toLocaleString("en-US", { maximumFractionDigits: 0 })} lbs
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                ${data.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {((data.weight / materialTotal) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Weight:</span>
                          <span className="font-semibold">{materialTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} lbs</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No material data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cost Analysis */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cost Analysis</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => handleExport("cost-analysis")}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Material Cost</span>
                      <span className="font-semibold text-gray-900">
                        ${costTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Labor Cost</span>
                      <span className="font-semibold text-gray-900">
                        ${(laborTotal * 75).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-gray-500">(Est. @ $75/hr)</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">Coating Cost</span>
                      <span className="font-semibold text-gray-900">
                        ${(coatingTotal * 2.5).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-gray-500">(Est. @ $2.50/SF)</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost per Pound:</span>
                      <span className="font-semibold">${costPerPound.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost per SF:</span>
                      <span className="font-semibold">${costPerSF.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost per Hour:</span>
                      <span className="font-semibold">${costPerHour.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Line Items Report */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Line Item Report</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExport("line-items")}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Shape</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Weight (lbs)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Surface (SF)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Labor (hrs)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No line items yet. Add items in the estimating grid.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{line.item}</td>
                          <td className="px-4 py-2 text-gray-700">{line.shape}</td>
                          <td className="px-4 py-2 text-gray-700">{line.size}</td>
                          <td className="px-4 py-2 text-gray-700">{line.qty}</td>
                          <td className="px-4 py-2 text-gray-700">
                            {line.weight.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {line.surfaceArea.toFixed(1)}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {line.laborHours.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-gray-900 font-medium">
                            ${line.cost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                    {lines.length > 0 && (
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={4} className="px-4 py-3 text-gray-900">Total</td>
                        <td className="px-4 py-3 text-gray-900">
                          {materialTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {coatingTotal.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {laborTotal.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          ${costTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AI Usage Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle>AI Usage Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total AI Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${aiCostTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">This project</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">AI Calls</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {aiUsage.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {aiUsage.filter((log) => log.type === "whisper").length} transcriptions,{" "}
                    {aiUsage.filter((log) => log.type === "spec-review").length} reviews,{" "}
                    {aiUsage.filter((log) => log.type === "proposal").length} proposals
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Average Cost per Call</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${aiUsage.length > 0 ? (aiCostTotal / aiUsage.length).toFixed(2) : "0.00"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Cost efficiency</p>
                </div>
              </div>
              {aiUsage.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Recent AI Usage</h4>
                  <div className="space-y-2">
                    {aiUsage.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {log.type}
                          </span>
                          <span className="text-gray-600">
                            {log.timestamp?.toDate?.()?.toLocaleDateString() || "Recent"}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">${log.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-gray-600">Loading reports...</p>
          </div>
        </div>
      </div>
    }>
      <ReportsContent />
    </Suspense>
  );
}
