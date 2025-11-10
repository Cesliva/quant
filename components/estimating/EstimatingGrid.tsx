"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Upload, Edit, Trash2, Copy, Check, X, Undo2, Redo2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
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
  materialType: "Rolled" | "Plate"; // Determines which fields to show
  
  // B) Material - Rolled Members (when materialType = "Rolled")
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
  thickness?: number; // inches
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
  
  // E) Cost (applies to any line type)
  materialRate?: number; // $/lb (from Company Defaults, override allowed)
  materialCost?: number; // Read-only
  laborRate?: number; // $/hr (from Company Defaults, override allowed)
  laborCost?: number; // Read-only
  coatingRate?: number; // $/sf for Paint/Powder or $/lb for Galv
  coatingCost?: number; // Read-only
  totalCost?: number; // Read-only
  
  // F) Admin / Controls
  notes?: string;
  hashtags?: string;
  status?: "Active" | "Void";
  useStockRounding?: boolean; // Toggle for exact vs stock length
}

interface EstimatingGridProps {
  companyId: string;
  projectId: string;
  isManualMode?: boolean;
}

export default function EstimatingGrid({ companyId, projectId, isManualMode = false }: EstimatingGridProps) {
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
  
  // Track if we should add to history (skip for Firestore updates)
  const skipHistoryRef = useRef(false);
  
  // Debounce save operations
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
            const materialType = targetLine?.materialType || editingLine.materialType as "Rolled" | "Plate" | undefined;
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
          const materialType = targetLine?.materialType || editingLine.materialType as "Rolled" | "Plate" | undefined;
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
    // Use sample data if Firebase is not configured
    if (!isFirebaseConfigured()) {
      const sampleData = getSampleProjectData(projectId || "1");
      // Convert old format to new format
      const defaultSettings = {
        materialGrades: [{ grade: "A992", costPerPound: 1.05 }],
        laborRates: [{ trade: "Fabricator", rate: 50 }],
        coatingTypes: [{ type: "None", costPerSF: 0 }],
        markupSettings: { overheadPercentage: 15, profitPercentage: 10, materialWasteFactor: 5, laborWasteFactor: 10, salesTaxRate: 0, useTaxRate: 0 },
      };
      const settings = companySettings || defaultSettings;
      
      const convertedLines = sampleData.lines.map((line, index) => ({
        id: line.id,
        lineId: `L${index + 1}`,
        drawingNumber: "",
        detailNumber: "",
        itemDescription: line.item,
        category: "Structural",
        subCategory: "",
        materialType: "Rolled" as const,
        shapeType: "W" as ShapeType,
        sizeDesignation: line.size,
        grade: "A992",
        lengthFt: parseFloat(line.length) || 20,
        lengthIn: 0,
        qty: line.qty,
        weightPerFoot: 0,
        totalWeight: line.weight,
        surfaceAreaPerFoot: 0,
        totalSurfaceArea: line.surfaceArea,
        coatingSystem: "None",
        totalLabor: line.laborHours,
        materialRate: getMaterialRateForGrade("A992", settings),
        materialCost: 0,
        laborRate: getLaborRate(undefined, settings),
        laborCost: 0,
        coatingCost: 0,
        totalCost: line.cost,
        status: "Active" as const,
        useStockRounding: true,
      }));
      skipHistoryRef.current = true; // Don't add initial load to history
      setLines(convertedLines, false);
      return;
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
  }, [companyId, projectId, companySettings, setLines]);

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
      });
      
      // Skip if nothing that affects calculations has changed
      if (lastCalculatedRef.current === calculationKey) {
        return;
      }
      
      lastCalculatedRef.current = calculationKey;
      calculatingRef.current = true;
      
      const calculated = { ...editingLine };
      
      // For Rolled members - Auto-calculate weight from AISC data
      // This runs whenever sizeDesignation, lengthFt, lengthIn, or qty changes
      if (calculated.materialType === "Rolled" && calculated.sizeDesignation) {
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
        
        // Debug logging (remove in production)
        if (calculated.sizeDesignation === "W10x19") {
          console.log("Weight Calculation Debug:", {
            sizeDesignation: calculated.sizeDesignation,
            weightPerFoot: calculated.weightPerFoot,
            lengthFt,
            lengthIn,
            lengthInFeet,
            qty,
            totalWeight: calculated.totalWeight
          });
        }
        } catch (error) {
          console.warn("Error calculating weight for size:", calculated.sizeDesignation, error);
          // Keep existing values if calculation fails
        }
      } else if (calculated.materialType === "Rolled") {
        // If sizeDesignation is cleared, reset weight fields
        calculated.weightPerFoot = 0;
        calculated.totalWeight = 0;
        calculated.surfaceAreaPerFoot = 0;
        calculated.totalSurfaceArea = 0;
      }
      
      // For Plates - Auto-calculate weight
      if (calculated.materialType === "Plate") {
        const plateProps = calculatePlateProperties({
        thickness: calculated.thickness || 0,
        width: calculated.width || 0,
        length: calculated.plateLength || 0,
          oneSideCoat: calculated.oneSideCoat || false,
        });
        calculated.plateArea = plateProps.area;
        calculated.edgePerimeter = plateProps.edgePerimeter;
        calculated.plateSurfaceArea = plateProps.surfaceArea;
        calculated.plateTotalWeight = plateProps.totalWeight * (calculated.plateQty || 1);
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
        const grade = calculated.materialType === "Rolled" ? calculated.grade : calculated.plateGrade;
        calculated.materialRate = projectSettings?.materialRate || getMaterialRateForGrade(grade, companySettings);
      }
      
      if (!calculated.laborRate) {
        calculated.laborRate = projectSettings?.laborRate || getLaborRate(undefined, companySettings);
      }
      
      if (!calculated.coatingRate) {
        calculated.coatingRate = projectSettings?.coatingRate || getCoatingRate(calculated.coatingSystem, companySettings);
      }
      
      // Calculate costs
      const totalWeight = calculated.materialType === "Rolled" 
        ? (calculated.totalWeight || 0)
        : (calculated.plateTotalWeight || 0);
      
      calculated.materialCost = totalWeight * (calculated.materialRate || 0);
      calculated.laborCost = (calculated.totalLabor || 0) * (calculated.laborRate || 0);
      
      // Coating cost calculation
      // Galvanizing: cost per pound × total weight
      // Paint/Powder: cost per gallon × surface area (SF)
      // Other coatings: cost per SF × surface area
      const coatingSystem = calculated.coatingSystem || "None";
      const surfaceArea = calculated.materialType === "Rolled"
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
      materialType: "Rolled",
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
        await updateDocument(linePath, editingId, editingLine);
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
    // If a line is provided and we're not editing it, start editing it first
    if (line && editingId !== line.id) {
      setEditingId(line.id!);
      setEditingLine({ ...line, [field]: value });
    } else {
      // Use functional update to avoid stale closures and optimize performance
      setEditingLine((prev) => {
        // Only create new object if value actually changed
        if (prev[field] === value) {
          return prev; // No change, return same reference
        }
        return { ...prev, [field]: value };
      });
      
      // Clear calculation cache for fields that affect calculations
      if (field === "sizeDesignation" || field === "lengthFt" || field === "lengthIn" || field === "qty" ||
          field === "materialType" || field === "thickness" || field === "width" || field === "plateLength" ||
          field === "plateQty" || field === "oneSideCoat" || field.startsWith("labor") || 
          field === "coatingSystem" || field === "grade" || field === "plateGrade") {
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
        sum + (line.materialType === "Rolled" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0)), 0
      ),
      totalSurfaceArea: activeLines.reduce((sum, line) => 
        sum + (line.materialType === "Rolled" ? (line.totalSurfaceArea || 0) : (line.plateSurfaceArea || 0)), 0
      ),
      totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
      materialCost: activeLines.reduce((sum, line) => sum + (line.materialCost || 0), 0),
      laborCost: activeLines.reduce((sum, line) => sum + (line.laborCost || 0), 0),
      coatingCost: activeLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0),
      totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
    };
  }, [lines]);

  const handleImportCSV = () => {
    alert("CSV import functionality coming soon");
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          {isManualMode ? "Manual Entry Mode" : "Voice Input Mode"}
        </h2>
        <div className="flex gap-3 items-center">
          <Button variant="outline" size="sm" onClick={handleImportCSV} className="flex items-center justify-center">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
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
          lines={lines}
          editingId={editingId}
          editingLine={editingLine}
          isManualMode={isManualMode}
          defaultMaterialRate={companySettings ? getMaterialRateForGrade(undefined, companySettings) : 0.85}
          defaultLaborRate={companySettings ? getLaborRate(undefined, companySettings) : 50}
          defaultCoatingRate={companySettings ? getCoatingRate(undefined, companySettings) : 2.50}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onChange={handleChange}
          totals={totals}
          expandedRowId={expandedRowId}
          onExpandedRowChange={setExpandedRowId}
        />
      </Card>
    </div>
  );
}
