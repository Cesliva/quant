"use client";

import { ChevronDown, ChevronRight, Edit, Trash2, Copy, X, Check, Info } from "lucide-react";
import { EstimatingLine } from "./EstimatingGrid";
import EstimatingRowDetail from "./EstimatingRowDetail";
import { getShapesByType, SHAPE_TYPES } from "@/lib/utils/aiscShapes";
import { useState, useRef, useEffect } from "react";
import { getMaterialGradeInfo, getPlateGradeInfo } from "@/lib/utils/steelGradeInfo";
import {
  getAvailableThicknesses,
  getThicknessLabelFromInches,
  convertThicknessInputToInches,
} from "@/lib/utils/plateDatabase";

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
  expandedRowId: string | null;
  onExpandedRowChange: (rowId: string | null) => void;
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
          style={{ maxHeight: "400px", overflowY: "auto" }}
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
  expandedRowId,
  onExpandedRowChange,
}: EstimatingGridCompactProps) {
  // State for filterable size dropdowns (per row)
  const [sizeFilters, setSizeFilters] = useState<Record<string, string>>({});
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState<Record<string, boolean>>({});
  const sizeDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const toggleRow = (lineId: string) => {
    if (expandedRowId === lineId) {
      onExpandedRowChange(null);
    } else {
      onExpandedRowChange(lineId);
    }
  };

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

  const getStatusBadge = (status?: string) => {
    if (status === "Void") {
      return <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Void</span>;
    }
    return <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">Active</span>;
  };

  const getTypeBadge = (type?: string) => {
    if (type === "Material") {
      return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Material</span>;
    } else if (type === "Plate") {
      return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">Plate</span>;
    }
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded">-</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 border-b-2 border-gray-300">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 border-r-2 border-gray-300 px-3 py-3 text-left font-semibold text-xs uppercase">
              <span className="w-4 inline-block"></span>
            </th>
            <th className="sticky left-12 z-10 bg-gray-50 border-r-2 border-gray-300 px-3 py-3 text-left font-semibold text-xs uppercase">
              Line ID
            </th>
            <th className="sticky left-24 z-10 bg-gray-50 border-r-2 border-gray-300 px-3 py-3 text-left font-semibold text-xs uppercase">
              Drawing #
            </th>
            <th className="sticky left-40 z-10 bg-gray-50 border-r-2 border-gray-300 px-3 py-3 text-left font-semibold text-xs uppercase">
              Detail #
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">Item</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">Type</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">Spec</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">
              <div className="flex items-center gap-1">
                Grade
                <GradeInfoTooltip materialType={null} />
              </div>
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">Qty</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">Length</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-blue-50 border-r border-gray-200">Material ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-blue-50 border-r border-gray-200">Weight (lbs)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-purple-50 border-r border-gray-200">Finishes ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-orange-50 border-r border-gray-200">Hardware ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-green-50 border-r border-gray-200">Labor (hrs)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-amber-50 border-r border-gray-200">Cost ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 border-r border-gray-200">Status</th>
            <th className="sticky right-0 z-10 bg-gray-50 border-l-2 border-gray-300 px-3 py-3 text-center font-semibold text-xs uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                No lines yet. Click &quot;Add Line&quot; to get started.
              </td>
            </tr>
          ) : (
            lines.map((line) => {
              const isExpanded = expandedRowId === line.id;
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
                <>
                  <tr
                    id={`line-${line.id}`}
                    key={line.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      line.status === "Void" ? "opacity-50" : ""
                    } ${isExpanded ? "bg-blue-50" : ""} ${
                      isSmallPart ? "bg-blue-50/30" : ""
                    }`}
                  >
                    {/* Expand/Collapse Button */}
                    <td className={`sticky left-0 z-10 border-r-2 border-gray-300 px-2 py-2 ${
                      isSmallPart ? "bg-blue-50/30" : "bg-white"
                    }`}>
                      <button
                        onClick={() => toggleRow(line.id || "")}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </td>

                    {/* Line ID */}
                    <td className={`sticky left-12 z-10 border-r-2 border-gray-300 px-3 py-2 font-medium ${
                      isSmallPart ? "bg-blue-50/30" : "bg-white"
                    }`}>
                      {isSmallPart && (
                        <span className="text-blue-600 mr-2">└─</span>
                      )}
                      {line.lineId || "-"}
                    </td>

                    {/* Drawing Number */}
                    <td className={`sticky left-24 z-10 border-r-2 border-gray-300 px-3 py-2 text-gray-700 ${
                      isSmallPart ? "bg-blue-50/30" : "bg-white"
                    }`}>
                      {line.drawingNumber || "-"}
                    </td>

                    {/* Detail Number */}
                    <td className={`sticky left-40 z-10 border-r-2 border-gray-300 px-3 py-2 text-gray-700 ${
                      isSmallPart ? "bg-blue-50/30" : "bg-white"
                    }`}>
                      {line.detailNumber || "-"}
                    </td>

                    {/* Item Description */}
                    <td className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200">
                      {isEditing ? (
                        <input
                          type="text"
                          value={displayLine.itemDescription || ""}
                          onChange={(e) => onChange("itemDescription", e.target.value, line)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Item description"
                        />
                      ) : (
                        displayLine.itemDescription || "-"
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-2 border-r border-gray-200">
                      {isEditing ? (
                        <div className="flex gap-1 items-center">
                          <select
                            value={displayLine.materialType || "Material"}
                            onChange={(e) => onChange("materialType", e.target.value, line)}
                            className="w-20 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Material">Material</option>
                            <option value="Plate">Plate</option>
                          </select>
                          {displayLine.materialType === "Material" && (
                            <select
                              value={displayLine.shapeType || ""}
                              onChange={(e) => onChange("shapeType", e.target.value, line)}
                              className="flex-1 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select type...</option>
                              {SHAPE_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        displayLine.materialType === "Material" && displayLine.shapeType ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                            {displayLine.shapeType}
                          </span>
                        ) : (
                          getTypeBadge(displayLine.materialType)
                        )
                      )}
                    </td>

                    {/* Spec */}
                    <td className="px-4 py-2 text-gray-700 border-r border-gray-200">
                      {isEditing ? (
                        displayLine.materialType === "Material" ? (
                          <input
                            type="text"
                            value={displayLine.sizeDesignation || ""}
                            onChange={(e) => onChange("sizeDesignation", e.target.value, line)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Size (e.g., W12x26)"
                          />
                        ) : (
                          <div className="flex gap-1 text-xs">
                            <input
                              type="text"
                              value={displayLine.thickness ? getThicknessLabelFromInches(displayLine.thickness) || displayLine.thickness : ""}
                              onChange={(e) => {
                                const inches = convertThicknessInputToInches(e.target.value);
                                onChange("thickness", inches, line);
                              }}
                              className="w-16 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Thick"
                            />
                            <input
                              type="number"
                              value={displayLine.width || ""}
                              onChange={(e) => onChange("width", parseFloat(e.target.value) || 0, line)}
                              className="w-16 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Width"
                              step="0.01"
                            />
                            <input
                              type="number"
                              value={displayLine.plateLength || ""}
                              onChange={(e) => onChange("plateLength", parseFloat(e.target.value) || 0, line)}
                              className="w-16 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Length"
                              step="0.01"
                            />
                          </div>
                        )
                      ) : (
                        getSpecDisplay(displayLine)
                      )}
                    </td>

                    {/* Grade */}
                    <td className="px-4 py-2 text-gray-700 border-r border-gray-200">
                      {isEditing ? (
                        <select
                          value={displayLine.materialType === "Material" ? (displayLine.grade || "") : (displayLine.plateGrade || "")}
                          onChange={(e) => {
                            if (displayLine.materialType === "Material") {
                              onChange("grade", e.target.value, line);
                            } else {
                              onChange("plateGrade", e.target.value, line);
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select grade...</option>
                          {(displayLine.materialType === "Material" 
                            ? ["A992", "A913 Grade 65", "A913 Grade 70", "A500 Grade B", "A500 Grade C", "A1085", "A53 Type E", "A53 Type S", "A252 Grade 1", "A252 Grade 2", "A252 Grade 3", "Stainless 304", "Stainless 316"]
                            : ["A36", "A572 Grade 50", "A572 Grade 42", "A588 (Weathering)", "A514 (T-1)", "A516 Grade 70", "A529 Grade 50"]
                          ).map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      ) : (
                        displayLine.materialType === "Material" ? displayLine.grade : displayLine.plateGrade || "-"
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-2 text-gray-700 border-r border-gray-200">
                      {isEditing ? (
                        <input
                          type="number"
                          value={displayLine.materialType === "Material" ? (displayLine.qty || "") : (displayLine.plateQty || "")}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (displayLine.materialType === "Material") {
                              onChange("qty", val, line);
                            } else {
                              onChange("plateQty", val, line);
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      ) : (
                        displayLine.materialType === "Material" ? displayLine.qty : displayLine.plateQty || "-"
                      )}
                    </td>

                    {/* Length */}
                    <td className="px-4 py-2 text-gray-700 border-r border-gray-200">
                      {isEditing && displayLine.materialType === "Material" ? (
                        <div className="flex gap-1 items-center text-xs">
                          <input
                            type="number"
                            value={displayLine.lengthFt || ""}
                            onChange={(e) => onChange("lengthFt", parseFloat(e.target.value) || 0, line)}
                            className="w-12 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ft"
                            min="0"
                            step="1"
                          />
                          <span className="text-gray-500">'</span>
                          <input
                            type="number"
                            value={displayLine.lengthIn || ""}
                            onChange={(e) => onChange("lengthIn", parseFloat(e.target.value) || 0, line)}
                            className="w-12 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="in"
                            min="0"
                            max="11"
                            step="0.125"
                          />
                          <span className="text-gray-500">"</span>
                        </div>
                      ) : (
                        lengthDisplay
                      )}
                    </td>

                    {/* Material Cost */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-blue-50 border-r border-gray-200">
                      ${(displayLine.materialCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-blue-50 border-r border-gray-200">
                      {getTotalWeight(displayLine).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>

                    {/* Finishes (Coating Cost) */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-purple-50 border-r border-gray-200">
                      ${(displayLine.coatingCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Hardware Cost */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-orange-50 border-r border-gray-200">
                      ${hardwareCostDisplay.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Labor */}
                    <td className="px-4 py-2 text-gray-700 bg-green-50 border-r border-gray-200">
                      {(displayLine.totalLabor || 0).toFixed(2)}
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-2 text-gray-900 font-semibold bg-amber-50 border-r border-gray-200">
                      ${(displayLine.totalCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2 border-r border-gray-200">{getStatusBadge(line.status)}</td>

                    {/* Actions */}
                    <td className="sticky right-0 z-10 bg-white border-l-2 border-gray-300 px-3 py-2">
                      <div className="flex items-center gap-1 justify-center">
                        {isEditing ? (
                          <>
                            <button
                              onClick={onSave}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={onCancel}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {isManualMode && (
                              <button
                                onClick={() => onEdit(line)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => onDuplicate(line)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Duplicate"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(line.id!)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <tr key={`${line.id}-detail`}>
                      <td colSpan={14} className="px-0 py-0 bg-gray-50 border-b-2 border-gray-300">
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
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}

          {/* Totals Row */}
          {lines.length > 0 && (
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              <td colSpan={4} className="sticky left-0 z-10 bg-gray-100 border-r-2 border-gray-300 px-3 py-3 text-right">
                TOTALS:
              </td>
              <td colSpan={4} className="px-4 py-3 border-r border-gray-200"></td>
              <td className="px-4 py-3 text-gray-900 font-medium border-r border-gray-200">
                {(totals.totalQuantity || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-3 border-r border-gray-200"></td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-blue-50 border-r border-gray-200">
                ${totals.materialCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-blue-50 border-r border-gray-200">
                {totals.totalWeight.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-purple-50 border-r border-gray-200">
                ${totals.coatingCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-orange-50 border-r border-gray-200">
                ${totals.hardwareCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-green-50 border-r border-gray-200">
                {totals.totalLabor.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-amber-50 border-r border-gray-200">
                ${totals.totalCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
              <td colSpan={2} className="px-4 py-3"></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

