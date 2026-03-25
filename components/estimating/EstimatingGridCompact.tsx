"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Edit, Trash2, Copy, X, Check, Info, Plus } from "lucide-react";
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
  expandedLineId?: string | null;
  onExpandedChange?: (lineId: string | null) => void;
  onAddLine?: () => void;
  isAddLineDisabled?: boolean;
  isManualMode: boolean;
  defaultMaterialRate: number;
  defaultLaborRate: number;
  defaultCoatingRate: number;
  companySettings?: import("@/lib/utils/settingsLoader").CompanySettings | null;
  projectSettings?: import("@/lib/utils/settingsLoader").ProjectSettings | null;
  saveStatus?: { isSaving: boolean; lastSavedAt: Date | null };
  onEdit: (line: EstimatingLine) => void;
  onSave: (immediate?: boolean) => void | Promise<void>;
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
  /** Folded-row manual edits for qty / weight / hours / line total */
  onCompactTotalsChange?: (
    line: EstimatingLine,
    cell: "qty" | "weight" | "hours" | "cost",
    value: number
  ) => void;
}

type CompactTotalsCell = "qty" | "weight" | "hours" | "cost";

function formatCompactDraft(cell: CompactTotalsCell, value: number): string {
  if (!Number.isFinite(value)) return "";
  if (cell === "hours") return value.toFixed(1);
  if (cell === "cost") return String(Math.round(value));
  return String(Math.round(value));
}

/** Minimum width (in ch) so short values don’t look cramped */
const MIN_INPUT_CH: Record<CompactTotalsCell, number> = {
  // Qty must match other columns — 2.5ch was too narrow for single digits + padding in tables
  qty: 4,
  weight: 4,
  hours: 4,
  cost: 5,
};

/** Floor in rem so `ch` can’t collapse too small in table/flex layouts (esp. Qty). */
const MIN_INPUT_REM: Record<CompactTotalsCell, number> = {
  qty: 3.5,
  weight: 3.5,
  hours: 3.5,
  cost: 3.75,
};

/** Hard px floor — some browsers/tables ignore `ch` for `type="number"` and collapse. */
const MIN_INPUT_PX: Record<CompactTotalsCell, number> = {
  qty: 64,
  weight: 64,
  hours: 72,
  cost: 80,
};

/** Width scales with typed characters; `max(rem, ch, px)` keeps a readable minimum. */
function inputWidthStyle(cell: CompactTotalsCell, draft: string): React.CSSProperties {
  const len = draft.trim().length || 1;
  const wCh = Math.max(MIN_INPUT_CH[cell], len + 1.75);
  const px = MIN_INPUT_PX[cell];
  const rem = MIN_INPUT_REM[cell];
  return {
    width: `max(${rem}rem, ${wCh}ch, ${px}px)`,
    minWidth: `max(${rem}rem, ${px}px)`,
  };
}

/** Inline number editor for folded grid cells (manual mode) */
function FoldedTotalsInput({
  line,
  displayLine,
  cell,
  onEdit,
  onCompactTotalsChange,
  onSave,
  className,
}: {
  line: EstimatingLine;
  displayLine: EstimatingLine;
  cell: CompactTotalsCell;
  onEdit: (line: EstimatingLine) => void;
  onCompactTotalsChange: (
    line: EstimatingLine,
    cell: CompactTotalsCell,
    value: number
  ) => void;
  onSave: (immediate?: boolean) => void | Promise<void>;
  className: string;
}) {
  const getNum = (): number => {
    switch (cell) {
      case "qty":
        return displayLine.materialType === "Material"
          ? displayLine.qty ?? 0
          : displayLine.plateQty ?? 0;
      case "weight":
        return displayLine.materialType === "Material"
          ? displayLine.totalWeight ?? 0
          : displayLine.plateTotalWeight ?? 0;
      case "hours":
        return displayLine.totalLabor ?? 0;
      case "cost":
        return displayLine.totalCost ?? 0;
    }
  };

  const [focused, setFocused] = useState(false);
  const displayNum = getNum();
  const [draft, setDraft] = useState(() =>
    formatCompactDraft(cell, displayNum)
  );

  useEffect(() => {
    if (!focused) {
      setDraft(formatCompactDraft(cell, displayNum));
    }
  }, [cell, displayNum, focused, line.id]);

  const parse = (raw: string): number => {
    const n = parseFloat(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const commit = () => {
    const v = parse(draft);
    onCompactTotalsChange(line, cell, v);
    setTimeout(() => {
      void onSave(true);
    }, 450);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={cell === "hours" ? 0.1 : cell === "cost" ? 1 : 1}
      title={
        cell === "cost"
          ? "Line total (includes overhead & profit)"
          : undefined
      }
      style={inputWidthStyle(cell, draft)}
      className={`box-border shrink-0 max-w-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
      value={draft}
      onFocus={() => {
        onEdit(line);
        setFocused(true);
        setDraft(formatCompactDraft(cell, displayNum));
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
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

  // Get all grades for the tooltip (includes shape-specific grades)
  const allMaterialGrades = [
    "A36", "A572 Grade 50", "A992", "A913 Grade 65", "A913 Grade 70",
    "A500 Grade B", "A500 Grade C", "A1085", "A53 Type E", "A53 Type S",
    "A252 Grade 1", "A252 Grade 2", "A252 Grade 3", "Stainless 304", "Stainless 316"
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
  expandedLineId: expandedLineIdProp,
  onExpandedChange,
  onAddLine,
  isAddLineDisabled = false,
  isManualMode,
  defaultMaterialRate,
  defaultLaborRate,
  defaultCoatingRate,
  companySettings,
  projectSettings,
  saveStatus,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  onChange,
  onCompactTotalsChange,
  totals,
  sortBy,
  sortDirection,
  onSortChange,
}: EstimatingGridCompactProps) {
  // State for filterable size dropdowns (per row)
  const [sizeFilters, setSizeFilters] = useState<Record<string, string>>({});
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState<Record<string, boolean>>({});
  const sizeDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // State for expanded row detail view (use parent-controlled if provided)
  const [expandedLineIdLocal, setExpandedLineIdLocal] = useState<string | null>(null);
  const expandedLineId = expandedLineIdProp ?? expandedLineIdLocal;
  const setExpandedLineId = onExpandedChange ?? setExpandedLineIdLocal;

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
      const itemDesc = (line.itemDescription || "").trim();

      if (sizeDesignation && shapeType) {
        const sizeUpper = sizeDesignation.toUpperCase();
        const shapeUpper = shapeType.toUpperCase();
        if (sizeUpper.startsWith(shapeUpper)) {
          return sizeDesignation;
        }
      }
      const sizePart = `${shapeType} ${sizeDesignation}`.trim();
      if (sizePart) return sizePart;
      if (itemDesc) return itemDesc;
      if (shapeType) return shapeType;
      return "-";
    } else if (line.materialType === "Plate") {
      const thicknessLabel = getPlateThicknessDisplay(line.thickness);
      const itemDesc = (line.itemDescription || "").trim();
      const parts: string[] = [];
      if (thicknessLabel) {
        const dims = [thicknessLabel + '"', line.width ? `${line.width}"` : null, line.plateLength ? `${line.plateLength}"` : null]
          .filter(Boolean)
          .join(" × ");
        if (dims) parts.push(dims);
      }
      if (line.plateGrade) parts.push(line.plateGrade);
      if (parts.length) return parts.join(" ");
      if (itemDesc) return itemDesc;
      return "-";
    }
    return "-";
  };

  /** Folded grid primary column: category + subcategory (what user asked to see in summary). */
  const getCategorySubcategoryDisplay = (line: EstimatingLine): string => {
    const cat = (line.category || "").trim();
    const sub = (line.subCategory || "").trim();
    if (cat && sub) return `${cat} · ${sub}`;
    if (cat) return cat;
    if (sub) return sub;
    return "—";
  };

  /** Drawing sheet + detail callout — primary identification in folded grid */
  const getDrawingDetailLabel = (line: EstimatingLine): string | null => {
    const dwg = (line.drawingNumber || "").trim();
    const det = (line.detailNumber || "").trim();
    if (!dwg && !det) return null;
    const parts: string[] = [];
    if (dwg) parts.push(`DWG ${dwg}`);
    if (det) parts.push(`Detail ${det}`);
    return parts.join(" · ");
  };

  const getElevationLabel = (line: EstimatingLine): string | null => {
    const el = (line.elevation || "").trim();
    return el ? `Elev. ${el}` : null;
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

  /** Grade, length, coating — size/spec on separate “Spec” line above */
  const getSpecMetaBadges = (line: EstimatingLine, lengthDisplay: string, specDetailLine: string) => {
    const coating = line.coatingSystem && line.coatingSystem !== "None" ? line.coatingSystem : "";
    const coatingClass = coating.includes("Galv")
      ? "bg-amber-100 text-amber-800 border border-amber-200/60"
      : coating
        ? "bg-slate-100 text-slate-700 border border-slate-200/60"
        : "";
    const badges: { label: string; classes: string }[] = [];

    if (line.materialType === "Material") {
      const gradeAndLength = [line.grade, lengthDisplay].filter(Boolean);
      if (gradeAndLength.length) {
        badges.push({
          label: gradeAndLength.join(" "),
          classes: "bg-blue-100 text-blue-800 border border-blue-200/60",
        });
      }
    } else if (line.materialType === "Plate" && line.plateGrade) {
      badges.push({
        label: line.plateGrade,
        classes: "bg-blue-100 text-blue-800 border border-blue-200/60",
      });
    }

    if (coating) {
      badges.push({ label: coating, classes: coatingClass });
    }

    const itemDesc = (line.itemDescription || "").trim();
    if (itemDesc && specDetailLine === "-" && !/^structural$/i.test(itemDesc)) {
      badges.push({
        label: itemDesc,
        classes: "bg-slate-100 text-slate-700 border border-slate-200/60",
      });
    }

    if (badges.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {badges.map((b, i) => (
          <span
            key={i}
            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-lg ${b.classes}`}
          >
            {b.label}
          </span>
        ))}
      </div>
    );
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
            <th
              className="px-4 py-3 text-left font-semibold text-xs text-gray-700 uppercase tracking-wider flex-1 min-w-[220px]"
              title="Category and subcategory; drawing, detail, size/spec below"
            >
              Category
            </th>
            <th className="px-4 py-3 text-center font-semibold text-xs text-gray-700 uppercase tracking-wider min-w-[4.5rem] whitespace-nowrap">
              Qty
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-gray-700 uppercase tracking-wider min-w-[5.5rem] whitespace-nowrap">
              Weight
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-gray-700 uppercase tracking-wider min-w-[5rem] whitespace-nowrap">
              Hours
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-gray-700 uppercase tracking-wider min-w-[6rem] whitespace-nowrap">
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
              <td colSpan={8} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                  <p className="text-gray-600 font-medium">No estimate lines yet.</p>
                  <p className="text-gray-500 text-sm">
                    Add your first line to start the structural steel takeoff. You can enter rolled shapes (W, HSS, L, etc.), plates, labor, and costs. Use the Add Line button or import from CSV.
                  </p>
                  {onAddLine && (
                    <button
                      type="button"
                      onClick={onAddLine}
                      disabled={isAddLineDisabled}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                      title={isAddLineDisabled ? "Adding…" : "Add your first estimate line"}
                    >
                      <Plus className="w-5 h-5" />
                      {isAddLineDisabled ? "Adding…" : "Add Your First Line →"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            lines.map((line) => {
              const isEditing = editingId === line.id;
              // Merge editingLine with line for display when editing
              const displayLine = isEditing ? { ...line, ...editingLine } : line;
              const hasLength = displayLine.materialType === "Material" && ((displayLine.lengthFt ?? 0) > 0 || (displayLine.lengthIn ?? 0) > 0);
              const lengthDisplay = hasLength
                ? `${displayLine.lengthFt ?? 0}'${displayLine.lengthIn ? ` ${displayLine.lengthIn}"` : ""}`
                : "";

              const categoryLine = getCategorySubcategoryDisplay(displayLine);
              const specDetailLine = getSpecDisplay(displayLine);
              const dwgLabel = getDrawingDetailLabel(displayLine);
              const elevLabel = getElevationLabel(displayLine);
              const parentMain =
                displayLine.parentLineId && allLines?.length
                  ? allLines.find((l) => l.lineId === displayLine.parentLineId)
                  : undefined;
              const parentGroupLabel =
                parentMain?.lineId && displayLine.parentLineId
                  ? `With ${parentMain.lineId}`
                  : null;

              const foldedTotalsEditable =
                isManualMode &&
                !!onCompactTotalsChange &&
                expandedLineId !== line.id;

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
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors text-left group cursor-pointer"
                        title="Click to expand details"
                        type="button"
                      >
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-blue-50/80 border border-blue-200/60 text-blue-800 font-bold text-sm group-hover:bg-blue-100/90 group-hover:border-blue-300/70 transition-colors">
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

                    {/* Category + subcategory (primary); drawing/detail; then size/spec (engineering) */}
                    <td className="px-4 py-3 min-w-[220px] max-w-[28rem] align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="inline-flex w-max max-w-full items-center px-3 py-1.5 bg-indigo-50/90 border border-indigo-200/70 rounded-lg font-semibold text-indigo-950 text-sm">
                          {categoryLine}
                        </div>
                        {displayLine.workType === "MISC" && (displayLine.miscSubtype || "").trim() && (
                          <div className="text-[11px] font-medium text-slate-700">
                            {(displayLine.miscSubtype || "").trim()}
                          </div>
                        )}
                        {(dwgLabel || elevLabel || parentGroupLabel) && (
                          <div className="flex flex-col gap-0.5 text-left">
                            {dwgLabel && (
                              <div className="text-[11px] font-semibold text-slate-800 tabular-nums leading-snug">
                                {dwgLabel}
                              </div>
                            )}
                            {elevLabel && (
                              <div className="text-[10px] font-medium text-slate-500 leading-snug">
                                {elevLabel}
                              </div>
                            )}
                            {parentGroupLabel && (
                              <div className="text-[10px] font-medium text-violet-700 leading-snug">
                                {parentGroupLabel}
                              </div>
                            )}
                          </div>
                        )}
                        {specDetailLine !== "-" && (
                          <div className="text-[11px] text-slate-700 leading-snug">
                            <span className="font-semibold text-slate-500">Spec:</span>{" "}
                            <span className="tabular-nums">{specDetailLine}</span>
                          </div>
                        )}
                        {getSpecMetaBadges(displayLine, lengthDisplay, specDetailLine)}
                      </div>
                    </td>

                    {/* Quantity — min width + px floor on input so cells don’t collapse */}
                    <td className="px-4 py-3 text-center min-w-[4.5rem] align-middle whitespace-nowrap">
                      {foldedTotalsEditable ? (
                        <div className="flex justify-center min-w-[4rem]">
                          <FoldedTotalsInput
                          line={line}
                          displayLine={displayLine}
                          cell="qty"
                          onEdit={onEdit}
                          onCompactTotalsChange={onCompactTotalsChange}
                          onSave={onSave}
                          className="inline-block px-2 py-0.5 bg-slate-100/80 border border-slate-200/60 rounded-lg text-gray-800 font-semibold text-sm text-center tabular-nums"
                        />
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-slate-100/80 border border-slate-200/60 rounded-lg text-gray-800 font-semibold text-sm">
                          {displayLine.materialType === "Material" ? displayLine.qty || 0 : displayLine.plateQty || 0}
                        </span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-3 text-right min-w-[5.5rem] align-middle">
                      {foldedTotalsEditable ? (
                        <div className="flex justify-end">
                          <FoldedTotalsInput
                          line={line}
                          displayLine={displayLine}
                          cell="weight"
                          onEdit={onEdit}
                          onCompactTotalsChange={onCompactTotalsChange}
                          onSave={onSave}
                          className="inline-block px-2 py-0.5 bg-slate-100/80 border border-slate-200/60 rounded-lg text-gray-800 font-semibold text-sm text-right tabular-nums"
                        />
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-end min-w-[3rem] px-2 py-0.5 bg-slate-100/80 border border-slate-200/60 rounded-lg text-gray-800 font-semibold text-sm tabular-nums">
                          {getTotalWeight(displayLine).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </td>

                    {/* Hours */}
                    <td className="px-4 py-3 text-right min-w-[5rem] align-middle">
                      {foldedTotalsEditable ? (
                        <div className="flex justify-end">
                          <FoldedTotalsInput
                          line={line}
                          displayLine={displayLine}
                          cell="hours"
                          onEdit={onEdit}
                          onCompactTotalsChange={onCompactTotalsChange}
                          onSave={onSave}
                          className="inline-block px-2 py-0.5 bg-amber-50/90 border border-amber-200/50 rounded-lg text-amber-900 font-semibold text-sm text-right tabular-nums"
                        />
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-end min-w-[2.5rem] px-2 py-0.5 bg-amber-50/90 border border-amber-200/50 rounded-lg text-amber-900 font-semibold text-sm tabular-nums">
                          {(displayLine.totalLabor || 0).toFixed(1)}
                        </span>
                      )}
                    </td>

                    {/* Cost (line total w/ markup) */}
                    <td className="px-4 py-3 text-right min-w-[6rem] align-middle">
                      {foldedTotalsEditable ? (
                        <div className="flex justify-end items-center gap-0.5">
                          <span className="shrink-0 text-emerald-800 font-bold text-sm">$</span>
                          <FoldedTotalsInput
                            line={line}
                            displayLine={displayLine}
                            cell="cost"
                            onEdit={onEdit}
                            onCompactTotalsChange={onCompactTotalsChange}
                            onSave={onSave}
                            className="inline-block px-2 py-0.5 bg-emerald-50/90 border border-emerald-200/50 rounded-lg text-emerald-900 font-bold text-sm text-right tabular-nums"
                          />
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-end min-w-[3.5rem] px-2 py-0.5 bg-emerald-50/90 border border-emerald-200/50 rounded-lg text-emerald-900 font-bold text-sm tabular-nums">
                          ${(displayLine.totalCost || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      )}
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
                            saveStatus={saveStatus}
                            lines={allLines}
                            onEdit={onEdit}
                            onSave={onSave}
                            onCancel={onCancel}
                            onChange={onChange}
                            onAddLine={onAddLine}
                            isAddLineDisabled={isAddLineDisabled}
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

