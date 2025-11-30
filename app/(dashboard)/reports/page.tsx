"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Download, FileText, Package, Users, Paintbrush, DollarSign, Filter, FileSpreadsheet } from "lucide-react";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { exportToPDF, exportToExcel } from "@/lib/utils/export";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useAuth } from "@/lib/hooks/useAuth";
import { createAuditLog } from "@/lib/utils/auditLog";

function ReportsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  // When accessed from /reports, params will be empty (no dynamic route)
  // params.id only exists if we're at /projects/[id]/reports
  const projectIdFromRoute = (params as any)?.id as string | undefined;
  const projectIdFromQuery = searchParams?.get("projectId") || "";
  const companyId = useCompanyId();

  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    projectIdFromRoute || projectIdFromQuery || ""
  );
  const [projects, setProjects] = useState<{ id: string; name: string; projectType?: string; projectTypeSubCategory?: string }[]>([]);
  const [filterProjectType, setFilterProjectType] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "type" | "value">("name");

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!firebaseReady) {
      setProjects([]);
      return () => {};
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<{ id: string; projectName?: string; projectType?: string; projectTypeSubCategory?: string; estimatedValue?: string | number }>(
      projectsPath,
      (data) => {
        const mapped = data.map((p) => ({
          id: p.id,
          name: p.projectName || "Untitled Project",
          projectType: p.projectType || "",
          projectTypeSubCategory: p.projectTypeSubCategory || "",
          estimatedValue: typeof p.estimatedValue === 'string' ? parseFloat(p.estimatedValue) : (p.estimatedValue || 0),
        }));
        setProjects(mapped);
        setSelectedProject((prev) => {
          if (prev) return prev;
          if (projectIdFromRoute && mapped.some((p) => p.id === projectIdFromRoute)) {
            return projectIdFromRoute;
          }
          if (projectIdFromQuery && mapped.some((p) => p.id === projectIdFromQuery)) {
            return projectIdFromQuery;
          }
          return mapped[0]?.id || "";
        });
      }
    );

    return () => unsubscribe();
  }, [companyId, projectIdFromRoute, projectIdFromQuery, firebaseReady]);

  useEffect(() => {
    const currentProjectId = selectedProject || projectIdFromRoute || projectIdFromQuery;
    if (!currentProjectId) return;

    if (!firebaseReady) {
      setLines([]);
      return () => {};
    }

    const linesPath = getProjectPath(companyId, currentProjectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [companyId, selectedProject, projectIdFromRoute, projectIdFromQuery, firebaseReady]);

  // Helper functions to get values based on material type
  const getWeight = (line: EstimatingLine) => {
    return line.materialType === "Material" 
      ? (line.totalWeight || 0) 
      : (line.plateTotalWeight || 0);
  };

  const getSurfaceArea = (line: EstimatingLine) => {
    return line.materialType === "Material"
      ? (line.totalSurfaceArea || 0)
      : (line.plateSurfaceArea || 0);
  };

  const getQuantity = (line: EstimatingLine) => {
    return line.materialType === "Material"
      ? (line.qty || 0)
      : (line.plateQty || 0);
  };

  const getShapeDisplay = (line: EstimatingLine) => {
    if (line.materialType === "Material") {
      return line.shapeType || "-";
    } else {
      return "Plate";
    }
  };

  const getSizeDisplay = (line: EstimatingLine) => {
    if (line.materialType === "Material") {
      return line.sizeDesignation || "-";
    } else {
      return line.thickness && line.width && line.plateLength
        ? `${line.thickness}" × ${line.width}" × ${line.plateLength}"`
        : "-";
    }
  };

  // Calculations
  const materialTotal = lines.reduce((sum, line) => sum + getWeight(line), 0);
  const laborTotal = lines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
  const coatingTotal = lines.reduce((sum, line) => sum + getSurfaceArea(line), 0);
  const costTotal = lines.reduce((sum, line) => sum + (line.totalCost || 0), 0);

  // Material breakdown by shape
  const materialByShape = lines.reduce((acc, line) => {
    const shape = getShapeDisplay(line) || "Other";
    if (!acc[shape]) {
      acc[shape] = { weight: 0, count: 0, cost: 0 };
    }
    acc[shape].weight += getWeight(line);
    acc[shape].count += 1;
    acc[shape].cost += (line.totalCost || 0);
    return acc;
  }, {} as Record<string, { weight: number; count: number; cost: number }>);

  // Unit costs
  const costPerPound = materialTotal > 0 ? costTotal / materialTotal : 0;
  const costPerSF = coatingTotal > 0 ? costTotal / coatingTotal : 0;
  const costPerHour = laborTotal > 0 ? costTotal / laborTotal : 0;

  const handleExport = async (type: "pdf" | "excel" | string) => {
      const currentProject = projects.find((p) => p.id === selectedProject);
      const projectName = currentProject?.name || "Project";
      
      if (type === "pdf") {
        try {
          await exportToPDF(lines, projectName, "Company");
          
          // Log audit trail for PDF export
          await createAuditLog(
            companyId,
            'EXPORT',
            'EXPORT',
            selectedProject || 'all',
            user,
            {
              projectId: selectedProject,
              entityName: `${projectName} - PDF Export`,
              metadata: {
                exportType: 'PDF',
                lineCount: lines.length,
              },
            }
          );
        } catch (error: any) {
          if (error.message === 'Save cancelled') {
            return;
          }
          console.error("Failed to export PDF:", error);
          alert(`Failed to export PDF: ${error.message}`);
        }
      } else if (type === "excel") {
        try {
          await exportToExcel(lines, projectName, "Company");
          
          // Log audit trail for Excel export
          await createAuditLog(
            companyId,
            'EXPORT',
            'EXPORT',
            selectedProject || 'all',
            user,
            {
              projectId: selectedProject,
              entityName: `${projectName} - Excel Export`,
              metadata: {
                exportType: 'Excel',
                lineCount: lines.length,
              },
            }
          );
        } catch (error: any) {
          if (error.message === 'Save cancelled') {
            return;
          }
          console.error("Failed to export Excel:", error);
          alert(`Failed to export Excel: ${error.message}`);
        }
    } else {
      // For category-specific exports, export filtered data as PDF
      let filteredLines = lines;
      
      if (type === "material") {
        // Export only material-related lines
        filteredLines = lines.filter(line => line.materialType === "Material" || line.materialType === "Plate");
      } else if (type === "labor") {
        // Export all lines (labor is on all lines)
        filteredLines = lines;
      } else if (type === "coating") {
        // Export lines with coating
        filteredLines = lines.filter(line => line.coatingSystem || line.totalSurfaceArea);
      } else if (type === "cost") {
        // Export all lines with costs
        filteredLines = lines.filter(line => line.totalCost);
      } else if (type === "material-detail") {
        // Export material breakdown
        filteredLines = lines.filter(line => line.materialType === "Material" || line.materialType === "Plate");
      } else if (type === "cost-analysis") {
        // Export all lines for cost analysis
        filteredLines = lines;
      }
      
      // Export filtered lines as PDF
      if (filteredLines.length > 0) {
        try {
          await exportToPDF(filteredLines, `${projectName} - ${type}`, "Company");
          
          // Log audit trail for filtered PDF export
          await createAuditLog(
            companyId,
            'EXPORT',
            'EXPORT',
            selectedProject || 'all',
            user,
            {
              projectId: selectedProject,
              entityName: `${projectName} - ${type} PDF Export`,
              metadata: {
                exportType: 'PDF',
                filterType: type,
                lineCount: filteredLines.length,
              },
            }
          );
        } catch (error: any) {
          if (error.message === 'Save cancelled') {
            return;
          }
          console.error("Failed to export PDF:", error);
          alert(`Failed to export PDF: ${error.message}`);
        }
    } else {
        alert(`No data available for ${type} export`);
      }
    }
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
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterProjectType}
              onChange={(e) => setFilterProjectType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Project Types</option>
              {Array.from(new Set(projects.map(p => p.projectType).filter(Boolean))).sort().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "type" | "value")}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="type">Sort by Type</option>
              <option value="value">Sort by Value</option>
            </select>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              <option value="">Select Project...</option>
              {(() => {
                let filtered = projects;
                if (filterProjectType) {
                  filtered = filtered.filter(p => p.projectType === filterProjectType);
                }
                filtered = [...filtered].sort((a, b) => {
                  if (sortBy === "type") {
                    return (a.projectType || "").localeCompare(b.projectType || "");
                  } else if (sortBy === "value") {
                    return (b.estimatedValue || 0) - (a.estimatedValue || 0);
                  } else {
                    return (a.name || "").localeCompare(b.name || "");
                  }
                });
                return filtered.map((project) => (
                <option key={project.id} value={project.id}>
                    {project.name} {project.projectType ? `(${project.projectType}${project.projectTypeSubCategory ? ` - ${project.projectTypeSubCategory}` : ""})` : ""}
                </option>
                ));
              })()}
            </select>
            {!firebaseReady && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                Firebase Not Configured
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

          {/* Material & Coating Breakdown - Golden Ratio (1.618:1) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-6">
            {/* Material Breakdown (61.8%) */}
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
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
                      lines.map((line) => {
                        const weight = getWeight(line);
                        const surfaceArea = getSurfaceArea(line);
                        const quantity = getQuantity(line);
                        const labor = line.totalLabor || 0;
                        const cost = line.totalCost || 0;

                        return (
                          <tr key={line.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900">{line.itemDescription || "-"}</td>
                            <td className="px-4 py-2 text-gray-700">{getShapeDisplay(line)}</td>
                            <td className="px-4 py-2 text-gray-700">{getSizeDisplay(line)}</td>
                            <td className="px-4 py-2 text-gray-700">{quantity}</td>
                            <td className="px-4 py-2 text-gray-700">
                              {weight > 0 ? weight.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-"}
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {surfaceArea > 0 ? surfaceArea.toFixed(1) : "-"}
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {labor > 0 ? labor.toFixed(2) : "-"}
                            </td>
                            <td className="px-4 py-2 text-gray-900 font-medium">
                              ${cost > 0 ? cost.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"}
                            </td>
                          </tr>
                        );
                      })
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
