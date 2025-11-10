"use client";

import { ChevronDown, ChevronRight, Edit, Trash2, Copy, X, Check } from "lucide-react";
import { EstimatingLine } from "./EstimatingGrid";
import EstimatingRowDetail from "./EstimatingRowDetail";
import { getShapesByType } from "@/lib/utils/aiscShapes";

interface EstimatingGridCompactProps {
  lines: EstimatingLine[];
  editingId: string | null;
  editingLine: Partial<EstimatingLine>;
  isManualMode: boolean;
  defaultMaterialRate: number;
  defaultLaborRate: number;
  defaultCoatingRate: number;
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
    materialCost: number;
    laborCost: number;
    coatingCost: number;
    totalCost: number;
  };
  expandedRowId: string | null;
  onExpandedRowChange: (rowId: string | null) => void;
}

export default function EstimatingGridCompact({
  lines,
  editingId,
  editingLine,
  isManualMode,
  defaultMaterialRate,
  defaultLaborRate,
  defaultCoatingRate,
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
  const toggleRow = (lineId: string) => {
    if (expandedRowId === lineId) {
      onExpandedRowChange(null);
    } else {
      onExpandedRowChange(lineId);
    }
  };

  const getSpecDisplay = (line: EstimatingLine) => {
    if (line.materialType === "Rolled") {
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
      if (line.thickness && line.width && line.plateLength) {
        return `${line.thickness}" × ${line.width}" × ${line.plateLength}"`;
      }
      return "-";
    }
    return "-";
  };

  const getTotalWeight = (line: EstimatingLine) => {
    // If this line is being edited, use the calculated values from editingLine
    const isEditing = editingId === line.id;
    const currentLine = isEditing ? { ...line, ...editingLine } : line;
    
    if (currentLine.materialType === "Rolled") {
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
    if (type === "Rolled") {
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
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Item</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Type</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Spec</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Grade</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Qty</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Length</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-blue-50">Material ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-blue-50">Weight (lbs)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-purple-50">Finishes ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-green-50">Labor (hrs)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700 bg-amber-50">Cost ($)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-gray-700">Status</th>
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
              const lengthDisplay = displayLine.materialType === "Rolled"
                ? `${displayLine.lengthFt || 0}'${displayLine.lengthIn ? ` ${displayLine.lengthIn}"` : ""}`
                : displayLine.plateLength
                ? `${displayLine.plateLength}"`
                : "-";

              return (
                <>
                  <tr
                    key={line.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      line.status === "Void" ? "opacity-50" : ""
                    } ${isExpanded ? "bg-blue-50" : ""}`}
                  >
                    {/* Expand/Collapse Button */}
                    <td className="sticky left-0 z-10 bg-white border-r-2 border-gray-300 px-2 py-2">
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
                    <td className="sticky left-12 z-10 bg-white border-r-2 border-gray-300 px-3 py-2 font-medium">
                      {line.lineId || "-"}
                    </td>

                    {/* Item Description - Editable in manual mode */}
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {isManualMode ? (
                        <input
                          type="text"
                          id={line.id ? `field-${line.id}-itemDescription` : undefined}
                          data-field="itemDescription"
                          data-line-id={line.id}
                          value={isEditing ? (editingLine.itemDescription || "") : (line.itemDescription || "")}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("itemDescription", e.target.value, line);
                            // Don't auto-save on every keystroke - only on blur
                          }}
                          onBlur={() => {
                            if (isEditing) {
                              onSave();
                            }
                          }}
                          onKeyDown={(e) => {
                            // Allow normal typing - don't interfere
                            e.stopPropagation();
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Item description"
                        />
                      ) : (
                        line.itemDescription || "-"
                      )}
                    </td>

                    {/* Type - Editable dropdown in manual mode */}
                    <td className="px-4 py-2">
                      {isManualMode ? (
                        <select
                          value={isEditing ? (editingLine.shapeType || "") : (line.shapeType || "")}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("shapeType", e.target.value, line);
                            // Auto-save after selection
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Type...</option>
                          <option value="W">W - Wide Flange</option>
                          <option value="HSS">HSS - Hollow Structural Section</option>
                          <option value="C">C - Channel</option>
                          <option value="L">L - Angle</option>
                          <option value="T">T - Tee</option>
                          <option value="WT">WT - Tee (from W)</option>
                          <option value="S">S - American Standard Beam</option>
                          <option value="M">M - Miscellaneous</option>
                          <option value="MT">MT - Miscellaneous Tee</option>
                          <option value="ST">ST - Structural Tee</option>
                          <option value="PIPE">PIPE - Pipe</option>
                        </select>
                      ) : (
                        line.materialType === "Rolled" && line.shapeType ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                            {line.shapeType === "W" ? "Wide Flange" :
                             line.shapeType === "HSS" ? "HSS" :
                             line.shapeType === "C" ? "Channel" :
                             line.shapeType === "L" ? "Angle" :
                             line.shapeType === "T" ? "Tee" :
                             line.shapeType === "WT" ? "WT" :
                             line.shapeType === "S" ? "Standard Beam" :
                             line.shapeType === "PIPE" ? "Pipe" :
                             line.shapeType}
                          </span>
                        ) : (
                          getTypeBadge(line.materialType)
                        )
                      )}
                    </td>

                    {/* Spec - Editable in manual mode */}
                    <td className="px-4 py-2 text-gray-700">
                      {isManualMode ? (
                        (() => {
                          const currentMaterialType = (isEditing ? editingLine.materialType : line.materialType) || line.materialType;
                          const currentShapeType = isEditing ? editingLine.shapeType : line.shapeType;
                          
                          if (currentMaterialType === "Rolled") {
                            const availableSizes = currentShapeType
                              ? getShapesByType(currentShapeType as any).map((shape) => shape["Member Size"])
                              : [];
                            return (
                              <select
                                value={isEditing ? (editingLine.sizeDesignation || "") : (line.sizeDesignation || "")}
                                onChange={(e) => {
                                  if (!isEditing) {
                                    onEdit(line);
                                  }
                                  // Update sizeDesignation - this will trigger weight recalculation
                                  onChange("sizeDesignation", e.target.value, line);
                                  // Don't save immediately - let the calculation effect run first
                                  setTimeout(() => {
                                    if (isEditing || editingId === line.id) {
                                      onSave();
                                    }
                                  }, 300); // Increased delay to allow calculation to complete
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={!currentShapeType}
                              >
                                <option value="">Select Size...</option>
                                {availableSizes.map((size) => (
                                  <option key={size} value={size}>{size}</option>
                                ))}
                              </select>
                            );
                          } else {
                            return (
                              <div className="flex gap-1 text-xs">
                                <input
                                  type="number"
                                  value={isEditing ? (editingLine.thickness || "") : (line.thickness || "")}
                                  onChange={(e) => {
                                    if (!isEditing) {
                                      onEdit(line);
                                    }
                                    onChange("thickness", parseFloat(e.target.value) || 0, line);
                                  }}
                                  onBlur={() => {
                                    if (isEditing) {
                                      onSave();
                                    }
                                  }}
                                  className="w-16 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="T"
                                  step="0.125"
                                />
                                <span className="self-center">"</span>
                                <input
                                  type="number"
                                  value={isEditing ? (editingLine.width || "") : (line.width || "")}
                                  onChange={(e) => {
                                    if (!isEditing) {
                                      onEdit(line);
                                    }
                                    onChange("width", parseFloat(e.target.value) || 0, line);
                                  }}
                                  onBlur={() => {
                                    if (isEditing) {
                                      onSave();
                                    }
                                  }}
                                  className="w-16 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="W"
                                />
                                <span className="self-center">"</span>
                                <input
                                  type="number"
                                  value={isEditing ? (editingLine.plateLength || "") : (line.plateLength || "")}
                                  onChange={(e) => {
                                    if (!isEditing) {
                                      onEdit(line);
                                    }
                                    onChange("plateLength", parseFloat(e.target.value) || 0, line);
                                  }}
                                  onBlur={() => {
                                    if (isEditing) {
                                      onSave();
                                    }
                                  }}
                                  className="w-16 px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="L"
                                />
                                <span className="self-center">"</span>
                              </div>
                            );
                          }
                        })()
                      ) : (
                        getSpecDisplay(line)
                      )}
                    </td>

                    {/* Grade - Editable in manual mode */}
                    <td className="px-4 py-2 text-gray-700">
                      {isManualMode ? (
                        <select
                          value={isEditing ? (editingLine.materialType === "Rolled" ? (editingLine.grade || "") : (editingLine.plateGrade || "")) : (line.materialType === "Rolled" ? (line.grade || "") : (line.plateGrade || ""))}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            const field = line.materialType === "Rolled" ? "grade" : "plateGrade";
                            onChange(field, e.target.value, line);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Grade...</option>
                          <option value="A36">A36</option>
                          <option value="A572 Gr50">A572 Gr50</option>
                          <option value="A992">A992</option>
                          <option value="A500 GrB">A500 GrB</option>
                          <option value="A500 GrC">A500 GrC</option>
                        </select>
                      ) : (
                        line.materialType === "Rolled" ? line.grade : line.plateGrade || "-"
                      )}
                    </td>

                    {/* Quantity - Editable in manual mode */}
                    <td className="px-4 py-2 text-gray-700">
                      {isManualMode ? (
                        <input
                          type="number"
                          value={isEditing ? (editingLine.materialType === "Rolled" ? (editingLine.qty || "") : (editingLine.plateQty || "")) : (line.materialType === "Rolled" ? (line.qty || "") : (line.plateQty || ""))}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            const field = line.materialType === "Rolled" ? "qty" : "plateQty";
                            onChange(field, parseFloat(e.target.value) || 0, line);
                          }}
                          onBlur={() => {
                            if (isEditing || editingId === line.id) {
                              onSave();
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                          step="1"
                        />
                      ) : (
                        line.materialType === "Rolled" ? line.qty : line.plateQty || "-"
                      )}
                    </td>

                    {/* Length - Editable in manual mode */}
                    <td className="px-4 py-2 text-gray-700">
                      {isManualMode ? (
                        line.materialType === "Rolled" ? (
                          <div className="flex gap-1 items-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={isEditing ? (editingLine.lengthFt !== undefined && editingLine.lengthFt !== null ? String(editingLine.lengthFt) : "") : (line.lengthFt !== undefined && line.lengthFt !== null ? String(line.lengthFt) : "")}
                              onChange={(e) => {
                                if (!isEditing) {
                                  onEdit(line);
                                }
                                // Allow typing, only validate numeric input
                                const inputVal = e.target.value.trim();
                                // Allow empty or valid numbers
                                if (inputVal === "" || /^\d*\.?\d*$/.test(inputVal)) {
                                  const val = inputVal === "" ? 0 : parseFloat(inputVal);
                                  if (!isNaN(val) && val >= 0) {
                                    onChange("lengthFt", val, line);
                                  } else if (inputVal === "") {
                                    onChange("lengthFt", 0, line);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                // Ensure we have a valid number on blur
                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  onChange("lengthFt", Math.floor(val), line); // Round to whole feet
                                } else {
                                  onChange("lengthFt", 0, line);
                                }
                                if (isEditing || editingId === line.id) {
                                  onSave();
                                }
                              }}
                              className="w-16 px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="ft"
                            />
                            <span className="text-xs">'</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={isEditing ? (editingLine.lengthIn !== undefined && editingLine.lengthIn !== null ? String(editingLine.lengthIn) : "") : (line.lengthIn !== undefined && line.lengthIn !== null ? String(line.lengthIn) : "")}
                              onChange={(e) => {
                                if (!isEditing) {
                                  onEdit(line);
                                }
                                // Allow typing, only validate numeric input
                                const inputVal = e.target.value.trim();
                                // Allow empty or valid decimals (for inches like 6.5)
                                if (inputVal === "" || /^\d*\.?\d*$/.test(inputVal)) {
                                  const val = inputVal === "" ? 0 : parseFloat(inputVal);
                                  if (!isNaN(val) && val >= 0) {
                                    // Clamp to 0-11.875 inches
                                    const clampedVal = Math.max(0, Math.min(11.875, val));
                                    onChange("lengthIn", clampedVal, line);
                                  } else if (inputVal === "") {
                                    onChange("lengthIn", 0, line);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                // Ensure we have a valid number on blur, and clamp inches to 0-11.875
                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                if (isNaN(val) || val < 0) {
                                  onChange("lengthIn", 0, line);
                                } else {
                                  const clampedVal = Math.max(0, Math.min(11.875, val));
                                  onChange("lengthIn", clampedVal, line);
                                }
                                if (isEditing || editingId === line.id) {
                                  onSave();
                                }
                              }}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="in"
                            />
                            <span className="text-xs">"</span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            value={isEditing ? (editingLine.plateLength !== undefined ? editingLine.plateLength : "") : (line.plateLength !== undefined ? line.plateLength : "")}
                            onChange={(e) => {
                              if (!isEditing) {
                                onEdit(line);
                              }
                              const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                              onChange("plateLength", val !== undefined && !isNaN(val) ? val : 0, line);
                            }}
                            onBlur={(e) => {
                              // Ensure we have a valid number on blur
                              const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                onChange("plateLength", val, line);
                              }
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="inches"
                            step="0.125"
                            min="0"
                          />
                        )
                      ) : (
                        lengthDisplay
                      )}
                    </td>

                    {/* Material Cost */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-blue-50">
                      ${(displayLine.materialCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-blue-50">
                      {getTotalWeight(displayLine).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>

                    {/* Finishes (Coating Cost) */}
                    <td className="px-4 py-2 text-gray-700 font-medium bg-purple-50">
                      ${(displayLine.coatingCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Labor */}
                    <td className="px-4 py-2 text-gray-700 bg-green-50">
                      {(displayLine.totalLabor || 0).toFixed(2)}
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-2 text-gray-900 font-semibold bg-amber-50">
                      ${(displayLine.totalCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2">{getStatusBadge(line.status)}</td>

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
              <td colSpan={2} className="sticky left-0 z-10 bg-gray-100 border-r-2 border-gray-300 px-3 py-3 text-right">
                TOTALS:
              </td>
              <td colSpan={5} className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-blue-50">
                ${totals.materialCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-blue-50">
                {totals.totalWeight.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-purple-50">
                ${totals.coatingCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-green-50">
                {totals.totalLabor.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium bg-amber-50">
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

