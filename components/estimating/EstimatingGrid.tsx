"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus, Upload, Edit, Trash2, Copy, Check, X, Undo2, Redo2, Download, Layers, ChevronDown, ChevronUp } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getDocRef } from "@/lib/firebase/firestore";
import { deleteField, getDoc } from "firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getFieldFromNumber, parseNumberFieldFormat } from "@/lib/utils/fieldNumberMap";
import { useUndoRedo } from "@/lib/hooks/useUndoRedo";
import { 
  getShapesByType, 
  getWeightPerFoot, 
  getSurfaceAreaPerFoot, 
  getValidGrades,
  SHAPE_TYPES,
  type ShapeType 
} from "@/lib/utils/aiscShapes";
import { 
  calculatePlateProperties, 
  type PlateDimensions 
} from "@/lib/utils/plateHelper";
import {
  convertThicknessInputToInches,
  getThicknessLabelFromInches,
} from "@/lib/utils/plateDatabase";
import { 
  downloadCSVTemplate,
  exportLinesToCSV, 
  parseCSVFile, 
  type CSVValidationError 
} from "@/lib/utils/csvImport";
import EstimatingGridCompact from "./EstimatingGridCompact";
import {
  loadCompanySettings,
  loadProjectSettings,
  getMaterialRateForGrade,
  getLaborRate,
  getCoatingRate,
  calculateTotalCostWithMarkup,
  type CompanySettings,
  type ProjectSettings,
} from "@/lib/utils/settingsLoader";
import { detectConflicts, resolveConflicts, smartMerge } from "@/lib/utils/conflictResolution";

// Expanded Estimating Line Interface
export interface EstimatingLine {
  id?: string;
  
  // A) Identification
  lineId: string; // Auto sequence
  drawingNumber: string;
  detailNumber: string;
  itemDescription: string;
  elevation?: string; // Foundation, Exterior Ground Level, First Floor, Roof, High Roof, etc.
  category: string; // Columns, Beams, Misc Metals, Plates, etc.
  subCategory: string; // Base Plate, Gusset, Stiffener, Clip, etc.
  
  // Work Type Classification
  workType?: "STRUCTURAL" | "MISC"; // Default: "STRUCTURAL"
  miscMethod?: "DETAILED" | "ASSEMBLY"; // Only when workType = MISC, default: "ASSEMBLY"
  miscSubtype?: string; // Expanded misc metals category - see lib/data/miscMetalsCategories.ts
  
  // Assembly Mode Fields (only when miscMethod = ASSEMBLY)
  // Stairs
  stairTreads?: number;
  stairLandings?: number;
  stairWidth?: number;
  stairRailIncluded?: boolean;
  
  // Rails
  railType?: "GRIP_RAIL" | "TWO_LINE" | "THREE_LINE" | "FOUR_LINE" | "FIVE_LINE" | "SIX_LINE" | "SEVEN_LINE" | "EIGHT_LINE" | "NINE_LINE" | "CABLE_RAIL" | "VERTICAL_PICKETS" | "HORIZONTAL_PICKETS" | "WIRE_MESH";
  railMaterial?: "SCH40_1_5" | "SCH80_1_5" | "OTHER";
  railLengthFt?: number;
  railFinish?: string;
  
  // Assembly Cost Overrides
  assemblyCostPerUnit?: number;
  assemblyLaborHours?: number;
  assemblyMaterialCost?: number;
  assemblyTotalCost?: number;
  
  // Material Type
  materialType: "Material" | "Plate"; // Determines which fields to show
  
  // B) Material - Structural Members (when materialType = "Material")
  shapeType?: ShapeType; // W, HSS, C, L, T, etc.
  sizeDesignation?: string; // e.g., W12x65
  grade?: string; // A992, A572 Gr50, etc.
  lengthFt?: number;
  lengthIn?: number;
  qty?: number;
  weightPerFoot?: number; // Read-only from AISC
  totalWeight?: number; // Read-only
  surfaceAreaPerFoot?: number; // Read-only from AISC
  totalSurfaceArea?: number; // Read-only
  
  // C) Material - Plates (when materialType = "Plate")
  thickness?: number; // inches (decimal)
  width?: number; // inches
  plateLength?: number; // inches
  plateArea?: number; // Read-only (sf)
  edgePerimeter?: number; // Read-only (ft)
  plateSurfaceArea?: number; // Read-only (sf)
  oneSideCoat?: boolean;
  plateGrade?: string;
  plateQty?: number;
  plateTotalWeight?: number; // Read-only
  
  // Coating
  coatingSystem?: string; // None, Paint, Powder, Galv
  sspcPrep?: string; // SSPC surface preparation standard
  
  // D) Labor (applies to any line type)
  laborUnload?: number;
  laborCut?: number;
  laborCope?: number;
  laborProcessPlate?: number;
  laborDrillPunch?: number;
  laborFit?: number;
  laborWeld?: number;
  laborPrepClean?: number;
  laborPaint?: number;
  laborHandleMove?: number;
  laborLoadShip?: number;
  totalLabor?: number; // Read-only
  
  // E) Hardware & Connections (applies to any line type)
  hardwareBoltDiameter?: string; // e.g., "3/4", "1", "1-1/4"
  hardwareBoltType?: string; // A325, A490, A307, A193 B7, etc.
  hardwareBoltLength?: number; // inches (optional)
  hardwareQuantity?: number; // Number of bolt sets (auto from holes or manual)
  hardwareCostPerSet?: number; // Cost per bolt set (bolt + nut + washer)
  hardwareCost?: number; // Read-only: quantity × cost per set
  
  // F) Cost (applies to any line type)
  materialRate?: number; // $/lb (from Company Defaults, override allowed)
  materialCost?: number; // Read-only
  laborRate?: number; // $/hr (from Company Defaults, override allowed)
  laborCost?: number; // Read-only
  coatingRate?: number; // $/sf for Paint/Powder or $/lb for Galv
  coatingCost?: number; // Read-only
  totalCost?: number; // Read-only: material + labor + coating + hardware
  
  // F) Admin / Controls
  notes?: string;
  hashtags?: string;
  status?: "Active" | "Void";
  useStockRounding?: boolean; // Toggle for exact vs stock length
  
  // G) Member Grouping
  isMainMember?: boolean; // true = main member, false/undefined = small part or ungrouped
  parentLineId?: string; // Line ID of the main member this small part belongs to
}

interface EstimatingGridProps {
  companyId: string;
  projectId: string;
  isManualMode?: boolean;
  highlightLineId?: string | null;
  onAddLineRef?: (handler: (() => void) | null) => void;
}

export default function EstimatingGrid({ companyId, projectId, isManualMode = false, highlightLineId, onAddLineRef }: EstimatingGridProps) {
  // Undo/Redo state management
  const {
    state: lines,
    setState: setLines,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<EstimatingLine[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<Partial<EstimatingLine>>({});
  const [groupByMainMember, setGroupByMainMember] = useState<boolean>(false);
  const [showAllLines, setShowAllLines] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("lineId");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const highlightedLineRef = useRef<HTMLTableRowElement | null>(null);
  
  // Track if we should add to history (skip for Firestore updates)
  const skipHistoryRef = useRef(false);
  
  // Guard to prevent multiple simultaneous line additions
  const isAddingLineRef = useRef(false);
  
  // Handle highlighting and scrolling to line from URL parameter
  useEffect(() => {
    if (highlightLineId && lines.length > 0) {
      // Find the line
      const line = lines.find(l => l.id === highlightLineId);
      if (line) {
        // Set editing state to make it editable
        if (editingId !== line.id && line.id) {
          setEditingId(line.id);
          setEditingLine(line);
        }
        // Scroll to the line after a short delay to allow DOM to update
        setTimeout(() => {
          const element = document.getElementById(`line-${line.id}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            // Add highlight class temporarily
            element.classList.add("bg-yellow-100");
            setTimeout(() => {
              element.classList.remove("bg-yellow-100");
            }, 3000);
          }
        }, 300);
      }
    }
  }, [highlightLineId, lines, editingId]);
  
  // Group lines by main member
  const groupLinesByMainMember = (linesToGroup: EstimatingLine[]): EstimatingLine[] => {
    // Separate main members and small parts
    const mainMembers = linesToGroup.filter(l => l.isMainMember && l.status !== "Void");
    const smallParts = linesToGroup.filter(l => !l.isMainMember && l.parentLineId && l.status !== "Void");
    const ungrouped = linesToGroup.filter(l => !l.isMainMember && !l.parentLineId && l.status !== "Void");
    
    // Sort main members by lineId
    mainMembers.sort((a, b) => {
      const aNum = parseInt(a.lineId.replace('L', '')) || 0;
      const bNum = parseInt(b.lineId.replace('L', '')) || 0;
      return aNum - bNum;
    });
    
    // Group small parts under their main members
    const grouped: EstimatingLine[] = [];
    
    mainMembers.forEach(mainMember => {
      // Add main member
      grouped.push(mainMember);
      
      // Add associated small parts
      const associatedParts = smallParts
        .filter(part => part.parentLineId === mainMember.lineId)
        .sort((a, b) => {
          const aNum = parseInt(a.lineId.replace('L', '')) || 0;
          const bNum = parseInt(b.lineId.replace('L', '')) || 0;
          return aNum - bNum;
        });
      
      grouped.push(...associatedParts);
    });
    
    // Add ungrouped lines at the end
    ungrouped.sort((a, b) => {
      const aNum = parseInt(a.lineId.replace('L', '')) || 0;
      const bNum = parseInt(b.lineId.replace('L', '')) || 0;
      return aNum - bNum;
    });
    grouped.push(...ungrouped);
    
    // Add voided lines at the very end
    const voided = linesToGroup.filter(l => l.status === "Void");
    grouped.push(...voided);
    
    return grouped;
  };
  
  // Sort lines by line ID (helper function)
  const sortLinesByLineId = (linesToSort: EstimatingLine[]): EstimatingLine[] => {
    // Separate active and voided lines
    const activeLines = linesToSort.filter(l => l.status !== "Void");
    const voidedLines = linesToSort.filter(l => l.status === "Void");
    
    // Sort active lines by line ID
    const sortedActive = [...activeLines].sort((a, b) => {
      const aNum = parseInt(a.lineId.replace('L', '')) || 0;
      const bNum = parseInt(b.lineId.replace('L', '')) || 0;
      return aNum - bNum;
    });
    
    // Sort voided lines by line ID
    const sortedVoided = [...voidedLines].sort((a, b) => {
      const aNum = parseInt(a.lineId.replace('L', '')) || 0;
      const bNum = parseInt(b.lineId.replace('L', '')) || 0;
      return aNum - bNum;
    });
    
    // Return active lines first, then voided lines
    return [...sortedActive, ...sortedVoided];
  };
  
  // Get display lines (grouped or sorted by line ID)
  let allDisplayLines = groupByMainMember ? groupLinesByMainMember(lines) : sortLinesByLineId(lines);
  
  // Apply custom sorting if specified
  if (sortBy && sortBy !== "lineId") {
    allDisplayLines = [...allDisplayLines].sort((a, b) => {
      let aVal: any = (a as any)[sortBy];
      let bVal: any = (b as any)[sortBy];
      
      // Handle numeric values
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string values
      aVal = aVal?.toString().toLowerCase() || "";
      bVal = bVal?.toString().toLowerCase() || "";
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  } else if (sortBy === "lineId" && sortDirection === "desc") {
    // Reverse lineId sort if descending
    allDisplayLines = [...allDisplayLines].reverse();
  }
  
  // Rollup: Show last 5 entries by default, or all if expanded
  const displayLines = useMemo(() => {
    if (showAllLines || allDisplayLines.length <= 5) {
      return allDisplayLines;
    }
    // Show last 5 entries
    return allDisplayLines.slice(-5);
  }, [allDisplayLines, showAllLines]);

  // Auto-scroll to bottom when showing last 5 entries (default view)
  const gridContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAllLines && allDisplayLines.length > 5 && displayLines.length === 5) {
      // Small delay to ensure DOM is updated with the last 5 entries
      const timeoutId = setTimeout(() => {
        if (gridContainerRef.current) {
          // Find the scrollable container inside EstimatingGridCompact
          const scrollableArea = gridContainerRef.current.querySelector('div[class*="overflow-y-auto"]') as HTMLElement;
          if (scrollableArea) {
            // Scroll to bottom to show the last 5 entries
            scrollableArea.scrollTop = scrollableArea.scrollHeight;
          }
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [showAllLines, allDisplayLines.length, displayLines.length]);
  
  // Handle sort change
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortDirection("asc");
    }
  };
  
  // Debounce save operations
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // CSV import file input ref
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  
  // Load settings from Firestore
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadCompanySettings(companyId).then(setCompanySettings);
    loadProjectSettings(companyId, projectId).then(setProjectSettings);
  }, [companyId, projectId]);

  // Track number being entered for multi-digit field navigation (Ctrl+Alt+number)
  const numberBufferRef = useRef<string>("");
  const numberTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcuts for undo/redo and field navigation
  useEffect(() => {
    if (!isManualMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Field navigation shortcuts: Ctrl+Alt+number (supports multi-digit like 10, 11, 12, etc.)
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || 
                          target.tagName === "TEXTAREA" || 
                          target.tagName === "SELECT" ||
                          target.isContentEditable ||
                          target.closest('input, textarea, select');
      
      // Only work when a row is expanded or being edited
      const hasActiveRow = editingId;
      
      // Ctrl+Alt+number - allows multi-digit entry (e.g., Ctrl+Alt+1 then 0 = field 10)
      if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && e.key.length === 1 && /^[0-9]$/.test(e.key) && hasActiveRow) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Add digit to buffer
        numberBufferRef.current += e.key;
        
        // Clear existing timeout
        if (numberTimeoutRef.current) {
          clearTimeout(numberTimeoutRef.current);
        }
        
        // Set timeout to process after 500ms of no input (allows time for second digit)
        numberTimeoutRef.current = setTimeout(() => {
          const number = parseInt(numberBufferRef.current, 10);
          if (number > 0 && number <= 50) { // Max field number
            // Get material type from the expanded row or editing line
            const targetLine = lines.find(l => l.id === editingId);
            const materialType = targetLine?.materialType || editingLine.materialType as "Material" | "Plate" | undefined;
            const field = getFieldFromNumber(number, materialType);
            
            if (field && editingId) {
              // Find the input field in the table row
              const inputId = `field-${editingId}-${field}`;
              let inputElement = document.getElementById(inputId) as HTMLElement;
              
              // If not found by ID, try data attributes
              if (!inputElement) {
                inputElement = document.querySelector(`[data-field="${field}"][data-line-id="${editingId}"]`) as HTMLElement;
              }
              
              // For labor fields, the container div has the ID, so find the first input inside it
              if (inputElement && !(inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement || inputElement instanceof HTMLSelectElement)) {
                const nestedInput = inputElement.querySelector('input, textarea, select') as HTMLElement;
                if (nestedInput) {
                  inputElement = nestedInput;
                }
              }
              
              if (inputElement) {
                inputElement.focus();
                if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement || inputElement instanceof HTMLSelectElement) {
                  // Select text if it's a text input
                  if (inputElement instanceof HTMLInputElement && inputElement.type !== "checkbox") {
                    inputElement.select();
                  }
                }
              }
            }
          }
          // Clear buffer after processing
          numberBufferRef.current = "";
        }, 500);
        
        return;
      }
      
      // If Ctrl+Alt is released, process immediately
      if (!e.ctrlKey && !e.metaKey && !e.altKey && numberBufferRef.current.length > 0) {
        // Clear timeout and process immediately
        if (numberTimeoutRef.current) {
          clearTimeout(numberTimeoutRef.current);
          numberTimeoutRef.current = null;
        }
        
        const number = parseInt(numberBufferRef.current, 10);
        if (number > 0 && number <= 50) {
          const targetLine = lines.find(l => l.id === editingId);
          const materialType = targetLine?.materialType || editingLine.materialType as "Material" | "Plate" | undefined;
          const field = getFieldFromNumber(number, materialType);
          
          if (field && editingId) {
            // Find the input field in the table row
            const inputId = `field-${editingId}-${field}`;
            let inputElement = document.getElementById(inputId) as HTMLElement;
            
            // If not found by ID, try data attributes
            if (!inputElement) {
              inputElement = document.querySelector(`[data-field="${field}"][data-line-id="${editingId}"]`) as HTMLElement;
            }
            
            // For labor fields, the container div has the ID, so find the first input inside it
            if (inputElement && !(inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement || inputElement instanceof HTMLSelectElement)) {
              const nestedInput = inputElement.querySelector('input, textarea, select') as HTMLElement;
              if (nestedInput) {
                inputElement = nestedInput;
              }
            }
            
            if (inputElement) {
              inputElement.focus();
              if (inputElement instanceof HTMLInputElement && inputElement.type !== "checkbox") {
                inputElement.select();
              }
            }
          }
        }
        numberBufferRef.current = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (numberTimeoutRef.current) {
        clearTimeout(numberTimeoutRef.current);
      }
      numberBufferRef.current = "";
    };
  }, [isManualMode, canUndo, canRedo, undo, redo, editingId, editingLine.materialType, lines]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.warn("Firebase is not configured. Estimating grid data is unavailable until configuration is complete.");
      skipHistoryRef.current = true;
      setLines([], false);
      return () => {};
    }

    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        skipHistoryRef.current = true; // Don't add Firestore updates to history
        setLines(data, false);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId, setLines]);

  // Calculate read-only fields when editing
  // Use a ref to track if we're in the middle of a calculation to prevent infinite loops
  const calculatingRef = useRef(false);
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCalculatedRef = useRef<string>("");
  
  useEffect(() => {
    if (!editingId || !editingLine || Object.keys(editingLine).length === 0) return;
    if (!companySettings) return; // Wait for settings to load
    if (calculatingRef.current) {
      return; // Prevent infinite loops
    }
    
    // Debounce calculations to avoid running on every keystroke
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
    }
    
    calculationTimeoutRef.current = setTimeout(() => {
      if (calculatingRef.current) return;
      
      // Create a hash of the fields that affect calculations to avoid unnecessary recalculations
      const calculationKey = JSON.stringify({
        sizeDesignation: editingLine.sizeDesignation,
        lengthFt: editingLine.lengthFt,
        lengthIn: editingLine.lengthIn,
        qty: editingLine.qty,
        materialType: editingLine.materialType,
        thickness: editingLine.thickness,
        width: editingLine.width,
        plateLength: editingLine.plateLength,
        plateQty: editingLine.plateQty,
        oneSideCoat: editingLine.oneSideCoat,
        laborUnload: editingLine.laborUnload,
        laborCut: editingLine.laborCut,
        laborCope: editingLine.laborCope,
        laborProcessPlate: editingLine.laborProcessPlate,
        laborDrillPunch: editingLine.laborDrillPunch,
        laborFit: editingLine.laborFit,
        laborWeld: editingLine.laborWeld,
        laborPrepClean: editingLine.laborPrepClean,
        laborPaint: editingLine.laborPaint,
        laborHandleMove: editingLine.laborHandleMove,
        laborLoadShip: editingLine.laborLoadShip,
        coatingSystem: editingLine.coatingSystem,
        grade: editingLine.grade,
        plateGrade: editingLine.plateGrade,
        hardwareQuantity: editingLine.hardwareQuantity,
        hardwareCostPerSet: editingLine.hardwareCostPerSet,
      });
      
      // Skip if nothing that affects calculations has changed
      if (lastCalculatedRef.current === calculationKey) {
        return;
      }
      
      lastCalculatedRef.current = calculationKey;
      calculatingRef.current = true;
      
      const calculated = { ...editingLine };
      
      // For Material members - Auto-calculate weight from AISC data
      // This runs whenever sizeDesignation, lengthFt, lengthIn, or qty changes
      if (calculated.materialType === "Material" && calculated.sizeDesignation) {
        try {
        calculated.weightPerFoot = getWeightPerFoot(calculated.sizeDesignation);
        calculated.surfaceAreaPerFoot = getSurfaceAreaPerFoot(calculated.sizeDesignation);
        
        // Convert length to total feet (feet + inches/12)
        const lengthFt = calculated.lengthFt || 0;
        const lengthIn = calculated.lengthIn || 0;
        const lengthInFeet = lengthFt + (lengthIn / 12);
        
        // Recalculate weight whenever size, length, or quantity changes
        // Formula: weightPerFoot (lbs/ft) × lengthInFeet (ft) × qty = totalWeight (lbs)
        const qty = calculated.qty || 1;
        const calculatedWeight = (calculated.weightPerFoot || 0) * lengthInFeet * qty;
        
        // Always recalculate to fix any incorrect stored values (e.g., from old seed data)
        calculated.totalWeight = calculatedWeight; // Store in pounds (lbs)
        calculated.totalSurfaceArea = (calculated.surfaceAreaPerFoot || 0) * lengthInFeet * qty;
        
        // Debug log to help identify calculation issues
        if (calculatedWeight > 0 && calculated.totalWeight !== calculatedWeight) {
          console.log("Weight recalculated:", {
            weightPerFoot: calculated.weightPerFoot,
            lengthInFeet,
            qty,
            calculatedWeight,
            previousWeight: calculated.totalWeight
          });
        }
        
        // Weight calculation complete
        } catch (error) {
          console.warn("Error calculating weight for size:", calculated.sizeDesignation, error);
          // Keep existing values if calculation fails
        }
      } else if (calculated.materialType === "Material") {
        // If sizeDesignation is cleared, reset weight fields
        calculated.weightPerFoot = 0;
        calculated.totalWeight = 0;
        calculated.surfaceAreaPerFoot = 0;
        calculated.totalSurfaceArea = 0;
      }
      
      // For Plates - Auto-calculate weight
      if (calculated.materialType === "Plate") {
        const normalizedThickness = convertThicknessInputToInches(
          typeof calculated.thickness === "number" ? calculated.thickness : (calculated.thickness as string | undefined)
        );
        calculated.thickness = normalizedThickness;
        const plateProps = calculatePlateProperties({
          thickness: normalizedThickness || 0,
          width: Number(calculated.width) || 0,
          length: Number(calculated.plateLength) || 0,
          oneSideCoat: calculated.oneSideCoat || false,
        });
        const safeArea = Number.isFinite(plateProps.area) ? plateProps.area : 0;
        const safePerimeter = Number.isFinite(plateProps.edgePerimeter) ? plateProps.edgePerimeter : 0;
        const safeSurfaceArea = Number.isFinite(plateProps.surfaceArea) ? plateProps.surfaceArea : 0;
        const singlePlateWeight = Number.isFinite(plateProps.totalWeight) ? plateProps.totalWeight : 0;
        const plateQuantityRaw = calculated.plateQty ?? calculated.qty ?? 1;
        const plateQuantity = Number(plateQuantityRaw);
        const safeQuantity = Number.isFinite(plateQuantity) ? plateQuantity : 0;
        calculated.plateQty = safeQuantity;
        calculated.qty = safeQuantity;
        calculated.plateArea = safeArea;
        calculated.edgePerimeter = safePerimeter;
        calculated.plateSurfaceArea = safeSurfaceArea;
        calculated.plateTotalWeight = singlePlateWeight * safeQuantity;
      }
      
      // Calculate total labor
      const totalLabor = 
        (calculated.laborUnload || 0) +
        (calculated.laborCut || 0) +
        (calculated.laborCope || 0) +
        (calculated.laborProcessPlate || 0) +
        (calculated.laborDrillPunch || 0) +
        (calculated.laborFit || 0) +
        (calculated.laborWeld || 0) +
        (calculated.laborPrepClean || 0) +
        (calculated.laborPaint || 0) +
        (calculated.laborHandleMove || 0) +
        (calculated.laborLoadShip || 0);
      calculated.totalLabor = totalLabor;
      
      // Auto-populate rates from settings if not already set
      if (!calculated.materialRate) {
        const grade = calculated.materialType === "Material" ? calculated.grade : calculated.plateGrade;
        calculated.materialRate = projectSettings?.materialRate || getMaterialRateForGrade(grade, companySettings);
      }
      
      if (!calculated.laborRate) {
        calculated.laborRate = projectSettings?.laborRate || getLaborRate(undefined, companySettings);
      }
      
      if (!calculated.coatingRate) {
        calculated.coatingRate = projectSettings?.coatingRate || getCoatingRate(calculated.coatingSystem, companySettings);
      }
      
      // Calculate costs
      const totalWeight = calculated.materialType === "Material" 
        ? (calculated.totalWeight || 0)
        : (calculated.plateTotalWeight || 0);
      
      calculated.materialCost = totalWeight * (calculated.materialRate || 0);
      calculated.laborCost = (calculated.totalLabor || 0) * (calculated.laborRate || 0);
      
      // Hardware cost calculation
      const hardwareQty = calculated.hardwareQuantity || 0;
      const hardwareCostPerSet = calculated.hardwareCostPerSet || 0;
      calculated.hardwareCost = hardwareQty * hardwareCostPerSet;
      
      // Coating cost calculation
      // Galvanizing: cost per pound × total weight
      // Paint/Powder: cost per gallon × surface area (SF)
      // Other coatings: cost per SF × surface area
      const coatingSystem = calculated.coatingSystem;
      const surfaceArea = calculated.materialType === "Material"
        ? (calculated.totalSurfaceArea || 0)
        : (calculated.plateSurfaceArea || 0);
      
      // Only calculate coating cost if a coating system is actually selected
      if (!coatingSystem || coatingSystem === "None" || coatingSystem === "") {
        calculated.coatingCost = 0;
        calculated.coatingRate = undefined;
      } else if (coatingSystem === "Galvanizing" || coatingSystem === "Galv") {
        // Galvanizing is calculated per pound
        calculated.coatingCost = totalWeight * (calculated.coatingRate || 0);
      } else if (coatingSystem === "Paint" || coatingSystem === "Powder Coat" || coatingSystem === "Specialty Coating") {
        // Paint/Powder/Specialty: cost per gallon × surface area (SF)
        // coatingRate is in $/gallon, surfaceArea is in SF
        calculated.coatingCost = surfaceArea * (calculated.coatingRate || 0);
      } else if (coatingSystem === "Standard Shop Primer" || coatingSystem === "Zinc Primer") {
        // Primers: cost per SF × surface area
        calculated.coatingCost = surfaceArea * (calculated.coatingRate || 0);
      } else {
        // Unknown coating system: no cost
        calculated.coatingCost = 0;
      }
      
      // Calculate total cost with overhead and profit
      calculated.totalCost = calculateTotalCostWithMarkup(
        calculated.materialCost || 0,
        calculated.laborCost || 0,
        calculated.coatingCost || 0,
        calculated.hardwareCost || 0,
        companySettings,
        projectSettings || undefined
      );
      
      setEditingLine(calculated);
      
      // Reset the calculating flag after state update
      calculatingRef.current = false;
    }, 100); // Debounce by 100ms - only calculate after user stops typing
    
    return () => {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
    };
  }, [editingId, editingLine, companySettings, projectSettings]);

  const handleAddLine = () => {
    if (!isManualMode) {
      alert("Please enable Manual Entry Mode to add line items manually");
      return;
    }

    // Prevent multiple simultaneous additions
    if (isAddingLineRef.current) {
      console.warn("Already adding a line, please wait...");
      return;
    }

    isAddingLineRef.current = true;

    const newLine: Omit<EstimatingLine, "id"> = {
      lineId: `L${lines.length + 1}`,
      drawingNumber: "",
      detailNumber: "",
      itemDescription: "",
      category: "Structural",
      subCategory: "",
      workType: "STRUCTURAL", // Default to STRUCTURAL
      materialType: "Material",
      qty: 1,
      status: "Active",
      useStockRounding: true,
      materialRate: companySettings ? getMaterialRateForGrade(undefined, companySettings) : 0.85,
      laborRate: companySettings ? getLaborRate(undefined, companySettings) : 50,
      coatingRate: companySettings ? getCoatingRate(undefined, companySettings) : 2.50,
    };

    try {
      const linesPath = getProjectPath(companyId, projectId, "lines");
      createDocument(linesPath, newLine).then((newId) => {
        // Add to local state for immediate UI update
        const addedLine = { ...newLine, id: newId };
        setLines([...lines, addedLine], true); // Add to history
        
        // Reset the guard after a short delay to allow Firestore subscription to process
        setTimeout(() => {
          isAddingLineRef.current = false;
        }, 1000);
        
        // In manual mode, automatically start editing the new line
        if (isManualMode && newId) {
          setTimeout(() => {
            setEditingId(newId);
            setEditingLine(addedLine);
            
            // Scroll to the new line and focus the first editable field
            setTimeout(() => {
              const lineElement = document.getElementById(`line-${newId}`);
              if (lineElement) {
                lineElement.scrollIntoView({ 
                  behavior: "smooth", 
                  block: "center",
                  inline: "nearest"
                });
                setTimeout(() => {
                  // Focus the drawing number input in the table row
                  const drawingInput = lineElement.querySelector('input[placeholder="Drawing #"]') as HTMLInputElement;
                  if (drawingInput) {
                    drawingInput.focus();
                    drawingInput.select();
                  }
                }, 300);
              }
            }, 100);
          }, 50);
        }
      }).catch((error: any) => {
        console.error("Failed to add line:", error);
        alert("Firebase is not configured. Please set up Firebase credentials to save data.");
        isAddingLineRef.current = false; // Reset guard on error
      });
    } catch (error: any) {
      console.error("Failed to add line:", error);
      alert("Firebase is not configured. Please set up Firebase credentials to save data.");
      isAddingLineRef.current = false; // Reset guard on error
    }
  };

  // Store handleAddLine in a ref so we always expose the latest version without recreating the callback
  const handleAddLineRef = useRef(handleAddLine);
  handleAddLineRef.current = handleAddLine;

  // Expose handleAddLine to parent via ref callback
  // Use a stable wrapper function that calls the ref - this prevents infinite loops
  const stableHandleAddLine = useCallback(() => {
    handleAddLineRef.current();
  }, []); // Empty deps - function never changes, always calls latest handleAddLine via ref

  useEffect(() => {
    if (onAddLineRef) {
      onAddLineRef(stableHandleAddLine);
    }
    return () => {
      if (onAddLineRef) {
        onAddLineRef(null);
      }
    };
  }, [onAddLineRef, stableHandleAddLine]);

  const handleEdit = (line: EstimatingLine) => {
    // In manual mode, editing is automatic when fields are clicked
    // This function is called when a field is clicked to start editing
    if (!isManualMode) {
      return; // In voice mode, don't allow editing
    }
    // Only set editing if not already editing this line
    if (editingId !== line.id) {
      setEditingId(line.id!);
      setEditingLine({ ...line });
    }
  };

  const handleSave = async (immediate = false) => {
    if (!editingId) return;
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    const performSave = async () => {
      try {
        const linePath = getProjectPath(companyId, projectId, "lines");
        
        // Prepare data for save - ensure parentLineId and isMainMember are explicitly included
        // Firestore doesn't accept undefined, so we need to filter it out
        const currentLine = lines.find(l => l.id === editingId);
        
        // Merge current line data with editing line to ensure all fields are present
        const mergedLine = { ...currentLine, ...editingLine };
        
        // Build data to save, filtering out undefined values
        let dataToSave: any = {};
        
        // Copy all fields from mergedLine, but skip undefined values
        Object.keys(mergedLine).forEach((key) => {
          if (mergedLine[key as keyof EstimatingLine] !== undefined) {
            dataToSave[key] = mergedLine[key as keyof EstimatingLine];
          }
        });
        
        // Always explicitly handle grouping fields to ensure they're saved correctly
        // Handle isMainMember
        if (editingLine.isMainMember !== undefined) {
          dataToSave.isMainMember = editingLine.isMainMember === true;
        } else if (currentLine?.isMainMember !== undefined) {
          dataToSave.isMainMember = currentLine.isMainMember === true;
        }
        
        // Handle parentLineId - always include it explicitly to ensure persistence
        if (editingLine.parentLineId !== undefined) {
          // User is explicitly setting or clearing parentLineId
          if (editingLine.parentLineId && editingLine.parentLineId.trim() !== "") {
            dataToSave.parentLineId = editingLine.parentLineId;
          } else {
            // User is clearing it - use deleteField to remove from Firestore
            dataToSave.parentLineId = deleteField();
          }
        } else if (currentLine?.parentLineId) {
          // Preserve existing parentLineId if not being changed
          // Always include it to ensure it's persisted
          dataToSave.parentLineId = currentLine.parentLineId;
        }
        
        // Check for conflicts before saving
        if (editingLine.lineId) {
          const conflict = await detectConflicts(
            companyId,
            projectId,
            editingLine.lineId,
            dataToSave,
            lines // Pass current lines for efficiency
          );
          
          if (conflict && conflict.conflicts.length > 0) {
            // Resolve conflicts using smart merge
            const remoteLine = lines.find(l => l.lineId === editingLine.lineId);
            if (remoteLine) {
              dataToSave = smartMerge(dataToSave, remoteLine);
              console.log("Resolved conflicts using smart merge:", conflict.conflicts);
            }
          }
        }
        
        // Check if document exists before updating
        if (!editingId || !currentLine?.id) {
          // Document doesn't exist or line has no ID - create it instead
          const newId = await createDocument(linePath, dataToSave);
          console.log("Created new line document:", newId);
        } else {
          // Verify document exists before updating
          try {
            const docRef = getDocRef(`${linePath}/${editingId}`);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
              // Document doesn't exist - create it instead
              console.warn(`Document ${editingId} does not exist, creating new document`);
              await createDocument(linePath, { ...dataToSave, id: editingId });
            } else {
              // Document exists - update it
              await updateDocument(linePath, editingId, dataToSave);
            }
          } catch (checkError: any) {
            // If check fails, try to create instead
            console.warn("Error checking document existence, attempting to create:", checkError);
            await createDocument(linePath, dataToSave);
          }
        }
        // Don't clear editing state in manual mode - keep it editable
        // The line will be updated via Firestore subscription
      } catch (error: any) {
        console.error("Failed to save line:", error);
        if (isFirebaseConfigured()) {
          alert(`Failed to save: ${error.message}`);
        } else {
          alert("Firebase is not configured. Please set up Firebase credentials to save data.");
        }
      }
    };
    
    if (immediate) {
      await performSave();
    } else {
      // Debounce saves to avoid too frequent updates during typing
      saveTimeoutRef.current = setTimeout(performSave, 500);
    }
  };

  const handleCancel = () => {
    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setEditingId(null);
    setEditingLine({});
  };

  const handleDelete = async (lineId: string) => {
    if (confirm("Are you sure you want to delete this line?")) {
      try {
        // Find the line to get its document ID
        const lineToDelete = lines.find((l) => l.id === lineId);
        if (!lineToDelete || !lineToDelete.id) {
          console.error("Line not found or missing ID");
          return;
        }
        
        // Update local state immediately
        const updatedLines = lines.filter((l) => l.id !== lineId);
        setLines(updatedLines, true); // Add to history
        
        // Delete from Firestore using correct signature: (collectionPath, documentId)
        const linesPath = getProjectPath(companyId, projectId, "lines");
        await deleteDocument(linesPath, lineToDelete.id);
      } catch (error: any) {
        console.error("Failed to delete line:", error);
        alert("Firebase is not configured. Please set up Firebase credentials to delete data.");
      }
    }
  };

  const handleDuplicate = (line: EstimatingLine) => {
    const duplicated = { ...line };
    delete duplicated.id;
    duplicated.lineId = `L${lines.length + 1}`;
    duplicated.itemDescription = `${line.itemDescription} (Copy)`;
    
    try {
      const linesPath = getProjectPath(companyId, projectId, "lines");
      createDocument(linesPath, duplicated).then((newId) => {
        const addedLine = { ...duplicated, id: newId };
        setLines([...lines, addedLine], true); // Add to history
      });
    } catch (error: any) {
      console.error("Failed to duplicate line:", error);
      alert("Firebase is not configured. Please set up Firebase credentials to save data.");
    }
  };

  const handleChange = (field: keyof EstimatingLine, value: any, line?: EstimatingLine) => {
    const syncPlateQuantities = (target: Partial<EstimatingLine>, fallbackLine?: EstimatingLine) => {
      const materialType = target.materialType || fallbackLine?.materialType || editingLine.materialType;
      if (materialType === "Plate") {
        if (field === "qty" && typeof value === "number") {
          target.plateQty = value;
        } else if (field === "plateQty" && typeof value === "number") {
          target.qty = value;
        }
      }
    };

    if (field === "thickness") {
      value = convertThicknessInputToInches(value);
    }
    // If a line is provided and we're not editing it, start editing it first
    if (line && editingId !== line.id) {
      setEditingId(line.id!);
      const newEditingLine = { ...line, [field]: value };
      syncPlateQuantities(newEditingLine, line);
      // Auto-calculate hardware cost if hardwareQuantity or hardwareCostPerSet changed
      if (field === "hardwareQuantity" || field === "hardwareCostPerSet") {
        const qty = field === "hardwareQuantity" ? (value || 0) : (newEditingLine.hardwareQuantity || 0);
        const costPerSet = field === "hardwareCostPerSet" ? (value || 0) : (newEditingLine.hardwareCostPerSet || 0);
        newEditingLine.hardwareCost = qty * costPerSet;
      }
      setEditingLine(newEditingLine);
    } else {
      // Use functional update to avoid stale closures and optimize performance
      setEditingLine((prev) => {
        // Only create new object if value actually changed
        if (prev[field] === value) {
          return prev; // No change, return same reference
        }
        const updated = { ...prev, [field]: value };
        syncPlateQuantities(updated);
        
        // Auto-calculate hardware cost immediately when quantity or cost per set changes
        if (field === "hardwareQuantity" || field === "hardwareCostPerSet") {
          const qty = field === "hardwareQuantity" ? (value || 0) : (updated.hardwareQuantity || 0);
          const costPerSet = field === "hardwareCostPerSet" ? (value || 0) : (updated.hardwareCostPerSet || 0);
          updated.hardwareCost = qty * costPerSet;
        }
        
        return updated;
      });
      
      // Clear calculation cache for fields that affect calculations
      if (field === "sizeDesignation" || field === "lengthFt" || field === "lengthIn" || field === "qty" ||
          field === "materialType" || field === "thickness" || field === "width" || field === "plateLength" ||
          field === "plateQty" || field === "oneSideCoat" || field.startsWith("labor") || 
          field === "coatingSystem" || field === "grade" || field === "plateGrade" ||
          field === "hardwareQuantity" || field === "hardwareCostPerSet" || field === "hardwareCost") {
        // Invalidate cache to force recalculation
        lastCalculatedRef.current = "";
      }
    }
  };

  // Get available sizes for selected shape type
  const availableSizes = useMemo(() => {
    if (!editingLine.shapeType) return [];
    return getShapesByType(editingLine.shapeType).map(shape => shape["Member Size"]);
  }, [editingLine.shapeType]);

  // Calculate totals
  const totals = useMemo(() => {
    const activeLines = lines.filter(line => line.status !== "Void");
    return {
      totalWeight: activeLines.reduce((sum, line) => 
        sum + (line.materialType === "Material" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0)), 0
      ),
      totalSurfaceArea: activeLines.reduce((sum, line) => 
        sum + (line.materialType === "Material" ? (line.totalSurfaceArea || 0) : (line.plateSurfaceArea || 0)), 0
      ),
      totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
      totalQuantity: activeLines.reduce((sum, line) => {
        // For Material, use qty; for Plate, use plateQty (or qty if plateQty not set)
        let qty = 0;
        if (line.materialType === "Plate") {
          qty = line.plateQty !== undefined && line.plateQty !== null ? line.plateQty : (line.qty !== undefined && line.qty !== null ? line.qty : 0);
        } else {
          qty = line.qty !== undefined && line.qty !== null ? line.qty : 0;
        }
        // Ensure qty is a number
        const numQty = typeof qty === "number" ? (isNaN(qty) ? 0 : qty) : 0;
        return sum + numQty;
      }, 0),
      materialCost: activeLines.reduce((sum, line) => sum + (line.materialCost || 0), 0),
      laborCost: activeLines.reduce((sum, line) => sum + (line.laborCost || 0), 0),
      coatingCost: activeLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0),
      hardwareCost: activeLines.reduce((sum, line) => {
        const lineHardwareCost =
          line.hardwareCost !== undefined && line.hardwareCost !== null
            ? line.hardwareCost
            : (line.hardwareQuantity || 0) * (line.hardwareCostPerSet || 0);
        return sum + lineHardwareCost;
      }, 0),
      totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
    };
  }, [lines]);

  const handleDownloadCSVTemplate = () => {
    downloadCSVTemplate();
  };

  const handleImportCSV = () => {
    csvFileInputRef.current?.click();
  };

  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      alert("Please select a CSV file (.csv)");
      return;
    }

    try {
      // Get existing line IDs to check for duplicates
      const existingLineIds = lines.map(line => line.lineId).filter(Boolean) as string[];

      // Parse and validate CSV
      const { lines: importedLines, errors } = await parseCSVFile(file, existingLineIds);

      // Show validation errors if any
      if (errors.length > 0) {
        const errorMessages = errors.map(err => 
          `Row ${err.row}, ${err.field}: ${err.message}`
        ).join("\n");
        
        const proceed = confirm(
          `Found ${errors.length} validation error(s):\n\n${errorMessages}\n\n` +
          `Only ${importedLines.length} valid line(s) will be imported.\n\n` +
          `Do you want to proceed with importing the valid lines?`
        );
        
        if (!proceed) {
          return;
        }
      }

      if (importedLines.length === 0) {
        alert("No valid lines found in CSV file. Please check the file format.");
        return;
      }

      // Confirm import
      const confirmMessage = `Import ${importedLines.length} line(s) from ${file.name}?`;
      if (!confirm(confirmMessage)) {
        return;
      }

      if (!isFirebaseConfigured()) {
        alert("Firebase is not configured. Cannot import CSV.");
        return;
      }

      // Import lines to Firestore
      const linesPath = getProjectPath(companyId, projectId, "lines");
      let importedCount = 0;
      let errorCount = 0;

      for (const lineData of importedLines) {
        try {
          // Set defaults for required fields if missing
          const lineToImport: Partial<EstimatingLine> = {
            ...lineData,
            status: lineData.status || "Active",
            useStockRounding: lineData.useStockRounding ?? true,
            // Set default rates from settings if not provided
            materialRate: lineData.materialRate || 
              (companySettings ? getMaterialRateForGrade(lineData.grade || lineData.plateGrade, companySettings) : 0.85),
            laborRate: lineData.laborRate || 
              (companySettings ? getLaborRate(undefined, companySettings) : 50),
            coatingRate: lineData.coatingRate || 
              (companySettings ? getCoatingRate(lineData.coatingSystem, companySettings) : 2.50),
          };

          // Calculate read-only fields before saving
          // For Material members
          if (lineToImport.materialType === "Material" && lineToImport.sizeDesignation) {
            try {
              lineToImport.weightPerFoot = getWeightPerFoot(lineToImport.sizeDesignation);
              lineToImport.surfaceAreaPerFoot = getSurfaceAreaPerFoot(lineToImport.sizeDesignation);
              
              const lengthFt = lineToImport.lengthFt || 0;
              const lengthIn = lineToImport.lengthIn || 0;
              const lengthInFeet = lengthFt + (lengthIn / 12);
              const qty = lineToImport.qty || 1;
              
              lineToImport.totalWeight = (lineToImport.weightPerFoot || 0) * lengthInFeet * qty;
              lineToImport.totalSurfaceArea = (lineToImport.surfaceAreaPerFoot || 0) * lengthInFeet * qty;
            } catch (error) {
              console.warn("Error calculating weight for imported line:", error);
            }
          }

          // For Plates
          if (lineToImport.materialType === "Plate") {
            const plateProps = calculatePlateProperties({
              thickness: lineToImport.thickness || 0,
              width: lineToImport.width || 0,
              length: lineToImport.plateLength || 0,
              oneSideCoat: lineToImport.oneSideCoat || false,
            });
            lineToImport.plateArea = plateProps.area;
            lineToImport.edgePerimeter = plateProps.edgePerimeter;
            lineToImport.plateSurfaceArea = plateProps.surfaceArea;
            const importPlateQty = lineToImport.plateQty || lineToImport.qty || 1;
            lineToImport.plateQty = importPlateQty;
            lineToImport.qty = importPlateQty;
            lineToImport.plateTotalWeight = plateProps.totalWeight * importPlateQty;
          }

          // Calculate total labor
          const totalLabor = 
            (lineToImport.laborUnload || 0) +
            (lineToImport.laborCut || 0) +
            (lineToImport.laborCope || 0) +
            (lineToImport.laborProcessPlate || 0) +
            (lineToImport.laborDrillPunch || 0) +
            (lineToImport.laborFit || 0) +
            (lineToImport.laborWeld || 0) +
            (lineToImport.laborPrepClean || 0) +
            (lineToImport.laborPaint || 0) +
            (lineToImport.laborHandleMove || 0) +
            (lineToImport.laborLoadShip || 0);
          lineToImport.totalLabor = totalLabor;

          // Calculate costs
          const totalWeight = lineToImport.materialType === "Material" 
            ? (lineToImport.totalWeight || 0)
            : (lineToImport.plateTotalWeight || 0);
          
          lineToImport.materialCost = totalWeight * (lineToImport.materialRate || 0);
          lineToImport.laborCost = (lineToImport.totalLabor || 0) * (lineToImport.laborRate || 0);

          // Coating cost calculation
          const coatingSystem = lineToImport.coatingSystem || "None";
          const surfaceArea = lineToImport.materialType === "Material"
            ? (lineToImport.totalSurfaceArea || 0)
            : (lineToImport.plateSurfaceArea || 0);

          if (coatingSystem === "Galvanizing" || coatingSystem === "Galv") {
            lineToImport.coatingCost = totalWeight * (lineToImport.coatingRate || 0);
          } else if (coatingSystem === "Paint" || coatingSystem === "Powder Coat" || coatingSystem === "Specialty Coating") {
            lineToImport.coatingCost = surfaceArea * (lineToImport.coatingRate || 0);
          } else if (coatingSystem === "Standard Shop Primer" || coatingSystem === "Zinc Primer") {
            lineToImport.coatingCost = surfaceArea * (lineToImport.coatingRate || 0);
          } else {
            lineToImport.coatingCost = 0;
          }

          // Hardware cost calculation
          const importHardwareQty = lineToImport.hardwareQuantity || 0;
          const importHardwareCostPerSet = lineToImport.hardwareCostPerSet || 0;
          lineToImport.hardwareCost = importHardwareQty * importHardwareCostPerSet;

          // Calculate total cost with markup (only if companySettings is available)
          if (companySettings) {
            lineToImport.totalCost = calculateTotalCostWithMarkup(
              lineToImport.materialCost || 0,
              lineToImport.laborCost || 0,
              lineToImport.coatingCost || 0,
              lineToImport.hardwareCost || 0,
              companySettings,
              projectSettings || undefined
            );
          } else {
            // Fallback: simple sum without markup if settings not loaded
            lineToImport.totalCost = (lineToImport.materialCost || 0) + 
              (lineToImport.laborCost || 0) + 
              (lineToImport.coatingCost || 0) + 
              (lineToImport.hardwareCost || 0);
          }

          // Create document in Firestore
          await createDocument(linesPath, lineToImport);
          importedCount++;
        } catch (error: any) {
          console.error(`Failed to import line ${lineData.lineId}:`, error);
          errorCount++;
        }
      }

      // Show results
      if (errorCount > 0) {
        alert(
          `Import completed with errors:\n\n` +
          `Successfully imported: ${importedCount} line(s)\n` +
          `Failed: ${errorCount} line(s)\n\n` +
          `Check the browser console for details.`
        );
      } else {
        alert(`Successfully imported ${importedCount} line(s) from ${file.name}`);
      }
    } catch (error: any) {
      console.error("Failed to import CSV:", error);
      alert(`Failed to import CSV: ${error.message || "Unknown error"}`);
    }
  };

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Apple-style Action Bar - Compact */}
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          {/* CSV Actions Group */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50/80 rounded-2xl border border-gray-200/60 backdrop-blur-sm">
            <input
              type="file"
              ref={csvFileInputRef}
              accept=".csv"
              onChange={handleCSVFileChange}
              className="hidden"
            />
            <button
              onClick={handleDownloadCSVTemplate}
              className="p-2 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-sm active:scale-95"
              title="Download CSV Template"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
            <div className="w-px h-5 bg-gray-300"></div>
            <button
              onClick={handleImportCSV}
              className="p-2 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-sm active:scale-95"
              title="Import CSV"
            >
              <Upload className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => exportLinesToCSV(lines.filter(l => l.status !== "Void"))}
              disabled={lines.filter(l => l.status !== "Void").length === 0}
              className="p-2 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export CSV"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Edit Actions Group */}
          {isManualMode && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50/80 rounded-2xl border border-gray-200/60 backdrop-blur-sm">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* View Controls & Primary Action */}
        <div className="flex items-center gap-2">
          {isManualMode && (
            <button
              onClick={() => setGroupByMainMember(!groupByMainMember)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                groupByMainMember
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-50/80 text-gray-700 border border-gray-200/60 hover:bg-white"
              }`}
              title={groupByMainMember ? "Sort by Line ID" : "Group by Main Member"}
            >
              <Layers className="w-4 h-4 inline-block mr-1.5" />
              {groupByMainMember ? "By ID" : "Grouped"}
            </button>
          )}
          
          {allDisplayLines.length > 5 && (
            <button
              onClick={() => setShowAllLines(!showAllLines)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-50/80 text-gray-700 border border-gray-200/60 hover:bg-white transition-all duration-200"
              title={showAllLines ? "Show last 5 entries" : "Show all entries"}
            >
              {showAllLines ? (
                <>
                  <ChevronUp className="w-4 h-4 inline-block mr-1.5" />
                  Last 5
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 inline-block mr-1.5" />
                  All ({allDisplayLines.length})
                </>
              )}
            </button>
          )}

          {isManualMode && (
            <button
              onClick={handleAddLine}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Line
            </button>
          )}
        </div>
      </div>

      <Card ref={gridContainerRef} className="flex flex-col">
        <EstimatingGridCompact
          lines={displayLines}
          allLines={lines}
          editingId={editingId}
          editingLine={editingLine}
          isManualMode={isManualMode}
          defaultMaterialRate={
            projectSettings?.materialRate !== undefined
              ? projectSettings.materialRate
              : companySettings
              ? getMaterialRateForGrade(undefined, companySettings)
              : 0.85
          }
          defaultLaborRate={
            projectSettings?.laborRate !== undefined
              ? projectSettings.laborRate
              : companySettings
              ? getLaborRate(undefined, companySettings)
              : 50
          }
          defaultCoatingRate={
            projectSettings?.coatingRate !== undefined
              ? projectSettings.coatingRate
              : companySettings
              ? getCoatingRate(undefined, companySettings)
              : 2.50
          }
          companySettings={companySettings}
          projectSettings={projectSettings}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onChange={handleChange}
          totals={totals}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
      </Card>

      {/* Floating button removed - now positioned in KPISummary component */}
    </div>
  );
}
