"use client";

import { Edit, Trash2, Copy, Check, X } from "lucide-react";
import { EstimatingLine } from "./EstimatingGrid";
import { SHAPE_TYPES, type ShapeType, getShapesByType, getValidGrades } from "@/lib/utils/aiscShapes";
import { getAvailableThicknesses } from "@/lib/utils/plateDatabase";
import { getNumberFromField } from "@/lib/utils/fieldNumberMap";

interface EstimatingGridTableProps {
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
  onChange: (field: keyof EstimatingLine, value: any) => void;
  totals: {
    totalWeight: number;
    totalSurfaceArea: number;
    totalLabor: number;
    materialCost: number;
    laborCost: number;
    coatingCost: number;
    totalCost: number;
  };
}

export default function EstimatingGridTable({
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
}: EstimatingGridTableProps) {
  const categories = ["Columns", "Beams", "Misc Metals", "Plates", "Connections", "Other"];
  const subCategories = ["Base Plate", "Gusset", "Stiffener", "Clip", "Brace", "Other"];
  const coatingSystems = ["None", "Paint", "Powder", "Galv"];

  // Get available sizes for selected shape type
  const availableSizes = editingLine.shapeType
    ? getShapesByType(editingLine.shapeType).map((shape) => shape["Member Size"])
    : [];

  const availableGrades = editingLine.shapeType
    ? getValidGrades(editingLine.shapeType)
    : ["A36"];

  const plateThicknesses = getAvailableThicknesses();

  const renderCell = (line: EstimatingLine, field: keyof EstimatingLine, isReadOnly = false) => {
    const isEditing = editingId === line.id;
    const value = isEditing ? editingLine[field] : line[field];

    if (isEditing && !isReadOnly) {
      // Render input fields based on field type
      switch (field) {
        case "materialType":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="Material">Material</option>
              <option value="Plate">Plate</option>
            </select>
          );
        case "category":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          );
        case "subCategory":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {subCategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          );
        case "shapeType":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => {
                onChange(field, e.target.value);
                onChange("sizeDesignation", ""); // Clear size when type changes
              }}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">Select...</option>
              {SHAPE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          );
        case "sizeDesignation":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              disabled={!editingLine.shapeType}
            >
              <option value="">Select...</option>
              {availableSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          );
        case "grade":
        case "plateGrade":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          );
        case "coatingSystem":
          return (
            <select
              value={value as string || ""}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {coatingSystems.map((system) => (
                <option key={system} value={system}>{system}</option>
              ))}
            </select>
          );
        case "status":
          return (
            <select
              value={value as string || "Active"}
              onChange={(e) => onChange(field, e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="Active">Active</option>
              <option value="Void">Void</option>
            </select>
          );
        case "oneSideCoat":
          return (
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={(e) => onChange(field, e.target.checked)}
              className="w-4 h-4"
            />
          );
        case "useStockRounding":
          return (
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={(e) => onChange(field, e.target.checked)}
              className="w-4 h-4"
            />
          );
        case "thickness":
          return (
            <select
              value={value as number || ""}
              onChange={(e) => onChange(field, parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">Select...</option>
              {plateThicknesses.map((plate) => (
                <option key={plate.thickness} value={plate.thicknessInches}>
                  {plate.thickness}
                </option>
              ))}
            </select>
          );
        default:
          if (typeof value === "number") {
            return (
              <input
                type="number"
                step={field.includes("Rate") || field.includes("Cost") ? "0.01" : "1"}
                value={value || 0}
                onChange={(e) => onChange(field, parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            );
          } else {
            return (
              <input
                type="text"
                value={value as string || ""}
                onChange={(e) => onChange(field, e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            );
          }
      }
    } else {
      // Render display values
      if (isReadOnly) {
        return (
          <span className="text-gray-600 bg-gray-50 px-2 py-1 rounded text-sm">
            {typeof value === "number"
              ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
              : value || "-"}
          </span>
        );
      }
      if (typeof value === "number") {
        return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
      }
      if (typeof value === "boolean") {
        return value ? "✓" : "";
      }
      return value || "-";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {/* Grouped Headers */}
        <thead className="bg-gray-50">
          {/* Main Header Row */}
          <tr>
            <th rowSpan={2} className="sticky left-0 z-10 bg-gray-50 border-r-2 border-gray-300 px-3 py-2 text-left font-semibold text-xs uppercase">
              Line ID
            </th>
            <th colSpan={6} className="bg-gray-100 px-3 py-2 text-center font-semibold text-xs uppercase border-b border-gray-300">
              A) Identification
            </th>
            <th colSpan={9} className="bg-blue-50 px-3 py-2 text-center font-semibold text-xs uppercase border-b border-gray-300">
              B) Material - Structural Members
            </th>
            <th colSpan={10} className="bg-blue-50 px-3 py-2 text-center font-semibold text-xs uppercase border-b border-gray-300">
              C) Material - Plate
            </th>
            <th colSpan={12} className="bg-green-50 px-3 py-2 text-center font-semibold text-xs uppercase border-b border-gray-300">
              D) Labor
            </th>
            <th colSpan={6} className="bg-amber-50 px-3 py-2 text-center font-semibold text-xs uppercase border-b border-gray-300">
              E) Cost
            </th>
            <th colSpan={4} className="bg-gray-100 px-3 py-2 text-center font-semibold text-xs uppercase border-b border-gray-300">
              F) Admin
            </th>
            <th rowSpan={2} className="sticky right-0 z-10 bg-gray-50 border-l-2 border-gray-300 px-3 py-2 text-center font-semibold text-xs uppercase">
              Actions
            </th>
          </tr>
          {/* Column Header Row */}
          <tr>
            {/* Identification Columns */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Drawing #</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Detail #</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Item</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Category</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Sub-Cat</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Type</th>
            
            {/* Material Columns - Always visible in header */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Shape</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Size</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Grade</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">L (ft)</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">L (in)</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Qty</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">W/ft</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Total W</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">SA/ft</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Total SA</th>
            
            {/* Plate Material Columns - Always visible in header */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Thick</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Width</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Length</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Area</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Perim</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">SA</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">1-Side</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Grade</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Qty</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-blue-50">Weight</th>
            
            {/* Coating Column */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Coating</th>
            
            {/* Labor Columns */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Unload</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Cut</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Cope</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Process</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Drill</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Fit</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Weld</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Prep</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Paint</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Handle</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Load</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-green-50">Total</th>
            
            {/* Cost Columns */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-amber-50">Mat $/lb</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-amber-50">Mat $</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-amber-50">Lab $/hr</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-amber-50">Lab $</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-amber-50">Coat $</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 bg-amber-50">Total $</th>
            
            {/* Admin Columns */}
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Notes</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Tags</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Status</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={50} className="px-4 py-8 text-center text-gray-500">
                No lines yet. Click &quot;Add Line&quot; to get started.
              </td>
            </tr>
          ) : (
            lines.map((line) => {
              const isEditing = editingId === line.id;
              // When editing, use editingLine materialType; otherwise use line materialType
              const currentMaterialType = isEditing ? (editingLine.materialType || line.materialType) : line.materialType;
              const isRolled = currentMaterialType === "Material";
              const isPlate = currentMaterialType === "Plate";
              
              return (
                <tr key={line.id} className={`hover:bg-gray-50 ${line.status === "Void" ? "opacity-50" : ""}`}>
                  {/* Line ID - Sticky */}
                  <td className="sticky left-0 z-10 bg-white border-r-2 border-gray-300 px-3 py-2 font-medium">
                    {renderCell(line, "lineId")}
                  </td>
                  
                  {/* Identification */}
                  <td className="px-2 py-2">{renderCell(line, "drawingNumber")}</td>
                  <td className="px-2 py-2">{renderCell(line, "detailNumber")}</td>
                  <td className="px-2 py-2 font-medium">{renderCell(line, "itemDescription")}</td>
                  <td className="px-2 py-2">{renderCell(line, "category")}</td>
                  <td className="px-2 py-2">{renderCell(line, "subCategory")}</td>
                  <td className="px-2 py-2">{renderCell(line, "materialType")}</td>
                  
                  {/* Material - Show when type is Material, hide when Plate */}
                  {isRolled ? (
                    <>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "shapeType")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "sizeDesignation")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "grade")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "lengthFt")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "lengthIn")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "qty")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "weightPerFoot", true)}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "totalWeight", true)}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "surfaceAreaPerFoot", true)}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "totalSurfaceArea", true)}</td>
                    </>
                  ) : (
                    // Empty cells for Material columns when Plate is selected
                    Array(9).fill(null).map((_, i) => (
                      <td key={`rolled-empty-${i}`} className="px-2 py-2 bg-gray-100"></td>
                    ))
                  )}
                  
                  {/* Plate Material - Show when type is Plate, hide when Rolled */}
                  {isPlate ? (
                    <>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "thickness")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "width")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "plateLength")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "plateArea", true)}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "edgePerimeter", true)}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "plateSurfaceArea", true)}</td>
                      <td className="px-2 py-2 bg-blue-50 text-center">{renderCell(line, "oneSideCoat")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "plateGrade")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "plateQty")}</td>
                      <td className="px-2 py-2 bg-blue-50">{renderCell(line, "plateTotalWeight", true)}</td>
                    </>
                  ) : (
                    // Empty cells for Plate columns when Material is selected
                    Array(10).fill(null).map((_, i) => (
                      <td key={`plate-empty-${i}`} className="px-2 py-2 bg-gray-100"></td>
                    ))
                  )}
                  
                  {/* Coating */}
                  <td className="px-2 py-2">{renderCell(line, "coatingSystem")}</td>
                  
                  {/* Labor */}
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborUnload")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborCut")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborCope")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborProcessPlate")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborDrillPunch")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborFit")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborWeld")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborPrepClean")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborPaint")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborHandleMove")}</td>
                  <td className="px-2 py-2 bg-green-50">{renderCell(line, "laborLoadShip")}</td>
                  <td className="px-2 py-2 bg-green-50 font-medium">{renderCell(line, "totalLabor", true)}</td>
                  
                  {/* Cost */}
                  <td className="px-2 py-2 bg-amber-50">{renderCell(line, "materialRate")}</td>
                  <td className="px-2 py-2 bg-amber-50 font-medium">{renderCell(line, "materialCost", true)}</td>
                  <td className="px-2 py-2 bg-amber-50">{renderCell(line, "laborRate")}</td>
                  <td className="px-2 py-2 bg-amber-50 font-medium">{renderCell(line, "laborCost", true)}</td>
                  <td className="px-2 py-2 bg-amber-50 font-medium">{renderCell(line, "coatingCost", true)}</td>
                  <td className="px-2 py-2 bg-amber-50 font-bold">{renderCell(line, "totalCost", true)}</td>
                  
                  {/* Admin */}
                  <td className="px-2 py-2">{renderCell(line, "notes")}</td>
                  <td className="px-2 py-2">{renderCell(line, "hashtags")}</td>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      line.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {line.status || "Active"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">{renderCell(line, "useStockRounding")}</td>
                  
                  {/* Actions - Sticky */}
                  <td className="sticky right-0 z-10 bg-white border-l-2 border-gray-300 px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={onSave}
                          className="text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={onCancel}
                          className="text-red-600 hover:text-red-800"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(line)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                          disabled={!isManualMode}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDuplicate(line)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Duplicate"
                          disabled={!isManualMode}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(line.id!)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                          disabled={!isManualMode}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {/* Totals Row */}
        <tfoot className="bg-gray-100 border-t-2 border-gray-300">
          <tr className="font-semibold">
            <td colSpan={7} className="px-3 py-2 text-right sticky left-0 bg-gray-100">TOTALS:</td>
            <td colSpan={9} className="px-2 py-2 bg-blue-50"></td>
            <td className="px-2 py-2 bg-blue-50 font-medium">{totals.totalWeight.toFixed(2)}</td>
            <td className="px-2 py-2 bg-blue-50"></td>
            <td className="px-2 py-2 bg-blue-50 font-medium">{totals.totalSurfaceArea.toFixed(2)}</td>
            <td colSpan={10} className="px-2 py-2 bg-blue-50"></td>
            <td className="px-2 py-2"></td>
            <td colSpan={11} className="px-2 py-2 bg-green-50"></td>
            <td className="px-2 py-2 bg-green-50 font-medium">{totals.totalLabor.toFixed(2)}</td>
            <td className="px-2 py-2 bg-amber-50"></td>
            <td className="px-2 py-2 bg-amber-50 font-medium">${totals.materialCost.toFixed(2)}</td>
            <td className="px-2 py-2 bg-amber-50"></td>
            <td className="px-2 py-2 bg-amber-50 font-medium">${totals.laborCost.toFixed(2)}</td>
            <td className="px-2 py-2 bg-amber-50 font-medium">${totals.coatingCost.toFixed(2)}</td>
            <td className="px-2 py-2 bg-amber-50 font-bold sticky right-0 bg-gray-100">${totals.totalCost.toFixed(2)}</td>
            <td colSpan={4} className="px-2 py-2"></td>
            <td className="px-2 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

