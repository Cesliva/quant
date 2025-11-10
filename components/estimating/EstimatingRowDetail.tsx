"use client";

import { useState } from "react";
import { EstimatingLine } from "./EstimatingGrid";
import { SHAPE_TYPES, getShapesByType, getValidGrades } from "@/lib/utils/aiscShapes";
import { getAvailableThicknesses, getValidPlateGrades } from "@/lib/utils/plateDatabase";
import LaborInput from "./LaborInput";
import { Info } from "lucide-react";
import { getNumberFromField } from "@/lib/utils/fieldNumberMap";

interface EstimatingRowDetailProps {
  line: EstimatingLine;
  editingId: string | null;
  editingLine: Partial<EstimatingLine>;
  isManualMode: boolean;
  defaultMaterialRate: number;
  defaultLaborRate: number;
  defaultCoatingRate: number;
  onEdit: (line: EstimatingLine) => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (field: keyof EstimatingLine, value: any, line?: EstimatingLine) => void;
}

export default function EstimatingRowDetail({
  line,
  editingId,
  editingLine,
  isManualMode,
  defaultMaterialRate,
  defaultLaborRate,
  defaultCoatingRate,
  onEdit,
  onSave,
  onCancel,
  onChange,
}: EstimatingRowDetailProps) {
  const isEditing = editingId === line.id;
  // Merge editingLine with line to get complete data when editing
  const currentLine = isEditing ? { ...line, ...editingLine } : line;
  const materialType = currentLine.materialType || "Rolled";

  const categories = ["Columns", "Beams", "Misc Metals", "Plates", "Connections", "Other"];
  const subCategories = ["Base Plate", "Gusset", "Stiffener", "Clip", "Brace", "Other"];
  const coatingSystems = [
    "None",
    "Standard Shop Primer",
    "Zinc Primer",
    "Paint",
    "Powder Coat",
    "Galvanizing",
    "Specialty Coating"
  ];

  const availableSizes = currentLine.shapeType
    ? getShapesByType(currentLine.shapeType).map((shape) => shape["Member Size"])
    : [];

  const availableGrades = materialType === "Rolled" && currentLine.shapeType
    ? getValidGrades(currentLine.shapeType)
    : materialType === "Plate" && currentLine.thickness
    ? getValidPlateGrades(currentLine.thickness)
    : ["A36"];

  const plateThicknesses = getAvailableThicknesses();

  const renderField = (
    label: string,
    field: keyof EstimatingLine,
    type: "text" | "number" | "select" | "textarea" | "checkbox" = "text",
    options?: string[],
    isReadOnly = false
  ) => {
    const value = currentLine[field];
    // In manual mode, all fields are editable by default (no need to click edit)
    // In voice mode, everything is read-only
    const canEdit = isManualMode && !isReadOnly;

    if (!canEdit) {
      // Display mode
      if (type === "checkbox") {
        return <span className="text-gray-700">{value ? "✓" : "-"}</span>;
      }
      if (type === "number") {
        return (
          <span className="text-gray-700">
            {typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}
          </span>
        );
      }
      return <span className="text-gray-700">{value?.toString() || "-"}</span>;
    }

    // Edit mode - Add IDs and data attributes for keyboard shortcuts
    const fieldId = line.id ? `field-${line.id}-${field}` : undefined;
    const fieldDataAttrs = {
      "data-field": field,
      "data-line-id": line.id || "",
    };

    if (type === "select" && options) {
      return (
        <select
          id={fieldId}
          {...fieldDataAttrs}
          value={value as string || ""}
          onChange={(e) => {
            onChange(field, e.target.value, line);
            // Auto-save on change for select fields (debounced)
            if (isEditing) {
              // Save immediately for selects since they're discrete choices
              onSave();
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          id={fieldId}
          {...fieldDataAttrs}
          value={value as string || ""}
          onChange={(e) => onChange(field, e.target.value, line)}
          onBlur={() => {
            if (isEditing) {
              onSave();
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
        />
      );
    }

    if (type === "checkbox") {
      return (
        <input
          id={fieldId}
          {...fieldDataAttrs}
          type="checkbox"
          checked={value as boolean || false}
          onChange={(e) => {
            onChange(field, e.target.checked, line);
            if (isEditing) {
              // Save immediately for checkboxes
              onSave();
            }
          }}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
      );
    }

    return (
      <input
        id={fieldId}
        {...fieldDataAttrs}
        type={type}
        value={typeof value === "number" ? (value || 0) : (value as string || "")}
        onChange={(e) => {
          const newValue = type === "number" 
            ? (e.target.value === "" ? undefined : parseFloat(e.target.value))
            : e.target.value;
          onChange(field, newValue !== undefined ? newValue : (type === "number" ? 0 : ""), line);
        }}
        onBlur={() => {
          if (isEditing && !isReadOnly) {
            // Immediate save on blur
            onSave();
          }
        }}
        step={type === "number" ? "any" : undefined}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        readOnly={isReadOnly}
      />
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Edit Mode Controls */}
      {isEditing && (
        <div className="flex items-center justify-between pb-4 border-b border-gray-300">
          <h3 className="text-lg font-semibold text-gray-900">Editing Line {line.lineId}</h3>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identification Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Identification</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("drawingNumber")}.</span> Drawing #
              </label>
              {renderField("Drawing #", "drawingNumber", "text")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("detailNumber")}.</span> Detail #
              </label>
              {renderField("Detail #", "detailNumber", "text")}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("itemDescription")}.</span> Item Description
              </label>
              {renderField("Item", "itemDescription", "text")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("category")}.</span> Category
              </label>
              {renderField("Category", "category", "select", categories)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("subCategory")}.</span> Sub-Category
              </label>
              {renderField("Sub-Category", "subCategory", "select", subCategories)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("materialType")}.</span> Material Type
              </label>
              {isEditing ? (
                <select
                  value={editingLine.materialType || "Rolled"}
                  onChange={(e) => {
                    onChange("materialType", e.target.value, line);
                    if (isEditing) {
                      setTimeout(() => onSave(), 100);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Rolled">Material</option>
                  <option value="Plate">Plate</option>
                </select>
              ) : (
                <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                  {currentLine.materialType === "Plate" ? "Plate" : "Material"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Material Section - Rolled */}
        {materialType === "Rolled" && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Material</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("shapeType")}.</span> Shape Type
                </label>
                {renderField("Shape", "shapeType", "select", SHAPE_TYPES as string[])}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("sizeDesignation")}.</span> Size
                </label>
                {renderField("Size", "sizeDesignation", "select", availableSizes)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("grade")}.</span> Grade
                </label>
                {renderField("Grade", "grade", "select", availableGrades)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("qty")}.</span> Quantity
                </label>
                {renderField("Qty", "qty", "number")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("lengthFt")}.</span> Length (ft)
                </label>
                {renderField("Length (ft)", "lengthFt", "number")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("lengthIn")}.</span> Length (in)
                </label>
                {renderField("Length (in)", "lengthIn", "number")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Weight per Foot</label>
                {renderField("W/ft", "weightPerFoot", "number", undefined, true)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Weight</label>
                {renderField("Total W", "totalWeight", "number", undefined, true)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SA per Foot</label>
                {renderField("SA/ft", "surfaceAreaPerFoot", "number", undefined, true)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total SA</label>
                {renderField("Total SA", "totalSurfaceArea", "number", undefined, true)}
              </div>
            </div>
          </div>
        )}

        {/* Material Section - Plate */}
        {materialType === "Plate" && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Plate Material</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("thickness")}.</span> Thickness (in)
                </label>
                {renderField("Thickness", "thickness", "select", plateThicknesses.map(t => t.toString()))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("width")}.</span> Width (in)
                </label>
                {renderField("Width", "width", "number")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("plateLength")}.</span> Length (in)
                </label>
                {renderField("Length", "plateLength", "number")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("plateQty")}.</span> Quantity
                </label>
                {renderField("Qty", "plateQty", "number")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("plateGrade")}.</span> Grade
                </label>
                {renderField("Grade", "plateGrade", "select", availableGrades)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("oneSideCoat")}.</span> One Side Coat
                </label>
                {renderField("1-Side", "oneSideCoat", "checkbox")}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Area (sf)</label>
                {renderField("Area", "plateArea", "number", undefined, true)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Perimeter (ft)</label>
                {renderField("Perim", "edgePerimeter", "number", undefined, true)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Surface Area (sf)</label>
                {renderField("SA", "plateSurfaceArea", "number", undefined, true)}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Weight</label>
                {renderField("Weight", "plateTotalWeight", "number", undefined, true)}
              </div>
            </div>
          </div>
        )}

        {/* Coating Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Coating</h4>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <span className="text-blue-600 font-bold">{getNumberFromField("coatingSystem")}.</span> Coating System
            </label>
            {renderField("Coating", "coatingSystem", "select", coatingSystems)}
          </div>
        </div>

        {/* Labor Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 flex-1">Labor Breakdown</h4>
          </div>
          
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">How to Enter Labor Time:</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li>Enter hours and minutes separately (e.g., 2h 30m = 2.5 hours)</li>
                <li>Or enter as decimal hours (e.g., 2.5 = 2 hours 30 minutes)</li>
                <li>Total labor is automatically calculated from all fields</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div id={line.id ? `field-${line.id}-laborUnload` : undefined} data-field="laborUnload" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborUnload")}.</span> Unload
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborUnload || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborUnload", value, line);
                  }}
                  label="Unload"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborUnload || 0);
                    const m = Math.round(((currentLine.laborUnload || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborCut` : undefined} data-field="laborCut" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborCut")}.</span> Cut
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborCut || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborCut", value, line);
                  }}
                  label="Cut"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborCut || 0);
                    const m = Math.round(((currentLine.laborCut || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborCope` : undefined} data-field="laborCope" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborCope")}.</span> Cope
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborCope || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborCope", value, line);
                  }}
                  label="Cope"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborCope || 0);
                    const m = Math.round(((currentLine.laborCope || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborProcessPlate` : undefined} data-field="laborProcessPlate" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborProcessPlate")}.</span> Process
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborProcessPlate || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborProcessPlate", value, line);
                  }}
                  label="Process"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborProcessPlate || 0);
                    const m = Math.round(((currentLine.laborProcessPlate || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborDrillPunch` : undefined} data-field="laborDrillPunch" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborDrillPunch")}.</span> Drill/Punch
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborDrillPunch || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborDrillPunch", value, line);
                  }}
                  label="Drill/Punch"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborDrillPunch || 0);
                    const m = Math.round(((currentLine.laborDrillPunch || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborFit` : undefined} data-field="laborFit" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborFit")}.</span> Fit
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborFit || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborFit", value, line);
                  }}
                  label="Fit"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborFit || 0);
                    const m = Math.round(((currentLine.laborFit || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborWeld` : undefined} data-field="laborWeld" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborWeld")}.</span> Weld
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborWeld || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborWeld", value, line);
                  }}
                  label="Weld"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborWeld || 0);
                    const m = Math.round(((currentLine.laborWeld || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborPrepClean` : undefined} data-field="laborPrepClean" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborPrepClean")}.</span> Prep/Clean
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborPrepClean || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborPrepClean", value, line);
                  }}
                  label="Prep/Clean"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborPrepClean || 0);
                    const m = Math.round(((currentLine.laborPrepClean || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborPaint` : undefined} data-field="laborPaint" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborPaint")}.</span> Paint
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborPaint || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborPaint", value, line);
                  }}
                  label="Paint"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborPaint || 0);
                    const m = Math.round(((currentLine.laborPaint || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborHandleMove` : undefined} data-field="laborHandleMove" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborHandleMove")}.</span> Handle/Move
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborHandleMove || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborHandleMove", value, line);
                  }}
                  label="Handle/Move"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborHandleMove || 0);
                    const m = Math.round(((currentLine.laborHandleMove || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div id={line.id ? `field-${line.id}-laborLoadShip` : undefined} data-field="laborLoadShip" data-line-id={line.id || ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("laborLoadShip")}.</span> Load/Ship
              </label>
              {isManualMode ? (
                <LaborInput
                  value={currentLine.laborLoadShip || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborLoadShip", value, line);
                  }}
                  label="Load/Ship"
                />
              ) : (
                <div className="text-gray-700 text-sm">
                  {(() => {
                    const h = Math.floor(currentLine.laborLoadShip || 0);
                    const m = Math.round(((currentLine.laborLoadShip || 0) - h) * 60);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total Labor</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-900">
                {(() => {
                  const total = currentLine.totalLabor || 0;
                  const h = Math.floor(total);
                  const m = Math.round((total - h) * 60);
                  return `${h}h ${m}m (${total.toFixed(2)} hrs)`;
                })()}
              </div>
            </div>
          </div>
        </div>


        {/* Cost Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Cost Breakdown</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Rate ($/lb)</label>
              {renderField("Mat Rate", "materialRate", "number")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Cost</label>
              {renderField("Mat Cost", "materialCost", "number", undefined, true)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Labor Rate ($/hr)</label>
              {renderField("Lab Rate", "laborRate", "number")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Labor Cost</label>
              {renderField("Lab Cost", "laborCost", "number", undefined, true)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Coating Rate</label>
              {renderField("Coat Rate", "coatingRate", "number")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Coating Cost</label>
              {renderField("Coat Cost", "coatingCost", "number", undefined, true)}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Total Cost</label>
              {renderField("Total Cost", "totalCost", "number", undefined, true)}
            </div>
          </div>
        </div>

        {/* Admin Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Admin & Notes</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("notes")}.</span> Notes
              </label>
              {renderField("Notes", "notes", "textarea")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("hashtags")}.</span> Hashtags
              </label>
              {renderField("Hashtags", "hashtags", "text")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("status")}.</span> Status
              </label>
              {renderField("Status", "status", "select", ["Active", "Void"])}
            </div>
            <div>
              <label className="flex items-center gap-2">
                {renderField("Stock Rounding", "useStockRounding", "checkbox")}
                <span className="text-xs font-medium text-gray-700">
                  <span className="text-blue-600 font-bold">{getNumberFromField("useStockRounding")}.</span> Use Stock Rounding
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode - Edit Button */}
      {isManualMode && (
        <div className="pt-4 border-t border-gray-300">
          <button
            onClick={() => onEdit(line)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Edit Line
          </button>
        </div>
      )}
    </div>
  );
}

