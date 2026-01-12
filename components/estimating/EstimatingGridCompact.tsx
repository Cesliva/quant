"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Edit, Trash2, Copy, X, Check, Info } from "lucide-react";
import { EstimatingLine } from "./EstimatingGrid";
import { getShapesByType, SHAPE_TYPES } from "@/lib/utils/aiscShapes";
import { getMaterialGradeInfo, getPlateGradeInfo } from "@/lib/utils/steelGradeInfo";
import {
  getAvailableThicknesses,
  getThicknessLabelFromInches,
  convertThicknessInputToInches,
} from "@/lib/utils/plateDatabase";
import EstimatingRowDetail from "./EstimatingRowDetail";

const plateThicknesses = getAvailableThicknesses();
const plateThicknessOptions = plateThicknesses.map((spec) => spec.thickness);

interface EstimatingGridCompactProps {
  lines: EstimatingLine[];
  allLines?: EstimatingLine[]; // All lines (ungrouped) for parent dropdown
  editingId: string | null;
  editingLine: Partial<EstimatingLine>;
  isManualMode: boolean;
  defaultMaterialRate: number;
  defaultLaborRate: number;
  defaultCoatingRate: number;
  companySettings?: import("@/lib/utils/settingsLoader").CompanySettings | null;
  projectSettings?: import("@/lib/utils/settingsLoader").ProjectSettings | null;
  onEdit: (line: EstimatingLine) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (lineId: string) => void;
  onDuplicate: (line: EstimatingLine) => void;
  onChange: (field: keyof EstimatingLine, value: any, line?: EstimatingLine) => void;
  totals: {
    totalWeight: number;
    totalSurfaceArea: number;
    totalLabor: number;
    totalQuantity: number;
    materialCost: number;
    laborCost: number;
    coatingCost: number;
    hardwareCost: number;
    totalCost: number;
  };
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (field: string) => void;
}

// Grade Info Tooltip Component
function GradeInfoTooltip({ materialType }: { materialType: "Material" | "Plate" | null }) {
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showInfo && infoRef.current) {
        const target = event.target as Node;
        if (!infoRef.current.contains(target)) {
          setShowInfo(false);
        }
      }
    };

    if (showInfo) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showInfo]);

  // Get all grades for the tooltip
  const allMaterialGrades = [
    "A992", "A913 Grade 65", "A913 Grade 70", "A500 Grade B", "A500 Grade C",
    "A1085", "A53 Type E", "A53 Type S", "A252 Grade 1", "A252 Grade 2",
    "A252 Grade 3", "Stainless 304", "Stainless 316"
  ];
  const allPlateGrades = [
    "A36", "A572 Grade 50", "A572 Grade 42", "A588 (Weathering)",
    "A514 (T-1)", "A516 Grade 70", "A529 Grade 50"
  ];

  const grades = materialType === "Material" ? allMaterialGrades : 
                 materialType === "Plate" ? allPlateGrades :
                 [...allMaterialGrades, ...allPlateGrades];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setShowInfo(!showInfo);
        }}
        className="text-blue-500 hover:text-blue-700 transition-colors"
        title="View grade information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {showInfo && (
        <div
          ref={infoRef}
          className="absolute right-0 top-6 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-xl p-4 text-xs"
          style={{ maxHeight: "300px", overflowY: "auto" }}
        >
          <div className="font-semibold text-sm text-gray-900 mb-3 pb-2 border-b">
            Steel Grade Reference
          </div>
          <div className="space-y-4">
            {grades.map((grade) => {
              const gradeInfo = materialType === "Material" || (!materialType && allMaterialGrades.includes(grade))
                ? getMaterialGradeInfo(grade)
                : getPlateGradeInfo(grade);
              if (!gradeInfo) return null;
              return (
                <div key={grade} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="font-semibold text-gray-900 mb-1">{gradeInfo.grade}</div>
                  <div className="text-gray-600 mb-2">{gradeInfo.description}</div>
                  {gradeInfo.yieldStrength && (
                    <div className="text-gray-500 mb-2">
                      <span className="font-medium">Yield Strength:</span> {gradeInfo.yieldStrength}
                    </div>
                  )}
                  <div className="mb-2">
                    <div className="font-medium text-gray-700 mb-1">Typical Uses:</div>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                      {gradeInfo.typicalUses.map((use, idx) => (
                        <li key={idx}>{use}</li>
                      ))}
                    </ul>
                  </div>
                  {gradeInfo.notes && (
                    <div className="text-gray-500 italic text-xs mt-2">
                      {gradeInfo.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EstimatingGridCompact({
  lines,
  allLines = lines,
  editingId,
  editingLine,
  isManualMode,
  defaultMaterialRate,
  defaultLaborRate,
  defaultCoatingRate,
  companySettings,
  projectSettings,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  onChange,
  totals,
  sortBy,
  sortDirection,
  onSortChange,
}: EstimatingGridCompactProps) {
  // State for filterable size dropdowns (per row)
  const [sizeFilters, setSizeFilters] = useState<Record<string, string>>({});
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState<Record<string, boolean>>({});
  const sizeDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // State for expanded row detail view
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      Object.keys(sizeDropdownOpen).forEach((lineId) => {
        if (sizeDropdownOpen[lineId] && sizeDropdownRefs.current[lineId]) {
          const dropdownElement = sizeDropdownRefs.current[lineId];
          if (dropdownElement && !dropdownElement.contains(target)) {
            setSizeDropdownOpen((prev) => ({ ...prev, [lineId]: false }));
            setSizeFilters((prev) => ({ ...prev, [lineId]: "" }));
          }
        }
      });
    };

    if (Object.values(sizeDropdownOpen).some(open => open)) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [sizeDropdownOpen]);


  const getPlateThicknessDisplay = (thickness?: number | string) => {
    if (typeof thickness === "number") {
      return getThicknessLabelFromInches(thickness) || thickness.toFixed(3);
    }
    if (typeof thickness === "string" && thickness) {
      const numeric = convertThicknessInputToInches(thickness);
      return getThicknessLabelFromInches(numeric) || thickness;
    }
    return "";
  };

  const getSpecDisplay = (line: EstimatingLine) => {
    if (line.materialType === "Material") {
      const shapeType = line.shapeType || "";
      const sizeDesignation = line.sizeDesignation || "";
      
      // Check if sizeDesignation already starts with the shapeType to avoid duplication
      // e.g., if shapeType is "W" and sizeDesignation is "W10X15", don't add "W" again
      if (sizeDesignation && shapeType) {
        const sizeUpper = sizeDesignation.toUpperCase();
        const shapeUpper = shapeType.toUpperCase();
        if (sizeUpper.startsWith(shapeUpper)) {
          // sizeDesignation already includes the shape type, just return it
          return sizeDesignation;
        }
      }
      
      // Otherwise, combine shapeType and sizeDesignation
      return `${shapeType} ${sizeDesignation}`.trim() || "-";
    } else if (line.materialType === "Plate") {
      const thicknessLabel = getPlateThicknessDisplay(line.thickness);
      if (thicknessLabel && line.width && line.plateLength) {
        return `${thicknessLabel}" × ${line.width}" × ${line.plateLength}"`;
      }
      return "-";
    }
    return "-";
  };

  const getTotalWeight = (line: EstimatingLine) => {
    // If this line is being edited, use the calculated values from editingLine
    const isEditing = editingId === line.id;
    const currentLine = isEditing ? { ...line, ...editingLine } : line;
    
    if (currentLine.materialType === "Material") {
      return currentLine.totalWeight || 0;
    } else {
      return currentLine.plateTotalWeight || 0;
    }
  };

  const getHashtagsDisplay = (hashtags?: string) => {
    if (!hashtags || hashtags.trim() === "") {
      return <span className="text-gray-400 text-xs">-</span>;
    }
    // Display hashtags, highlighting if they contain numbers (like #32)
    const hashtagParts = hashtags.split(/\s+/).filter(h => h.trim() !== "");
    return (
      <div className="flex flex-wrap gap-1">
        {hashtagParts.map((tag, idx) => {
          const isNumbered = /#?\d+/.test(tag);
          return (
            <span
              key={idx}
              className={`px-2 py-0.5 text-xs rounded-full ${
                isNumbered
                  ? "bg-blue-500 text-white font-medium"
                  : "bg-gray-300 text-gray-800"
              }`}
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          );
        })}
      </div>
    );
  };

  const getTypeBadge = (type?: string) => {
    if (type === "Material") {
      return <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">Material</span>;
    } else if (type === "Plate") {
      return <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded font-medium">Plate</span>;
    }
    return <span className="px-2 py-0.5 bg-gray-300 text-gray-800 text-xs rounded">-</span>;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200/60 bg-white shadow-sm min-h-[400px]">
      <div className="w-full">
        <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
          <thead className="bg-gradient-to-b from-gray-50/50 to-gray-50/30 border-b border-gray-200/60">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-xs text-gray-700 uppercase tracking-wider w-[80px]">
              Line
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs text-gray-700 uppercase tracking-wider w-[100px]">
              Type
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs text-gray-700 uppercase tracking-wider flex-1 min-w-[180px]">
              Specification
            </th>
            <th className="px-4 py-3 text-center font-semibold text-xs text-gray-700 uppercase tracking-wider w-[70px]">
              Qty
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-gray-700 uppercase tracking-wider w-[100px]">
              Weight
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-gray-700 uppercase tracking-wider w-[80px]">
              Hours
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-gray-700 uppercase tracking-wider w-[110px]">
              Cost
            </th>
            <th className="px-4 py-3 text-center font-semibold text-xs text-gray-700 uppercase tracking-wider w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100/60">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                No lines yet. Click &quot;Add Line&quot; to get started.
              </td>
            </tr>
          ) : (
            lines.map((line) => {
              const isEditing = editingId === line.id;
              // Merge editingLine with line for display when editing
              const displayLine = isEditing ? { ...line, ...editingLine } : line;
              const isSmallPart = !displayLine.isMainMember && displayLine.parentLineId;
              const hardwareCostDisplay = (
                displayLine.hardwareCost !== undefined && displayLine.hardwareCost !== null
                  ? displayLine.hardwareCost
                  : (displayLine.hardwareQuantity || 0) * (displayLine.hardwareCostPerSet || 0)
              );
              const lengthDisplay = displayLine.materialType === "Material"
                ? `${displayLine.lengthFt || 0}'${displayLine.lengthIn ? ` ${displayLine.lengthIn}"` : ""}`
                : displayLine.plateLength
                ? `${displayLine.plateLength}"`
                : "-";

              return (
                <React.Fragment key={line.id}>
                <tr
                  id={`line-${line.id}`}
                  className={`border-b border-gray-100 hover:bg-blue-50/30 transition-all duration-150 ${
                    line.status === "Void" ? "opacity-40 bg-gray-50" : ""
                  } ${expandedLineId === line.id ? "bg-blue-50/50" : ""}`}
                >
                    {/* Line ID - Click to expand */}
                    <td className="px-4 py-3 w-[80px]">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedLineId(expandedLineId === line.id ? null : line.id || null);
                        }}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors text-left group font-medium text-gray-900 cursor-pointer"
                        title="Click to expand details"
                        type="button"
                      >
                        <span className="underline decoration-dotted underline-offset-2 group-hover:decoration-solid">
                          {line.lineId || "-"}
                        </span>
                        {expandedLineId === line.id ? (
                          <ChevronUp className="w-3 h-3 text-blue-500" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>

                    {/* Type Badge */}
                    <td className="px-4 py-3 w-[100px]">
                      {displayLine.materialType === "Material" ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                          {displayLine.shapeType || "Material"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
                          Plate
                        </span>
                      )}
                    </td>

                    {/* Specification - Combined size/grade info */}
                    <td className="px-4 py-3 text-gray-800 flex-1 min-w-[180px]">
                      <div className="font-medium">
                        {getSpecDisplay(displayLine)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {displayLine.materialType === "Material" 
                          ? `${displayLine.grade || ""} ${lengthDisplay}`.trim() || "-"
                          : displayLine.plateGrade || "-"
                        }
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3 text-center text-gray-800 font-medium w-[70px]">
                      {displayLine.materialType === "Material" ? displayLine.qty || 0 : displayLine.plateQty || 0}
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-3 text-right text-gray-800 font-medium w-[100px]">
                      {getTotalWeight(displayLine).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>

                    {/* Hours */}
                    <td className="px-4 py-3 text-right text-gray-800 font-medium w-[80px]">
                      {(displayLine.totalLabor || 0).toFixed(1)}
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold w-[110px]">
                      ${(displayLine.totalCost || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 w-[100px]">
                      <div className="flex items-center gap-1 justify-center">
                        {isManualMode && (
                          <button
                            onClick={() => onEdit(line)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDuplicate(line)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(line.id!)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded Detail Row */}
                  {expandedLineId === line.id && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={8} className="p-0">
                        <div className="border-t border-b border-blue-200 bg-gradient-to-b from-blue-50/50 to-white overflow-x-hidden w-full">
                          <div className="w-full max-w-full">
                            <EstimatingRowDetail
                            line={line}
                            editingId={editingId}
                            editingLine={editingLine}
                            isManualMode={isManualMode}
                            defaultMaterialRate={defaultMaterialRate}
                            defaultLaborRate={defaultLaborRate}
                            defaultCoatingRate={defaultCoatingRate}
                            companySettings={companySettings}
                            projectSettings={projectSettings}
                            lines={allLines}
                            onEdit={onEdit}
                            onSave={onSave}
                            onCancel={onCancel}
                            onChange={onChange}
                            onCollapse={() => setExpandedLineId(null)}
                          />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}

        </tbody>
      </table>
      </div>
    </div>
  );
}

