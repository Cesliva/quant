"use client";

import { useState, useRef, useEffect } from "react";
import { EstimatingLine } from "./EstimatingGrid";
import { SHAPE_TYPES, getShapesByType, getValidGrades } from "@/lib/utils/aiscShapes";
import { 
  getAvailableThicknesses, 
  getValidPlateGrades,
  convertThicknessInputToInches,
  getThicknessLabelFromInches
} from "@/lib/utils/plateDatabase";
import LaborInput from "./LaborInput";
import CollapsibleLaborInput from "./CollapsibleLaborInput";
import HardwareInput from "./HardwareInput";
import { Info, ChevronDown, RotateCcw, Lock, Unlock, Wrench, ChevronUp, X } from "lucide-react";
import { getNumberFromField } from "@/lib/utils/fieldNumberMap";
import { getMaterialGradeInfo, getPlateGradeInfo } from "@/lib/utils/steelGradeInfo";
import { 
  MISC_METALS_CATEGORIES, 
  ALL_MISC_METALS_CATEGORIES,
  getMiscMetalsCategoryLabel,
  getMiscMetalsCategoryById
} from "@/lib/data/miscMetalsCategories";
import {
  getDefaultTemplate,
  getTemplatesForSubtype,
  applyTemplate,
  type AssemblyTemplate
} from "@/lib/data/miscMetalsAssemblies";
import {
  loadCustomTemplatesForSubtype,
  saveCustomTemplate,
  deleteCustomTemplate
} from "@/lib/utils/assemblyTemplates";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useAuth } from "@/lib/hooks/useAuth";
import { Save, Trash2, BookOpen, Plus } from "lucide-react";

interface EstimatingRowDetailProps {
  line: EstimatingLine;
  editingId: string | null;
  editingLine: Partial<EstimatingLine>;
  isManualMode: boolean;
  defaultMaterialRate: number;
  defaultLaborRate: number;
  defaultCoatingRate: number;
  companySettings?: import("@/lib/utils/settingsLoader").CompanySettings | null;
  projectSettings?: import("@/lib/utils/settingsLoader").ProjectSettings | null;
  lines?: EstimatingLine[]; // All lines for parent dropdown
  onEdit: (line: EstimatingLine) => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (field: keyof EstimatingLine, value: any, line?: EstimatingLine) => void;
  onCollapse?: () => void; // Function to collapse the expanded row
}

export default function EstimatingRowDetail({
  line,
  editingId,
  editingLine,
  isManualMode,
  defaultMaterialRate,
  defaultLaborRate,
  defaultCoatingRate,
  companySettings,
  projectSettings,
  lines = [],
  onEdit,
  onSave,
  onCancel,
  onChange,
  onCollapse,
}: EstimatingRowDetailProps) {
  const isEditing = editingId === line.id;
  // Merge editingLine with line to get complete data when editing
  const currentLine = isEditing ? { ...line, ...editingLine } : line;
  const materialType = currentLine.materialType || "Material";

  // State for filterable size dropdown
  const [sizeFilter, setSizeFilter] = useState<string>("");
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState<boolean>(false);
  const sizeDropdownRef = useRef<HTMLDivElement | null>(null);
  
  // State for grade info popover (Material)
  const [showGradeInfo, setShowGradeInfo] = useState<boolean>(false);
  const gradeInfoRef = useRef<HTMLDivElement | null>(null);
  
  // State for plate grade info popover
  const [showPlateGradeInfo, setShowPlateGradeInfo] = useState<boolean>(false);
  const plateGradeInfoRef = useRef<HTMLDivElement | null>(null);
  
  // State for number of holes from drill/punch calculator
  const [numberOfHoles, setNumberOfHoles] = useState<number>(0);
  
  // State for hardware section expanded/collapsed
  const [hardwareExpanded, setHardwareExpanded] = useState<boolean>(false);
  
  // State for seeded values from previous line
  const [seededFields, setSeededFields] = useState<Map<string, { value: any; committed: boolean }>>(new Map());
  const [fieldClickCount, setFieldClickCount] = useState<Map<string, number>>(new Map());
  
  // Get previous line's value for a field
  const getPreviousLineValue = (field: keyof EstimatingLine): any => {
    if (!lines || lines.length === 0) return undefined;
    
    // Sort lines by lineId to get proper sequence (L1, L2, L3, etc.)
    const sortedLines = [...lines].sort((a, b) => {
      const aNum = parseInt(a.lineId.replace(/[^0-9]/g, '')) || 0;
      const bNum = parseInt(b.lineId.replace(/[^0-9]/g, '')) || 0;
      return aNum - bNum;
    });
    
    // Find current line's position in sorted sequence
    const currentLineIdNum = parseInt(line.lineId.replace(/[^0-9]/g, '')) || 0;
    const currentIndex = sortedLines.findIndex(l => {
      const lNum = parseInt(l.lineId.replace(/[^0-9]/g, '')) || 0;
      return lNum === currentLineIdNum;
    });
    
    if (currentIndex <= 0) return undefined;
    
    // Get the previous line in the sequence
    const previousLine = sortedLines[currentIndex - 1];
    
    // Only return value if previous line is not voided
    if (previousLine.status === "Void") {
      // Try to find an earlier non-voided line
      for (let i = currentIndex - 2; i >= 0; i--) {
        if (sortedLines[i].status !== "Void") {
          return sortedLines[i][field];
        }
      }
      return undefined;
    }
    
    return previousLine[field];
  };
  
  // Handle field click - seed with previous value on first click
  const handleFieldClick = (field: keyof EstimatingLine, currentValue: any) => {
    const fieldKey = `${line.id}-${field}`;
    const clickCount = fieldClickCount.get(fieldKey) || 0;
    const seeded = seededFields.get(fieldKey);
    
    // First click: seed with previous line's value if field is empty
    if (clickCount === 0 && (!currentValue || currentValue === "" || currentValue === 0)) {
      const previousValue = getPreviousLineValue(field);
      if (previousValue !== undefined && previousValue !== null && previousValue !== "") {
        setSeededFields(prev => {
          const newMap = new Map(prev);
          newMap.set(fieldKey, { value: previousValue, committed: false });
          return newMap;
        });
        setFieldClickCount(prev => {
          const newMap = new Map(prev);
          newMap.set(fieldKey, 1);
          return newMap;
        });
      }
    }
    // Second click: commit the seeded value
    else if (clickCount === 1 && seeded && !seeded.committed) {
      setSeededFields(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(fieldKey);
        if (existing) {
          newMap.set(fieldKey, { ...existing, committed: true });
        }
        return newMap;
      });
      setFieldClickCount(prev => {
        const newMap = new Map(prev);
        newMap.set(fieldKey, 2);
        return newMap;
      });
      // Commit the seeded value
      onChange(field, seeded.value, line);
    }
    else {
      setFieldClickCount(prev => {
        const newMap = new Map(prev);
        newMap.set(fieldKey, clickCount + 1);
        return newMap;
      });
    }
  };
  
  // Clear seeded state when field changes or line changes
  useEffect(() => {
    setSeededFields(new Map());
    setFieldClickCount(new Map());
  }, [line.id]);
  
  // Determine if rates are overridden (different from default)
  const isMaterialRateOverridden = Math.abs((currentLine.materialRate || 0) - defaultMaterialRate) > 0.01;
  const isLaborRateOverridden = Math.abs((currentLine.laborRate || 0) - defaultLaborRate) > 0.01;
  const isCoatingRateOverridden = Math.abs((currentLine.coatingRate || 0) - defaultCoatingRate) > 0.01;
  
  // Lock state: locked by default if not overridden, unlocked if overridden
  const [materialRateLocked, setMaterialRateLocked] = useState<boolean>(!isMaterialRateOverridden);
  const [laborRateLocked, setLaborRateLocked] = useState<boolean>(!isLaborRateOverridden);
  const [coatingRateLocked, setCoatingRateLocked] = useState<boolean>(!isCoatingRateOverridden);
  
  // Assembly template state
  const [availableTemplates, setAvailableTemplates] = useState<AssemblyTemplate[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState<boolean>(false);
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const companyId = useCompanyId();
  const { user } = useAuth();
  
  // Determine rate source (company vs project)
  const materialRateSource = projectSettings?.materialRate !== undefined ? "Project" : "Company";
  const laborRateSource = projectSettings?.laborRate !== undefined ? "Project" : "Company";
  const coatingRateSource = projectSettings?.coatingRate !== undefined ? "Project" : "Company";

  // Sync lock state when switching between lines
  // Locked by default if not overridden, unlocked if overridden
  useEffect(() => {
    const materialOverridden = Math.abs((currentLine.materialRate || 0) - defaultMaterialRate) > 0.01;
    const laborOverridden = Math.abs((currentLine.laborRate || 0) - defaultLaborRate) > 0.01;
    const coatingOverridden = Math.abs((currentLine.coatingRate || 0) - defaultCoatingRate) > 0.01;
    
    // Update lock state: locked if not overridden, unlocked if overridden
    // Only sync when line changes, not when rates change (user can manually unlock)
    setMaterialRateLocked(!materialOverridden);
    setLaborRateLocked(!laborOverridden);
    setCoatingRateLocked(!coatingOverridden);
    
    // Reset hardware expanded state when switching lines
    setHardwareExpanded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.id, defaultMaterialRate, defaultLaborRate, defaultCoatingRate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sizeDropdownOpen && sizeDropdownRef.current) {
        if (!sizeDropdownRef.current.contains(target)) {
          setSizeDropdownOpen(false);
          setSizeFilter("");
        }
      }
      if (showGradeInfo && gradeInfoRef.current) {
        if (!gradeInfoRef.current.contains(target)) {
          setShowGradeInfo(false);
        }
      }
      if (showPlateGradeInfo && plateGradeInfoRef.current) {
        if (!plateGradeInfoRef.current.contains(target)) {
          setShowPlateGradeInfo(false);
        }
      }
    };

    if (sizeDropdownOpen || showGradeInfo || showPlateGradeInfo) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [sizeDropdownOpen, showGradeInfo, showPlateGradeInfo]);

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
  
  const sspcPrepOptions = [
    "None",
    "SSPC-SP 1 - Solvent Cleaning",
    "SSPC-SP 2 - Hand Tool Cleaning",
    "SSPC-SP 3 - Power Tool Cleaning",
    "SSPC-SP 4 - Flame Cleaning",
    "SSPC-SP 5 - White Metal Blast Cleaning",
    "SSPC-SP 6 - Commercial Blast Cleaning",
    "SSPC-SP 7 - Brush-Off Blast Cleaning",
    "SSPC-SP 8 - Pickling",
    "SSPC-SP 10 - Near-White Blast Cleaning",
    "SSPC-SP 11 - Power Tool Cleaning to Bare Metal",
    "SSPC-SP 12 - Waterjetting Prior to Recoating",
    "SSPC-SP 13 - Surface Preparation of Concrete",
    "SSPC-SP 14 - Industrial Blast Cleaning",
    "SSPC-SP 15 - Commercial Grade Power Tool Cleaning"
  ];

  const availableSizes = currentLine.shapeType
    ? getShapesByType(currentLine.shapeType).map((shape) => shape["Member Size"])
    : [];

  const availableGrades = materialType === "Material" && currentLine.shapeType
    ? getValidGrades(currentLine.shapeType)
    : materialType === "Plate" && currentLine.thickness
    ? getValidPlateGrades(currentLine.thickness)
    : materialType === "Material"
    ? getValidGrades()
    : materialType === "Plate"
    ? getValidPlateGrades("")
    : ["A36"];

  const plateThicknesses = getAvailableThicknesses();
  const plateThicknessOptions = plateThicknesses.map((spec) => spec.thickness);

  function renderField(
    label: string,
    field: keyof EstimatingLine,
    type: "text" | "number" | "select" | "textarea" | "checkbox" = "text",
    options?: string[],
    isReadOnly = false
  ) {
    const value = currentLine[field];
    // In manual mode, all fields are editable by default (no need to click edit)
    // In voice mode, everything is read-only
    const canEdit = isManualMode && !isReadOnly;

    if (!canEdit) {
      if (field === "thickness") {
        const numericThickness = typeof value === "number" ? value : convertThicknessInputToInches(value as string | number | undefined);
        const label = getThicknessLabelFromInches(numericThickness);
        return <span className="text-gray-700">{label ? `${label}"` : numericThickness ? `${numericThickness.toFixed(3)}"` : "-"}</span>;
      }
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
      if (field === "thickness" && materialType === "Plate") {
        const currentValue =
          typeof value === "number"
            ? getThicknessLabelFromInches(value) || ""
            : (value as string) || "";
        return (
          <select
            id={fieldId}
            {...fieldDataAttrs}
            value={currentValue}
            onChange={(e) => {
              const selection = e.target.value;
              if (!isEditing) {
                onEdit(line);
              }
              const numeric = convertThicknessInputToInches(selection);
              onChange("thickness", numeric, line);
              setTimeout(() => {
                if (isEditing || editingId === line.id) {
                  onSave();
                }
              }, 100);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}"
              </option>
            ))}
          </select>
        );
      }
      // Special handling for sizeDesignation field - use filterable dropdown
      if (field === "sizeDesignation" && materialType === "Material" && currentLine.shapeType) {
        const currentValue = value as string || "";
        const displayValue = sizeDropdownOpen ? sizeFilter : currentValue;
        
        // Filter sizes based on input - if no filter, show all
        const filteredSizes = sizeFilter
          ? options.filter((opt) =>
              opt.toLowerCase().includes(sizeFilter.toLowerCase())
            )
          : options;

        return (
          <div 
            className="relative w-full" 
            ref={sizeDropdownRef}
          >
            <div className="relative">
              <input
                id={fieldId}
                {...fieldDataAttrs}
                type="text"
                value={displayValue}
                onChange={(e) => {
                  const newFilter = e.target.value;
                  setSizeFilter(newFilter);
                  
                  // Always keep dropdown open when typing
                  if (!sizeDropdownOpen) {
                    setSizeDropdownOpen(true);
                  }
                  
                  // If exact match found, select it
                  const exactMatch = options.find(
                    (opt) => opt.toLowerCase() === newFilter.toLowerCase()
                  );
                  if (exactMatch) {
                    onChange(field, exactMatch, line);
                    setSizeFilter("");
                    setSizeDropdownOpen(false);
                    if (isEditing) {
                      onSave();
                    }
                  }
                }}
                onFocus={(e) => {
                  setSizeDropdownOpen(true);
                  // Clear the filter so input is empty and user can type
                  setSizeFilter("");
                  // Select all text if there's a current value, so typing replaces it
                  if (currentValue) {
                    e.currentTarget.select();
                  }
                }}
                onBlur={(e) => {
                  // Delay closing to allow click on dropdown option to register
                  setTimeout(() => {
                    const activeElement = document.activeElement;
                    if (!sizeDropdownRef.current?.contains(activeElement)) {
                      setSizeFilter("");
                      setSizeDropdownOpen(false);
                    }
                  }, 200);
                }}
                placeholder={currentValue || "Type to filter sizes..."}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ChevronDown 
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform ${sizeDropdownOpen ? 'rotate-180' : ''}`}
              />
            </div>
            {sizeDropdownOpen && (
              <>
                {filteredSizes.length > 0 ? (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredSizes.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onMouseDown={(e) => {
                          // Use onMouseDown to prevent blur from firing first
                          e.preventDefault();
                          onChange(field, opt, line);
                          setSizeFilter("");
                          setSizeDropdownOpen(false);
                          if (isEditing) {
                            onSave();
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          currentValue === opt ? "bg-blue-100 font-semibold" : ""
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : sizeFilter ? (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500">
                    No sizes found matching "{sizeFilter}"
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      }

      // Regular select for other fields
      // Special handling for grade field - add tooltips
      const isGradeField = field === "grade" || field === "plateGrade";
      
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
          {options.map((opt) => {
            // Add tooltip for grade options
            let title = opt;
            if (isGradeField) {
              const gradeInfo = materialType === "Material" 
                ? getMaterialGradeInfo(opt)
                : getPlateGradeInfo(opt);
              if (gradeInfo) {
                title = `${gradeInfo.description}\n\nTypical Uses:\n${gradeInfo.typicalUses.join("\n• ")}\n\n${gradeInfo.notes || ""}`;
              }
            }
            return (
              <option key={opt} value={opt} title={title}>
                {opt}
              </option>
            );
          })}
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

    const fieldKey = `${line.id}-${field}`;
    const seeded = seededFields.get(fieldKey);
    const hasSeededValue = seeded && !seeded.committed;
    
    // Determine display value: show seeded value if exists and not committed, otherwise show actual value
    const displayValue = hasSeededValue 
      ? (typeof seeded.value === "number" ? seeded.value : String(seeded.value))
      : (typeof value === "number" ? (value || 0) : (value as string || ""));
    
    return (
      <input
        id={fieldId}
        {...fieldDataAttrs}
        type={type}
        value={displayValue}
        onClick={(e) => {
          if (isEditing && !isReadOnly) {
            handleFieldClick(field, value);
          }
        }}
        onChange={(e) => {
          // User is typing - clear seeded state and use typed value
          if (hasSeededValue) {
            setSeededFields(prev => {
              const newMap = new Map(prev);
              newMap.delete(fieldKey);
              return newMap;
            });
            setFieldClickCount(prev => {
              const newMap = new Map(prev);
              newMap.delete(fieldKey);
              return newMap;
            });
          }
          
          const newValue = type === "number" 
            ? (e.target.value === "" ? undefined : parseFloat(e.target.value))
            : e.target.value;
          onChange(field, newValue !== undefined ? newValue : (type === "number" ? 0 : ""), line);
        }}
        onBlur={() => {
          if (isEditing && !isReadOnly) {
            // If there's a seeded value that wasn't committed, commit it now
            if (hasSeededValue && seeded) {
              onChange(field, seeded.value, line);
              setSeededFields(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(fieldKey);
                if (existing) {
                  newMap.set(fieldKey, { ...existing, committed: true });
                }
                return newMap;
              });
            }
            // Immediate save on blur
            onSave();
          }
        }}
        step={type === "number" ? "any" : undefined}
        className={hasSeededValue ? "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 border-blue-300" : "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"}
        readOnly={isReadOnly}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative max-w-full overflow-x-hidden">
      {/* Top Collapse Button */}
      {onCollapse && (
        <div className="sticky top-0 z-20 -mt-6 -mx-6 mb-4 pb-2 bg-gradient-to-b from-white via-white/95 to-transparent">
          <button
            onClick={onCollapse}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-gray-600 hover:text-gray-800 bg-gray-50/80 hover:bg-gray-100/90 rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md border border-gray-200/60"
            title="Collapse detail view"
          >
            <ChevronUp className="w-4 h-4" />
            <span>Collapse</span>
          </button>
        </div>
      )}
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

      <div className="space-y-6">
        {/* Identification Section - Full Width */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60">Identification</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("elevation")}.</span> Elevation
              </label>
              {renderField("Elevation", "elevation", "text")}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">Work Type</span>
              </label>
              <select
                value={(isEditing ? editingLine.workType : line.workType) || "STRUCTURAL"}
                onChange={(e) => {
                  if (!isEditing) {
                    onEdit(line);
                  }
                  const newWorkType = e.target.value as "STRUCTURAL" | "MISC";
                  onChange("workType", newWorkType, line);
                  
                  if (newWorkType === "MISC" && !editingLine.miscMethod) {
                    onChange("miscMethod", "ASSEMBLY", line);
                  }
                  
                  if (newWorkType === "STRUCTURAL") {
                    onChange("miscMethod", undefined, line);
                    onChange("miscSubtype", undefined, line);
                  }
                  
                  if (isEditing) {
                    onSave();
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="STRUCTURAL">Structural</option>
                <option value="MISC">Misc Metals</option>
              </select>
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
              <select
                value={(isEditing ? editingLine.materialType : line.materialType) || "Material"}
                onChange={(e) => {
                  if (!isEditing) {
                    onEdit(line);
                  }
                  onChange("materialType", e.target.value, line);
                  setTimeout(() => {
                    if (isEditing || editingId === line.id) {
                      onSave();
                    }
                  }, 100);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="Material">Material</option>
                <option value="Plate">Plate</option>
              </select>
            </div>
          </div>

          {/* Misc Metals Configuration - Shows when workType = MISC */}
          {(isEditing ? editingLine.workType : line.workType) === "MISC" && (
            <div className="mt-4 pt-4 border-t border-gray-200 bg-purple-50/30 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Misc Metals Configuration</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <span className="text-blue-600 font-bold">Estimating Method</span>
                  </label>
                  <select
                    value={(isEditing ? editingLine.miscMethod : line.miscMethod) || "ASSEMBLY"}
                    onChange={(e) => {
                      if (!isEditing) {
                        onEdit(line);
                      }
                      onChange("miscMethod", e.target.value, line);
                      if (isEditing) {
                        onSave();
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="DETAILED">Detailed (Member-based)</option>
                    <option value="ASSEMBLY">Assembly (Rule-of-thumb)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <span className="text-blue-600 font-bold">Misc Subtype</span>
                    <span className="text-gray-500 text-xs ml-1">(Preset categories - always overrideable)</span>
                  </label>
                  <select
                    value={(isEditing ? editingLine.miscSubtype : line.miscSubtype) || ""}
                    onChange={(e) => {
                      if (!isEditing) {
                        onEdit(line);
                      }
                      const newSubtype = e.target.value || undefined;
                      onChange("miscSubtype", newSubtype, line);
                      
                      // Auto-set method based on category if available
                      if (newSubtype) {
                        const category = getMiscMetalsCategoryById(newSubtype);
                        if (category && !editingLine.miscMethod) {
                          onChange("miscMethod", category.commonMethod, line);
                        }
                      }
                      
                      if (isEditing) {
                        onSave();
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select subtype...</option>
                    
                    {/* Stairs & Access */}
                    <optgroup label="🪜 Stairs & Access">
                      {MISC_METALS_CATEGORIES.stairs.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Handrails / Guardrails */}
                    <optgroup label="🤚 Handrails / Guardrails">
                      {MISC_METALS_CATEGORIES.handrails.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Rail Posts */}
                    <optgroup label="Rail Posts">
                      {MISC_METALS_CATEGORIES.railPosts.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Platforms & Walkways */}
                    <optgroup label="🧱 Platforms & Walkways">
                      {MISC_METALS_CATEGORIES.platforms.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Screens, Guards & Panels */}
                    <optgroup label="🪟 Screens, Guards & Panels">
                      {MISC_METALS_CATEGORIES.screens.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Gates, Doors & Barriers */}
                    <optgroup label="🚪 Gates, Doors & Barriers">
                      {MISC_METALS_CATEGORIES.gates.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Ladders, Cages & Safety */}
                    <optgroup label="🔩 Ladders, Cages & Safety">
                      {MISC_METALS_CATEGORIES.ladders.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Embeds, Angles & Light Framing */}
                    <optgroup label="🔧 Embeds, Angles & Light Framing">
                      {MISC_METALS_CATEGORIES.embeds.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Finishes & Special Conditions */}
                    <optgroup label="🎨 Finishes & Special Conditions (Adders)">
                      {MISC_METALS_CATEGORIES.finishes.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                    
                    {/* Other / Custom */}
                    <optgroup label="Other">
                      {MISC_METALS_CATEGORIES.other.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                      {/* Legacy options for backward compatibility */}
                      <option value="STAIR">Stair (Legacy)</option>
                      <option value="HANDRAIL">Handrail (Legacy)</option>
                      <option value="GUARDRAIL">Guardrail (Legacy)</option>
                      <option value="LADDER">Ladder (Legacy)</option>
                      <option value="PLATFORM">Platform (Legacy)</option>
                      <option value="GATE">Gate (Legacy)</option>
                      <option value="OTHER">Other (Legacy)</option>
                    </optgroup>
                  </select>
                  {(isEditing ? editingLine.miscSubtype : line.miscSubtype) && (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const subtype = (isEditing ? editingLine.miscSubtype : line.miscSubtype);
                          const category = subtype ? getMiscMetalsCategoryById(subtype) : null;
                          if (category) {
                            return `Typical unit: ${category.unit} • Method: ${category.commonMethod}`;
                          }
                          return null;
                        })()}
                      </p>
                      
                      {/* Template Management */}
                      {availableTemplates.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          <select
                            onChange={(e) => {
                              const templateId = e.target.value;
                              if (templateId) {
                                const template = availableTemplates.find(t => t.id === templateId);
                                if (template) {
                                  const applied = applyTemplate(editingLine, template);
                                  Object.entries(applied).forEach(([key, value]) => {
                                    if (value !== undefined) {
                                      onChange(key as keyof EstimatingLine, value, line);
                                    }
                                  });
                                  if (isEditing) {
                                    onSave();
                                  }
                                }
                              }
                              e.target.value = "";
                            }}
                            className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            defaultValue=""
                          >
                            <option value="">Load template...</option>
                            {availableTemplates.map(template => (
                              <option key={template.id} value={template.id}>
                                {template.isDefault ? "📋 " : "⭐ "}{template.name}
                              </option>
                            ))}
                          </select>
                          
                          <button
                            type="button"
                            onClick={async () => {
                              if (!companyId || !user) {
                                alert("You must be logged in to save custom assemblies");
                                return;
                              }
                              
                              const templateName = prompt("Enter a name for this custom assembly:");
                              if (!templateName) return;
                              
                              setSavingTemplate(true);
                              try {
                                const subtype = (isEditing ? editingLine.miscSubtype : line.miscSubtype);
                                if (!subtype) {
                                  alert("Please select a misc subtype first");
                                  return;
                                }
                                
                                await saveCustomTemplate(
                                  companyId,
                                  {
                                    name: templateName,
                                    miscSubtype: subtype,
                                    description: `Custom assembly for ${getMiscMetalsCategoryLabel(subtype)}`,
                                    isDefault: false,
                                    isCustom: true,
                                    companyId,
                                    createdBy: user.uid,
                                    template: {
                                      ...currentLine,
                                      // Remove fields that shouldn't be in template
                                      id: undefined,
                                      lineId: undefined,
                                    },
                                  },
                                  user.uid
                                );
                                
                                // Reload templates
                                const templates = await getTemplatesForSubtype(subtype, companyId);
                                setAvailableTemplates(templates);
                                alert("Custom assembly saved!");
                              } catch (error: any) {
                                console.error("Error saving template:", error);
                                alert(`Error saving template: ${error.message}`);
                              } finally {
                                setSavingTemplate(false);
                              }
                            }}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                            disabled={savingTemplate || !companyId || !user}
                            title="Save current line as custom assembly"
                          >
                            <Save className="w-3 h-3" />
                            Save as Template
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Material Section - Conditional based on workType and miscMethod */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Material Section - Only show for STRUCTURAL or DETAILED MISC */}
          {materialType === "Material" && 
           ((isEditing ? editingLine.workType : line.workType) !== "MISC" ||
            (isEditing ? editingLine.miscMethod : line.miscMethod) === "DETAILED") && (

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60">
                Material {((isEditing ? editingLine.workType : line.workType) === "MISC") && "(Detailed Mode)"}
              </h4>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <span className="text-blue-600 font-bold">{getNumberFromField("grade")}.</span> Grade
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowGradeInfo(!showGradeInfo);
                          }}
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          title="View grade information"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {showGradeInfo && (
                          <div
                            ref={gradeInfoRef}
                            className="absolute left-0 top-6 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-xl p-4 text-xs"
                            style={{ maxHeight: "400px", overflowY: "auto" }}
                          >
                            <div className="font-semibold text-sm text-gray-900 mb-3 pb-2 border-b">
                              Steel Grade Reference
                            </div>
                            <div className="space-y-4">
                              {availableGrades.map((grade) => {
                                const gradeInfo = materialType === "Material"
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
                </div>
                
                {/* Condensed Summary Fields */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-3 shadow-sm border border-gray-200/60 uppercase tracking-wide">Calculated Values</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 mb-0.5">Weight per Foot</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {currentLine.weightPerFoot?.toLocaleString("en-US", { maximumFractionDigits: 0 }) || "-"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 mb-0.5">SA per Foot</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {currentLine.surfaceAreaPerFoot?.toLocaleString("en-US", { maximumFractionDigits: 2 }) || "-"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 mb-0.5">Total Weight</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {currentLine.totalWeight?.toLocaleString("en-US", { maximumFractionDigits: 0 }) || "-"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 mb-0.5">Total SA</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {currentLine.totalSurfaceArea?.toLocaleString("en-US", { maximumFractionDigits: 0 }) || "-"}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Hardware Section - Collapsible within Material */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setHardwareExpanded(!hardwareExpanded)}
                    className="flex items-center justify-between w-full mb-3 bg-gray-50/80 rounded-lg px-4 py-2.5 shadow-sm border border-gray-200/60 hover:bg-gray-100/90 transition-all"
                  >
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-orange-600" />
                      Hardware
                    </h4>
                    <div className="flex items-center gap-2">
                      {currentLine.hardwareQuantity && currentLine.hardwareCostPerSet ? (
                        <span className="text-xs text-gray-600">
                          {currentLine.hardwareQuantity} sets × ${currentLine.hardwareCostPerSet.toFixed(2)} = ${((currentLine.hardwareQuantity || 0) * (currentLine.hardwareCostPerSet || 0)).toFixed(2)}
                        </span>
                      ) : currentLine.hardwareBoltDiameter && currentLine.hardwareBoltType ? (
                        <span className="text-xs text-gray-600">
                          {currentLine.hardwareBoltDiameter}" {currentLine.hardwareBoltType}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No hardware</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${hardwareExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {hardwareExpanded && isManualMode && (
                    <div className="space-y-3 mt-3">
                      {/* Quantity - First Field */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <span className="text-blue-600 font-bold">{getNumberFromField("hardwareQuantity")}.</span> Quantity (Bolt Sets)
                          {numberOfHoles && numberOfHoles > 0 && (
                            <span className="text-blue-600 text-xs ml-1">
                              (Auto from {numberOfHoles} holes)
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          value={currentLine.hardwareQuantity || ""}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            const qty = parseFloat(e.target.value) || 0;
                            onChange("hardwareQuantity", qty, line);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>

                      {/* Bolt Diameter */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <span className="text-blue-600 font-bold">{getNumberFromField("hardwareBoltDiameter")}.</span> Bolt Diameter
                        </label>
                        <select
                          value={currentLine.hardwareBoltDiameter || ""}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("hardwareBoltDiameter", e.target.value, line);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Diameter...</option>
                          {["1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "7/8", "1", "1-1/8", "1-1/4", "1-3/8", "1-1/2"].map((diameter) => (
                            <option key={diameter} value={diameter}>
                              {diameter}"
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bolt Type/Grade */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <span className="text-blue-600 font-bold">{getNumberFromField("hardwareBoltType")}.</span> Bolt Type / Grade
                        </label>
                        <select
                          value={currentLine.hardwareBoltType || ""}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("hardwareBoltType", e.target.value, line);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Type...</option>
                          {["A325", "A490", "A307", "A193 B7", "A193 B16", "A194 2H", "A194 2HM", "A563", "F1554 Gr36", "F1554 Gr55", "F1554 Gr105", "Anchor Bolt", "Other"].map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bolt Length (Optional) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <span className="text-blue-600 font-bold">{getNumberFromField("hardwareBoltLength")}.</span> Bolt Length (in) <span className="text-gray-500 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          value={currentLine.hardwareBoltLength || ""}
                          onChange={(e) => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            const length = e.target.value === "" ? undefined : parseFloat(e.target.value);
                            onChange("hardwareBoltLength", length, line);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Auto (standard length)"
                          step="0.25"
                          min="0"
                        />
                      </div>

                      {/* Cost per Set */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <span className="text-blue-600 font-bold">{getNumberFromField("hardwareCostPerSet")}.</span> Cost per Set (Bolt + Nut + Washer)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            value={currentLine.hardwareCostPerSet || ""}
                            onChange={(e) => {
                              if (!isEditing) {
                                onEdit(line);
                              }
                              const cost = parseFloat(e.target.value) || 0;
                              onChange("hardwareCostPerSet", cost, line);
                              setTimeout(() => {
                                if (isEditing || editingId === line.id) {
                                  onSave();
                                }
                              }, 100);
                            }}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {!isManualMode && (
                    <div className="text-gray-700 text-sm mt-2">
                      {currentLine.hardwareBoltDiameter && currentLine.hardwareBoltType ? (
                        <div>
                          {currentLine.hardwareBoltDiameter}" {currentLine.hardwareBoltType} × {currentLine.hardwareQuantity || 0} = ${(currentLine.hardwareCost || 0).toFixed(2)}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* Assembly Mode - Stairs */}
          {(isEditing ? editingLine.workType : line.workType) === "MISC" &&
           (isEditing ? editingLine.miscMethod : line.miscMethod) === "ASSEMBLY" &&
           (isEditing ? editingLine.miscSubtype : line.miscSubtype) === "STAIR" && (
            <div className="space-y-4 bg-purple-50/30 rounded-lg p-4 border border-purple-200">
              <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Stair Assembly</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Number of Treads</label>
                  {renderField("Treads", "stairTreads", "number")}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Number of Landings</label>
                  {renderField("Landings", "stairLandings", "number")}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Stair Width (ft) <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  {renderField("Stair Width", "stairWidth", "number")}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rail Included?</label>
                  {renderField("Rail Included", "stairRailIncluded", "checkbox")}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cost per Tread ($)</label>
                  {renderField("Cost per Tread", "assemblyCostPerUnit", "number")}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Total Labor Hours <span className="text-gray-500 text-xs">(manual override)</span>
                  </label>
                  {renderField("Assembly Labor Hours", "assemblyLaborHours", "number")}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Lump Sum Total ($) <span className="text-gray-500 text-xs">(overrides calculations)</span>
                  </label>
                  {renderField("Assembly Total Cost", "assemblyTotalCost", "number")}
                </div>
              </div>
            </div>
          )}

          {/* Assembly Mode - Rails */}
          {(isEditing ? editingLine.workType : line.workType) === "MISC" &&
           (isEditing ? editingLine.miscMethod : line.miscMethod) === "ASSEMBLY" &&
           ((isEditing ? editingLine.miscSubtype : line.miscSubtype) === "HANDRAIL" ||
            (isEditing ? editingLine.miscSubtype : line.miscSubtype) === "GUARDRAIL") && (
            <div className="space-y-4 bg-purple-50/30 rounded-lg p-4 border border-purple-200">
              <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Rail Assembly</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rail Type</label>
                  <select
                    value={(isEditing ? editingLine.railType : line.railType) || ""}
                    onChange={(e) => {
                      if (!isEditing) {
                        onEdit(line);
                      }
                      onChange("railType", e.target.value || undefined, line);
                      if (isEditing) {
                        onSave();
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select rail type...</option>
                    <option value="GRIP_RAIL">Grip Rail</option>
                    <option value="TWO_LINE">2-Line</option>
                    <option value="THREE_LINE">3-Line</option>
                    <option value="FOUR_LINE">4-Line</option>
                    <option value="FIVE_LINE">5-Line</option>
                    <option value="SIX_LINE">6-Line</option>
                    <option value="SEVEN_LINE">7-Line</option>
                    <option value="EIGHT_LINE">8-Line</option>
                    <option value="NINE_LINE">9-Line</option>
                    <option value="CABLE_RAIL">Cable Rail</option>
                    <option value="VERTICAL_PICKETS">Vertical Pickets</option>
                    <option value="HORIZONTAL_PICKETS">Horizontal Pickets</option>
                    <option value="WIRE_MESH">Wire Mesh Infill</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Material</label>
                  <select
                    value={(isEditing ? editingLine.railMaterial : line.railMaterial) || ""}
                    onChange={(e) => {
                      if (!isEditing) {
                        onEdit(line);
                      }
                      onChange("railMaterial", e.target.value || undefined, line);
                      if (isEditing) {
                        onSave();
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select material...</option>
                    <option value="SCH40_1_5">1-1/2" Sch 40 Pipe</option>
                    <option value="SCH80_1_5">1-1/2" Sch 80 Pipe</option>
                    <option value="OTHER">Other (Manual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Linear Feet (LF)</label>
                  {renderField("Rail Length", "railLengthFt", "number")}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Finish <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  {renderField("Rail Finish", "railFinish", "text")}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cost per LF ($)</label>
                  {renderField("Cost per LF", "assemblyCostPerUnit", "number")}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Total Labor Hours <span className="text-gray-500 text-xs">(manual override)</span>
                  </label>
                  {renderField("Assembly Labor Hours", "assemblyLaborHours", "number")}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Lump Sum Total ($) <span className="text-gray-500 text-xs">(overrides calculations)</span>
                  </label>
                  {renderField("Assembly Total Cost", "assemblyTotalCost", "number")}
                </div>
              </div>
            </div>
          )}

          {/* Assembly Mode Warning */}
          {(isEditing ? editingLine.workType : line.workType) === "MISC" &&
           (isEditing ? editingLine.miscMethod : line.miscMethod) === "ASSEMBLY" && (
            <div className="lg:col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Assembly Mode:</strong> Weight-per-foot calculations are disabled. 
                Use assembly-specific inputs above to estimate cost.
              </p>
            </div>
          )}

        {/* Material Section - Plate */}
        {materialType === "Plate" && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60">Plate Material</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("thickness")}.</span> Thickness (in)
                </label>
                {renderField("Thickness", "thickness", "select", plateThicknessOptions)}
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
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("plateGrade")}.</span> Grade
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPlateGradeInfo(!showPlateGradeInfo);
                      }}
                      className="text-blue-500 hover:text-blue-700 transition-colors"
                      title="View plate grade information"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {showPlateGradeInfo && (
                      <div
                        ref={plateGradeInfoRef}
                        className="absolute left-0 top-6 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-xl p-4 text-xs"
                        style={{ maxHeight: "400px", overflowY: "auto" }}
                      >
                        <div className="font-semibold text-sm text-gray-900 mb-3 pb-2 border-b">
                          Plate Grade Reference
                        </div>
                        <div className="space-y-4">
                          {availableGrades.map((grade) => {
                            const gradeInfo = getPlateGradeInfo(grade);
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
            
            {/* Hardware Section - Collapsible within Plate */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setHardwareExpanded(!hardwareExpanded)}
                className="flex items-center justify-between w-full mb-3 bg-gray-50/80 rounded-lg px-4 py-2.5 shadow-sm border border-gray-200/60 hover:bg-gray-100/90 transition-all"
              >
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-600" />
                  Hardware
                </h4>
                <div className="flex items-center gap-2">
                  {currentLine.hardwareQuantity && currentLine.hardwareCostPerSet ? (
                    <span className="text-xs text-gray-600">
                      {currentLine.hardwareQuantity} sets × ${currentLine.hardwareCostPerSet.toFixed(2)} = ${((currentLine.hardwareQuantity || 0) * (currentLine.hardwareCostPerSet || 0)).toFixed(2)}
                    </span>
                  ) : currentLine.hardwareBoltDiameter && currentLine.hardwareBoltType ? (
                    <span className="text-xs text-gray-600">
                      {currentLine.hardwareBoltDiameter}" {currentLine.hardwareBoltType}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No hardware</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${hardwareExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {hardwareExpanded && isManualMode && (
                <div className="space-y-3 mt-3">
                  {/* Quantity - First Field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <span className="text-blue-600 font-bold">{getNumberFromField("hardwareQuantity")}.</span> Quantity (Bolt Sets)
                      {numberOfHoles && numberOfHoles > 0 && (
                        <span className="text-blue-600 text-xs ml-1">
                          (Auto from {numberOfHoles} holes)
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={currentLine.hardwareQuantity || ""}
                      onChange={(e) => {
                        if (!isEditing) {
                          onEdit(line);
                        }
                        const qty = parseFloat(e.target.value) || 0;
                        onChange("hardwareQuantity", qty, line);
                        setTimeout(() => {
                          if (isEditing || editingId === line.id) {
                            onSave();
                          }
                        }, 100);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>

                  {/* Bolt Diameter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <span className="text-blue-600 font-bold">{getNumberFromField("hardwareBoltDiameter")}.</span> Bolt Diameter
                    </label>
                    <select
                      value={currentLine.hardwareBoltDiameter || ""}
                      onChange={(e) => {
                        if (!isEditing) {
                          onEdit(line);
                        }
                        onChange("hardwareBoltDiameter", e.target.value, line);
                        setTimeout(() => {
                          if (isEditing || editingId === line.id) {
                            onSave();
                          }
                        }, 100);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Diameter...</option>
                      {["1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "7/8", "1", "1-1/8", "1-1/4", "1-3/8", "1-1/2"].map((diameter) => (
                        <option key={diameter} value={diameter}>
                          {diameter}"
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bolt Type/Grade */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <span className="text-blue-600 font-bold">{getNumberFromField("hardwareBoltType")}.</span> Bolt Type / Grade
                    </label>
                    <select
                      value={currentLine.hardwareBoltType || ""}
                      onChange={(e) => {
                        if (!isEditing) {
                          onEdit(line);
                        }
                        onChange("hardwareBoltType", e.target.value, line);
                        setTimeout(() => {
                          if (isEditing || editingId === line.id) {
                            onSave();
                          }
                        }, 100);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Type...</option>
                      {["A325", "A490", "A307", "A193 B7", "A193 B16", "A194 2H", "A194 2HM", "A563", "F1554 Gr36", "F1554 Gr55", "F1554 Gr105", "Anchor Bolt", "Other"].map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bolt Length (Optional) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <span className="text-blue-600 font-bold">{getNumberFromField("hardwareBoltLength")}.</span> Bolt Length (in) <span className="text-gray-500 text-xs">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      value={currentLine.hardwareBoltLength || ""}
                      onChange={(e) => {
                        if (!isEditing) {
                          onEdit(line);
                        }
                        const length = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        onChange("hardwareBoltLength", length, line);
                        setTimeout(() => {
                          if (isEditing || editingId === line.id) {
                            onSave();
                          }
                        }, 100);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Auto (standard length)"
                      step="0.25"
                      min="0"
                    />
                  </div>

                  {/* Cost per Set */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <span className="text-blue-600 font-bold">{getNumberFromField("hardwareCostPerSet")}.</span> Cost per Set (Bolt + Nut + Washer)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        value={currentLine.hardwareCostPerSet || ""}
                        onChange={(e) => {
                          if (!isEditing) {
                            onEdit(line);
                          }
                          const cost = parseFloat(e.target.value) || 0;
                          onChange("hardwareCostPerSet", cost, line);
                          setTimeout(() => {
                            if (isEditing || editingId === line.id) {
                              onSave();
                            }
                          }, 100);
                        }}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}
              {!isManualMode && (
                <div className="text-gray-700 text-sm mt-2">
                  {currentLine.hardwareBoltDiameter && currentLine.hardwareBoltType ? (
                    <div>
                      {currentLine.hardwareBoltDiameter}" {currentLine.hardwareBoltType} × {currentLine.hardwareQuantity || 0} = ${(currentLine.hardwareCost || 0).toFixed(2)}
                    </div>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coating Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60">Coating</h4>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <span className="text-blue-600 font-bold">{getNumberFromField("sspcPrep")}.</span> SSPC Surface Prep
            </label>
            {renderField("SSPC Prep", "sspcPrep", "select", sspcPrepOptions)}
          </div>
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
            <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60 flex-1">Labor Breakdown</h4>
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
                <CollapsibleLaborInput
                  value={currentLine.laborDrillPunch || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborDrillPunch", value, line);
                  }}
                  label="Drill/Punch"
                  onNumberOfHolesChange={(holes) => {
                    setNumberOfHoles(holes);
                    // Auto-populate hardware quantity if not already set
                    if (holes > 0 && (!currentLine.hardwareQuantity || currentLine.hardwareQuantity === 0)) {
                      if (!isEditing) {
                        onEdit(line);
                      }
                      onChange("hardwareQuantity", holes, line);
                    }
                  }}
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
                <CollapsibleLaborInput
                  value={currentLine.laborWeld || 0}
                  onChange={(value) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("laborWeld", value, line);
                  }}
                  label="Weld"
                  weldLengthFt={currentLine.lengthFt}
                  weldLengthIn={currentLine.lengthIn}
                  qty={currentLine.qty || 1}
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
          <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60">Cost Breakdown</h4>
          <div className="grid grid-cols-2 gap-4">
            {/* Material Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">Material Rate ($/lb)</label>
                <div className="flex items-center gap-1">
                  {materialRateLocked ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {materialRateSource} Default
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        {isMaterialRateOverridden ? "Override" : "Unlocked"}
                      </span>
                      {isMaterialRateOverridden && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("materialRate", defaultMaterialRate, line);
                            setMaterialRateLocked(true);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                          title={`Reset to ${materialRateSource.toLowerCase()} default: $${defaultMaterialRate.toFixed(2)}`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (materialRateLocked) {
                        setMaterialRateLocked(false);
                        if (!isEditing) {
                          onEdit(line);
                        }
                      } else {
                        // Lock and reset to default if not overridden
                        if (!isMaterialRateOverridden) {
                          if (!isEditing) {
                            onEdit(line);
                          }
                          onChange("materialRate", defaultMaterialRate, line);
                          setTimeout(() => {
                            if (isEditing || editingId === line.id) {
                              onSave();
                            }
                          }, 100);
                        }
                        setMaterialRateLocked(true);
                      }
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1 transition-colors ml-1"
                    title={materialRateLocked ? "Unlock to edit" : "Lock to use default"}
                  >
                    {materialRateLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {renderField("Mat Rate", "materialRate", "number", undefined, materialRateLocked)}
              <div className="text-[10px] text-gray-500 mt-0.5">
                {materialRateSource} Default: ${defaultMaterialRate.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Cost</label>
              {renderField("Mat Cost", "materialCost", "number", undefined, true)}
            </div>
            
            {/* Labor Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">Labor Rate ($/hr)</label>
                <div className="flex items-center gap-1">
                  {laborRateLocked ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {laborRateSource} Default
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        {isLaborRateOverridden ? "Override" : "Unlocked"}
                      </span>
                      {isLaborRateOverridden && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("laborRate", defaultLaborRate, line);
                            setLaborRateLocked(true);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                          title={`Reset to ${laborRateSource.toLowerCase()} default: $${defaultLaborRate.toFixed(2)}`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (laborRateLocked) {
                        setLaborRateLocked(false);
                        if (!isEditing) {
                          onEdit(line);
                        }
                      } else {
                        // Lock and reset to default if not overridden
                        if (!isLaborRateOverridden) {
                          if (!isEditing) {
                            onEdit(line);
                          }
                          onChange("laborRate", defaultLaborRate, line);
                          setTimeout(() => {
                            if (isEditing || editingId === line.id) {
                              onSave();
                            }
                          }, 100);
                        }
                        setLaborRateLocked(true);
                      }
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1 transition-colors ml-1"
                    title={laborRateLocked ? "Unlock to edit" : "Lock to use default"}
                  >
                    {laborRateLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {renderField("Lab Rate", "laborRate", "number", undefined, laborRateLocked)}
              <div className="text-[10px] text-gray-500 mt-0.5">
                {laborRateSource} Default: ${defaultLaborRate.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Labor Cost</label>
              {renderField("Lab Cost", "laborCost", "number", undefined, true)}
            </div>
            
            {/* Coating Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">Coating Rate</label>
                <div className="flex items-center gap-1">
                  {coatingRateLocked ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {coatingRateSource} Default
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        {isCoatingRateOverridden ? "Override" : "Unlocked"}
                      </span>
                      {isCoatingRateOverridden && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditing) {
                              onEdit(line);
                            }
                            onChange("coatingRate", defaultCoatingRate, line);
                            setCoatingRateLocked(true);
                            setTimeout(() => {
                              if (isEditing || editingId === line.id) {
                                onSave();
                              }
                            }, 100);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                          title={`Reset to ${coatingRateSource.toLowerCase()} default: $${defaultCoatingRate.toFixed(2)}`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (coatingRateLocked) {
                        setCoatingRateLocked(false);
                        if (!isEditing) {
                          onEdit(line);
                        }
                      } else {
                        // Lock and reset to default if not overridden
                        if (!isCoatingRateOverridden) {
                          if (!isEditing) {
                            onEdit(line);
                          }
                          onChange("coatingRate", defaultCoatingRate, line);
                          setTimeout(() => {
                            if (isEditing || editingId === line.id) {
                              onSave();
                            }
                          }, 100);
                        }
                        setCoatingRateLocked(true);
                      }
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1 transition-colors ml-1"
                    title={coatingRateLocked ? "Unlock to edit" : "Lock to use default"}
                  >
                    {coatingRateLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {renderField("Coat Rate", "coatingRate", "number", undefined, coatingRateLocked)}
              <div className="text-[10px] text-gray-500 mt-0.5">
                {coatingRateSource} Default: ${defaultCoatingRate.toFixed(2)}
              </div>
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
        </div>

        {/* Admin Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700 bg-gray-50/80 rounded-lg px-4 py-2.5 mb-4 shadow-sm border border-gray-200/60">Admin & Notes</h4>
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
            
            {/* Main Member / Small Part Grouping */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <span className="text-blue-600 font-bold">{getNumberFromField("isMainMember")}.</span> Main Member
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentLine.isMainMember || false}
                  onChange={(e) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("isMainMember", e.target.checked, line);
                    // If unchecking main member, clear parentLineId if this was a parent
                    if (!e.target.checked) {
                      onChange("parentLineId", undefined, line);
                    }
                    setTimeout(() => {
                      if (isEditing || editingId === line.id) {
                        onSave();
                      }
                    }, 100);
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600">Mark as main member (e.g., column, beam)</span>
              </div>
            </div>
            
            {!currentLine.isMainMember && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-blue-600 font-bold">{getNumberFromField("parentLineId")}.</span> Parent Main Member
                </label>
                <select
                  value={currentLine.parentLineId || ""}
                  onChange={(e) => {
                    if (!isEditing) {
                      onEdit(line);
                    }
                    onChange("parentLineId", e.target.value || undefined, line);
                    setTimeout(() => {
                      if (isEditing || editingId === line.id) {
                        onSave();
                      }
                    }, 100);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select main member...</option>
                  {lines
                    .filter(l => l.isMainMember && l.lineId !== line.lineId && l.status !== "Void")
                    .map(mainMember => (
                      <option key={mainMember.lineId} value={mainMember.lineId}>
                        {mainMember.lineId} - {mainMember.itemDescription || "Untitled"}
                      </option>
                    ))}
                </select>
                <div className="text-[10px] text-gray-500 mt-1">
                  Link this small part (e.g., base plate, shear tab) to a main member
                </div>
              </div>
            )}
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

      {/* Bottom Collapse Button */}
      {onCollapse && (
        <div className="sticky bottom-0 z-20 -mb-6 -mx-6 mt-4 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent">
          <button
            onClick={onCollapse}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-gray-600 hover:text-gray-800 bg-gray-50/80 hover:bg-gray-100/90 rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md border border-gray-200/60"
            title="Collapse detail view"
          >
            <ChevronDown className="w-4 h-4" />
            <span>Collapse</span>
          </button>
        </div>
      )}
    </div>
  );
}

