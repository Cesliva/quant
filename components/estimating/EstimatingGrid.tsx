"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Upload, Edit, Trash2, Copy, Check, X, Undo2, Redo2, Download, Layers } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { deleteField } from "firebase/firestore";
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
import { createAuditLog, createAuditChanges } from "@/lib/utils/auditLog";
import { useAuth } from "@/lib/hooks/useAuth";

// Expanded Estimating Line Interface
export interface EstimatingLine {
  id?: string;
  
  // A) Identification
  lineId: string; // Auto sequence
  drawingNumber: string;
  detailNumber: string;
  itemDescription: string;
  category: string; // Columns, Beams, Misc Metals, Plates, etc.
  subCategory: string; // Base Plate, Gusset, Stiffener, Clip, etc.
  
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
}

export default function EstimatingGrid({ companyId, projectId, isManualMode = false, highlightLineId }: EstimatingGridProps) {
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
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [groupByMainMember, setGroupByMainMember] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const highlightedLineRef = useRef<HTMLTableRowElement | null>(null);
  
  // Track if we should add to history (skip for Firestore updates)
  const skipHistoryRef = useRef(false);
  
  // Handle highlighting and scrolling to line from URL parameter
  useEffect(() => {
    if (highlightLineId && lines.length > 0) {
      // Find the line
      const line = lines.find(l => l.id === highlightLineId);
      if (line) {
        // Expand the row if it's not already expanded
        if (expandedRowId !== line.id) {
          setExpandedRowId(line.id);
        }
        // Set editing state to make it editable
        if (editingId !== line.id) {
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
  }, [highlightLineId, lines, expandedRowId, editingId]);
  
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
  
  // Handle sort change
  const handleSortChange = (field: string) => {
    if (field === "hashtags") {
      // Check if any lines have hashtags before sorting
      const hasAnyHashtags = lines.some(l => l.hashtags && l.hashtags.trim() !== "");
      if (!hasAnyHashtags) {
        // No hashtags in any line, don't sort
        setSortBy(undefined);
        setSortDirection("asc");
        return;
      }
    }
    
    if (sortBy === field) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  // Sort lines by hashtags
  const sortLinesByHashtags = (linesToSort: EstimatingLine[]): EstimatingLine[] => {
    // Separate active and voided lines
    const activeLines = linesToSort.filter(l => l.status !== "Void");
    const voidedLines = linesToSort.filter(l => l.status === "Void");
    
    // Sort active lines by hashtags
    const sortedActive = [...activeLines].sort((a, b) => {
      const aHashtags = (a.hashtags || "").toLowerCase().trim();
      const bHashtags = (b.hashtags || "").toLowerCase().trim();
      
      // Empty hashtags go to the end
      if (aHashtags === "" && bHashtags !== "") return 1;
      if (aHashtags !== "" && bHashtags === "") return -1;
      if (aHashtags === "" && bHashtags === "") return 0;
      
      // Compare hashtags
      const comparison = aHashtags.localeCompare(bHashtags);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    // Sort voided lines by hashtags (same logic)
    const sortedVoided = [...voidedLines].sort((a, b) => {
      const aHashtags = (a.hashtags || "").toLowerCase().trim();
      const bHashtags = (b.hashtags || "").toLowerCase().trim();
      
      if (aHashtags === "" && bHashtags !== "") return 1;
      if (aHashtags !== "" && bHashtags === "") return -1;
      if (aHashtags === "" && bHashtags === "") return 0;
      
      const comparison = aHashtags.localeCompare(bHashtags);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    // Return active lines first, then voided lines
    return [...sortedActive, ...sortedVoided];
  };

  // Get display lines (grouped, sorted by line ID, or sorted by hashtags)
  let displayLines: EstimatingLine[];
  if (sortBy === "hashtags") {
    // Only sort by hashtags if there are actually hashtags in the data
    const hasAnyHashtags = lines.some(l => l.hashtags && l.hashtags.trim() !== "");
    if (hasAnyHashtags) {
      displayLines = sortLinesByHashtags(lines);
    } else {
      // No hashtags, revert to default sorting
      displayLines = groupByMainMember ? groupLinesByMainMember(lines) : sortLinesByLineId(lines);
      // Clear the sort state
      if (sortBy === "hashtags") {
        setSortBy(undefined);
      }
    }
  } else {
    displayLines = groupByMainMember ? groupLinesByMainMember(lines) : sortLinesByLineId(lines);
  }
  
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
      const hasActiveRow = editingId || expandedRowId;
      
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
            const targetLine = lines.find(l => l.id === (editingId || expandedRowId));
            const materialType = targetLine?.materialType || editingLine.materialType as "Material" | "Plate" | undefined;
            const field = getFieldFromNumber(number, materialType);
            
            if (field) {
              // Try to find the field in the currently editing line or expanded row
              const targetLineId = editingId || expandedRowId;
              if (targetLineId) {
                // First, try to find the expanded detail row container
                // The expanded detail is in a <tr> with a <td> containing EstimatingRowDetail
                // Find the row that contains the field with the target line ID
                const expandedRow = Array.from(document.querySelectorAll('tr')).find(tr => {
                  const td = tr.querySelector('td[colspan="13"]');
                  return td && td.querySelector(`[data-line-id="${targetLineId}"]`);
                }) as HTMLElement;
                
                // Search within the expanded detail row first (if it exists)
                let inputElement: HTMLElement | null = null;
                if (expandedRow) {
                  const inputId = `field-${targetLineId}-${field}`;
                  inputElement = expandedRow.querySelector(`#${inputId}`) as HTMLElement;
                  
                  // If not found by ID, try data attributes within the expanded row
                  if (!inputElement) {
                    inputElement = expandedRow.querySelector(`[data-field="${field}"][data-line-id="${targetLineId}"]`) as HTMLElement;
                  }
                }
                
                // Fallback: search document-wide if not found in expanded row
                if (!inputElement) {
                  const inputId = `field-${targetLineId}-${field}`;
                  inputElement = document.getElementById(inputId) as HTMLElement;
                  
                  // If not found by ID, try data attributes
                  if (!inputElement) {
                    inputElement = document.querySelector(`[data-field="${field}"][data-line-id="${targetLineId}"]`) as HTMLElement;
                  }
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
          const targetLine = lines.find(l => l.id === (editingId || expandedRowId));
          const materialType = targetLine?.materialType || editingLine.materialType as "Material" | "Plate" | undefined;
          const field = getFieldFromNumber(number, materialType);
          
          if (field && hasActiveRow) {
            const targetLineId = editingId || expandedRowId;
            if (targetLineId) {
              // First, try to find the expanded detail row container
              // Find the row that contains the field with the target line ID
              const expandedRow = Array.from(document.querySelectorAll('tr')).find(tr => {
                const td = tr.querySelector('td[colspan="13"]');
                return td && td.querySelector(`[data-line-id="${targetLineId}"]`);
              }) as HTMLElement;
              
              // Search within the expanded detail row first (if it exists)
              let inputElement: HTMLElement | null = null;
              if (expandedRow) {
                const inputId = `field-${targetLineId}-${field}`;
                inputElement = expandedRow.querySelector(`#${inputId}`) as HTMLElement;
                
                // If not found by ID, try data attributes within the expanded row
                if (!inputElement) {
                  inputElement = expandedRow.querySelector(`[data-field="${field}"][data-line-id="${targetLineId}"]`) as HTMLElement;
                }
              }
              
              // Fallback: search document-wide if not found in expanded row
              if (!inputElement) {
                const inputId = `field-${targetLineId}-${field}`;
                inputElement = document.getElementById(inputId) as HTMLElement;
                
                // If not found by ID, try data attributes
                if (!inputElement) {
                  inputElement = document.querySelector(`[data-field="${field}"][data-line-id="${targetLineId}"]`) as HTMLElement;
                }
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
  }, [isManualMode, canUndo, canRedo, undo, redo, editingId, expandedRowId, editingLine.materialType, lines]);

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
        const qty = calculated.qty || 1;
        calculated.totalWeight = (calculated.weightPerFoot || 0) * lengthInFeet * qty;
        calculated.totalSurfaceArea = (calculated.surfaceAreaPerFoot || 0) * lengthInFeet * qty;
        
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
      const coatingSystem = calculated.coatingSystem || "None";
      const surfaceArea = calculated.materialType === "Material"
        ? (calculated.totalSurfaceArea || 0)
        : (calculated.plateSurfaceArea || 0);
      
      if (coatingSystem === "Galvanizing" || coatingSystem === "Galv") {
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
        // None or unknown: no cost
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

    const newLine: Omit<EstimatingLine, "id"> = {
      lineId: `L${lines.length + 1}`,
      drawingNumber: "",
      detailNumber: "",
      itemDescription: "",
      category: "Structural",
      subCategory: "",
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
      createDocument(linesPath, newLine).then(async (newId) => {
        // Add to local state for immediate UI update
        const addedLine = { ...newLine, id: newId };
        setLines([...lines, addedLine], true); // Add to history
        
        // Log audit trail for new line creation
        await createAuditLog(
          companyId,
          'CREATE',
          'ESTIMATE_LINE',
          newLine.lineId,
          user,
          {
            projectId,
            entityName: newLine.itemDescription || newLine.lineId || 'Estimate Line',
          }
        );
        
        // In manual mode, automatically start editing the new line
        if (isManualMode && newId) {
          setTimeout(() => {
            setEditingId(newId);
            setEditingLine(addedLine);
          }, 100);
        }
      }).catch((error: any) => {
        console.error("Failed to add line:", error);
        alert("Firebase is not configured. Please set up Firebase credentials to save data.");
      });
    } catch (error: any) {
      console.error("Failed to add line:", error);
      alert("Firebase is not configured. Please set up Firebase credentials to save data.");
    }
  };

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
        
        await updateDocument(linePath, editingId, dataToSave);
        
        // Log audit trail for estimate line update
        if (currentLine) {
          const changes = createAuditChanges(currentLine, dataToSave, [
            'totalCost',
            'materialCost',
            'laborCost',
            'coatingCost',
            'materialRate',
            'laborRate',
            'coatingRate',
            'qty',
            'lengthFt',
            'lengthIn',
            'status',
            'itemDescription',
            'category',
            'subCategory',
          ] as (keyof EstimatingLine)[]);
          
          if (changes.length > 0) {
            await createAuditLog(
              companyId,
              'UPDATE',
              'ESTIMATE_LINE',
              editingLine.lineId || editingId,
              user,
              {
                projectId,
                entityName: editingLine.itemDescription || editingLine.lineId || 'Estimate Line',
                changes,
              }
            );
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
        
        // Log audit trail before deleting
        await createAuditLog(
          companyId,
          'DELETE',
          'ESTIMATE_LINE',
          lineToDelete.lineId || lineToDelete.id,
          user,
          {
            projectId,
            entityName: lineToDelete.itemDescription || lineToDelete.lineId || 'Estimate Line',
          }
        );
        
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
      createDocument(linesPath, duplicated).then(async (newId) => {
        const addedLine = { ...duplicated, id: newId };
        setLines([...lines, addedLine], true); // Add to history
        
        // Log audit trail for line duplication
        await createAuditLog(
          companyId,
          'CREATE',
          'ESTIMATE_LINE',
          duplicated.lineId,
          user,
          {
            projectId,
            entityName: duplicated.itemDescription || duplicated.lineId || 'Estimate Line',
            metadata: { duplicatedFrom: line.lineId },
          }
        );
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
        const numQty = typeof qty === "number" ? qty : (typeof qty === "string" && qty.trim() !== "" ? parseFloat(qty) || 0 : 0);
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

  const handleDownloadCSVTemplate = async () => {
    try {
      await downloadCSVTemplate();
    } catch (error: any) {
      if (error.message === 'Save cancelled') {
        // User cancelled - don't show error
        return;
      }
      console.error("Failed to download CSV template:", error);
      alert(`Failed to download CSV template: ${error.message}`);
    }
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

          // Calculate total cost with markup
          lineToImport.totalCost = calculateTotalCostWithMarkup(
            lineToImport.materialCost || 0,
            lineToImport.laborCost || 0,
            lineToImport.coatingCost || 0,
            lineToImport.hardwareCost || 0,
            companySettings,
            projectSettings || undefined
          );

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
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex gap-3 items-center">
          <input
            type="file"
            ref={csvFileInputRef}
            accept=".csv"
            onChange={handleCSVFileChange}
            className="hidden"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadCSVTemplate} 
            className="flex items-center justify-center"
            title="Download CSV template with all column headers"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportCSV} className="flex items-center justify-center">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={async () => {
              try {
                await exportLinesToCSV(lines.filter(l => l.status !== "void"));
                
                // Log audit trail for CSV export
                await createAuditLog(
                  companyId,
                  'EXPORT',
                  'EXPORT',
                  projectId,
                  user,
                  {
                    projectId,
                    entityName: 'Estimate Lines',
                    metadata: {
                      exportType: 'CSV',
                      lineCount: lines.filter(l => l.status !== "void").length,
                    },
                  }
                );
              } catch (error: any) {
                if (error.message === 'Save cancelled') {
                  // User cancelled - don't show error
                  return;
                }
                console.error("Failed to export CSV:", error);
                alert(`Failed to export CSV: ${error.message}`);
              }
            }} 
            className="flex items-center justify-center"
            title="Export active lines to CSV"
            disabled={lines.filter(l => l.status !== "void").length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {isManualMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className="flex items-center justify-center"
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                className="flex items-center justify-center"
              >
                <Redo2 className="w-4 h-4 mr-2" />
                Redo
              </Button>
              <Button
                variant={groupByMainMember ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByMainMember(!groupByMainMember)}
                title={groupByMainMember ? "Sort by Line ID (L1, L2, L3...)" : "Group small parts under main members"}
                className="flex items-center justify-center"
              >
                {groupByMainMember ? (
                  <>
                    <Layers className="w-4 h-4 mr-2" />
                    Sort by ID
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 mr-2" />
                    Group by Main Member
                  </>
                )}
              </Button>
            </>
          )}
          {isManualMode && expandedRowId && !editingId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const lineToEdit = lines.find(l => l.id === expandedRowId);
                if (lineToEdit) {
                  handleEdit(lineToEdit);
                }
              }}
              title="Edit expanded line"
              className="flex items-center justify-center"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Line
            </Button>
          )}
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleAddLine}
            disabled={!isManualMode}
            title={!isManualMode ? "Enable Manual Entry to add lines manually" : ""}
            className="flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Line
          </Button>
        </div>
      </div>

      <Card>
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
          expandedRowId={expandedRowId}
          onExpandedRowChange={setExpandedRowId}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
      </Card>
    </div>
  );
}
