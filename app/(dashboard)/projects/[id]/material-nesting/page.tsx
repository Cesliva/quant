"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Settings, FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import { subscribeToCollection, getDocument, getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import { nestMaterial, type NestingResult, type MaterialGroup, type StockLength } from "@/lib/utils/materialNesting";

export default function MaterialNestingPage() {
  const params = useParams();
  const projectId = params.id as string;
  const companyId = useCompanyId();

  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [projectNumber, setProjectNumber] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
  const [stockLengthFt, setStockLengthFt] = useState(20);
  const [stockRounding, setStockRounding] = useState(0.125);
  const [cuttingWaste, setCuttingWaste] = useState(0.125);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load project info
  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId || !companyId) {
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        const projectPath = getProjectPath(companyId, projectId);
        const projectData = await getDocument<{ projectName?: string; projectNumber?: string }>(projectPath);
        if (projectData) {
          setProjectName(projectData.projectName || projectId);
          setProjectNumber(projectData.projectNumber || "");
        }
      } catch (error) {
        console.error("Failed to load project:", error);
      }
    };

    loadProject();
  }, [companyId, projectId]);

  // Load company settings for stock rounding
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) return;

    const loadSettings = async () => {
      try {
        const settings = await loadCompanySettings(companyId);
        if (settings?.advancedSettings?.stockRounding) {
          setStockRounding(settings.advancedSettings.stockRounding);
        }
      } catch (error) {
        console.error("Failed to load company settings:", error);
      }
    };

    loadSettings();
  }, [companyId]);

  // Load estimating lines
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || !projectId) {
      setLines([]);
      setLoading(false);
      return;
    }

    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  // Calculate nesting when lines or settings change
  useEffect(() => {
    if (lines.length === 0) {
      setNestingResult(null);
      return;
    }

    // Use optimization to find best stock length (pass undefined to let it optimize)
    const result = nestMaterial(lines, undefined, stockRounding, cuttingWaste, true);
    setNestingResult(result);
    
    // Update stockLengthFt to match recommendation if available
    if (result.recommendation) {
      setStockLengthFt(result.recommendation.stockLengthFt);
    }
  }, [lines, stockRounding, cuttingWaste]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const exportToCSV = () => {
    if (!nestingResult) return;

    let csv = "Material Nesting - Cutting List\n";
    csv += `Project: ${projectNumber ? `${projectNumber} - ` : ""}${projectName}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;

    for (const group of nestingResult.groups) {
      const materialDesc = [
        group.shapeType,
        group.sizeDesignation,
        group.grade,
      ]
        .filter(Boolean)
        .join(" - ");

      csv += `\n${materialDesc}\n`;
      csv += `Stock Length: ${group.stockLengths[0]?.lengthFt || 20}'\n`;
      csv += `Total Stock Lengths: ${group.totalStockLengths}\n`;
      csv += `Total Waste: ${group.totalWastePercentage.toFixed(2)}%\n\n`;

      csv += "Stock #,Length (ft),Length (in),Drawing,Detail,Description,Used Length,Waste,Waste %\n";

      group.stockLengths.forEach((stock, index) => {
        const usedFt = Math.floor(stock.usedLength / 12);
        const usedIn = stock.usedLength % 12;
        const wasteFt = Math.floor(stock.wasteLength / 12);
        const wasteIn = stock.wasteLength % 12;

        stock.pieces.forEach((piece) => {
          csv += `${index + 1},${piece.lengthFt},${piece.lengthIn.toFixed(2)},${piece.drawingNumber},${piece.detailNumber},"${piece.itemDescription}",${usedFt}'${usedIn.toFixed(2)}",${wasteFt}'${wasteIn.toFixed(2)}",${stock.wastePercentage.toFixed(2)}%\n`;
        });
      });

      csv += "\n";
    }

    // Download CSV
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `material-nesting-${projectId}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatLength = (inches: number): string => {
    const ft = Math.floor(inches / 12);
    const in_ = inches % 12;
    if (ft > 0 && in_ > 0) {
      return `${ft}' ${in_.toFixed(2)}"`;
    } else if (ft > 0) {
      return `${ft}'`;
    } else {
      return `${in_.toFixed(2)}"`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading material nesting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-shrink">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Project Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
              Material Nesting & Cutting List
            </h1>
            <p className="text-sm text-gray-600 mt-1 truncate">
              {projectNumber ? `${projectNumber} - ` : ""}{projectName || projectId || "N/A"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 sm:px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2 transition-all shadow-md font-medium whitespace-nowrap"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm hidden sm:inline">Settings</span>
          </button>
          {nestingResult && (
            <button
              onClick={exportToCSV}
              className="px-3 sm:px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 transition-all shadow-md font-medium whitespace-nowrap"
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Nesting Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Length (feet)
              </label>
              <select
                value={stockLengthFt}
                onChange={(e) => setStockLengthFt(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={20}>20'</option>
                <option value={40}>40'</option>
                <option value={60}>60'</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Rounding (inches)
              </label>
              <input
                type="number"
                value={stockRounding}
                onChange={(e) => setStockRounding(parseFloat(e.target.value) || 0.125)}
                step="0.125"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cutting Waste per Cut (inches)
              </label>
              <input
                type="number"
                value={cuttingWaste}
                onChange={(e) => setCuttingWaste(parseFloat(e.target.value) || 0.125)}
                step="0.125"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {nestingResult && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Total Stock Lengths</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {nestingResult.totalStockLengths}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Overall Waste %</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {nestingResult.totalWastePercentage.toFixed(2)}%
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Total Weight</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {nestingResult.totalWeight.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              lbs
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Material Groups</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {nestingResult.groups.length}
            </div>
          </div>
        </div>
      )}

      {/* Optimization Recommendation */}
      {nestingResult?.recommendation && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Recommended Stock Length
              </h2>
              <p className="text-sm text-gray-600">
                Optimized for minimal waste across all materials
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {nestingResult.recommendation.stockLengthFt}'
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {nestingResult.recommendation.quantity} stock length
                {nestingResult.recommendation.quantity !== 1 ? "s" : ""} needed
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-xs text-gray-600 uppercase tracking-wide">Waste Percentage</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {nestingResult.recommendation.wastePercentage.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {nestingResult.recommendation.totalWasteInches.toFixed(2)}" total waste
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-xs text-gray-600 uppercase tracking-wide">Material Efficiency</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {nestingResult.recommendation.efficiency.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Utilization rate
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-xs text-gray-600 uppercase tracking-wide">Alternative Options</div>
              {nestingResult.recommendation.alternativeOptions && nestingResult.recommendation.alternativeOptions.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {nestingResult.recommendation.alternativeOptions.slice(0, 2).map((alt, idx) => (
                    <div key={idx} className="text-sm text-gray-700">
                      {alt.stockLengthFt}': {alt.quantity} pcs ({alt.wastePercentage.toFixed(2)}% waste)
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-2">No alternatives</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nesting Results */}
      {!nestingResult || nestingResult.groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Material to Nest</h3>
          <p className="text-gray-600">
            Add material lines to your estimate to see nesting results here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {nestingResult.groups.map((group, groupIndex) => {
            const materialDesc = [
              group.shapeType,
              group.sizeDesignation,
              group.grade,
            ]
              .filter(Boolean)
              .join(" - ");

            const groupKey = `${group.shapeType}-${group.sizeDesignation}-${group.grade}-${groupIndex}`;
            const isExpanded = expandedGroups.has(groupKey);

            return (
              <div
                key={groupKey}
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900">{materialDesc || "Unknown Material"}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {group.totalPieces} pieces • {group.totalStockLengths} stock length
                      {group.totalStockLengths !== 1 ? "s" : ""} •{" "}
                      {group.totalWastePercentage.toFixed(2)}% waste
                    </div>
                  </div>
                  <div className="ml-4 text-gray-400">
                    {isExpanded ? "▼" : "▶"}
                  </div>
                </button>

                {/* Group Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Stock #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Pieces
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Used Length
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Waste
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Waste %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {group.stockLengths.map((stock, stockIndex) => (
                            <tr key={stockIndex} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {stockIndex + 1}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="space-y-1">
                                  {stock.pieces.map((piece, pieceIndex) => (
                                    <div key={pieceIndex} className="text-xs">
                                      {piece.drawingNumber} / {piece.detailNumber} -{" "}
                                      {piece.lengthFt}' {piece.lengthIn.toFixed(2)}"
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {formatLength(stock.usedLength)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {formatLength(stock.wasteLength)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                <span
                                  className={
                                    stock.wastePercentage > 10
                                      ? "text-red-600 font-medium"
                                      : stock.wastePercentage > 5
                                      ? "text-yellow-600"
                                      : "text-green-600"
                                  }
                                >
                                  {stock.wastePercentage.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

