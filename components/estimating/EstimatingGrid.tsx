"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Upload, Edit, Trash2, Copy, Check, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import { isFirebaseConfigured } from "@/lib/firebase/config";
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
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<Partial<EstimatingLine>>({});
  
  // Default rates from Company Settings (TODO: Load from settings)
  const defaultMaterialRate = 0.85; // $/lb
  const defaultLaborRate = 50; // $/hr
  const defaultCoatingRate = 2.50; // $/sf

  useEffect(() => {
    // Use sample data if Firebase is not configured
    if (!isFirebaseConfigured()) {
      const sampleData = getSampleProjectData(projectId || "1");
      // Convert old format to new format
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
        materialRate: defaultMaterialRate,
        materialCost: 0,
        laborRate: defaultLaborRate,
        laborCost: 0,
        coatingCost: 0,
        totalCost: line.cost,
        status: "Active" as const,
        useStockRounding: true,
      }));
      setLines(convertedLines);
      return;
    }

    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  // Calculate read-only fields when editing
  useEffect(() => {
    if (!editingId || !editingLine) return;
    
    const calculated = { ...editingLine };
    
    // For Rolled members
    if (calculated.materialType === "Rolled" && calculated.sizeDesignation) {
      calculated.weightPerFoot = getWeightPerFoot(calculated.sizeDesignation);
      calculated.surfaceAreaPerFoot = getSurfaceAreaPerFoot(calculated.sizeDesignation);
      
      const lengthInFeet = (calculated.lengthFt || 0) + ((calculated.lengthIn || 0) / 12);
      calculated.totalWeight = (calculated.weightPerFoot || 0) * lengthInFeet * (calculated.qty || 1);
      calculated.totalSurfaceArea = (calculated.surfaceAreaPerFoot || 0) * lengthInFeet * (calculated.qty || 1);
    }
    
    // For Plates
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
    
    // Calculate costs
    const totalWeight = calculated.materialType === "Rolled" 
      ? (calculated.totalWeight || 0)
      : (calculated.plateTotalWeight || 0);
    
    calculated.materialCost = totalWeight * (calculated.materialRate || defaultMaterialRate);
    calculated.laborCost = (calculated.totalLabor || 0) * (calculated.laborRate || defaultLaborRate);
    
    // Coating cost
    const surfaceArea = calculated.materialType === "Rolled"
      ? (calculated.totalSurfaceArea || 0)
      : (calculated.plateSurfaceArea || 0);
    
    calculated.coatingCost = surfaceArea * (calculated.coatingRate || defaultCoatingRate);
    
    calculated.totalCost = 
      (calculated.materialCost || 0) +
      (calculated.laborCost || 0) +
      (calculated.coatingCost || 0);
    
    setEditingLine(calculated);
  }, [editingLine?.materialType, editingLine?.sizeDesignation, editingLine?.qty, editingLine?.lengthFt, editingLine?.lengthIn, editingLine?.thickness, editingLine?.width, editingLine?.plateLength, editingLine?.plateQty, editingLine?.oneSideCoat, editingLine?.materialRate, editingLine?.laborRate, editingLine?.coatingRate, editingId]);

  const handleAddLine = () => {
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
      materialRate: defaultMaterialRate,
      laborRate: defaultLaborRate,
      coatingRate: defaultCoatingRate,
    };

    try {
      const linesPath = getProjectPath(companyId, projectId, "lines");
      createDocument(linesPath, newLine);
    } catch (error: any) {
      console.error("Failed to add line:", error);
      alert("Firebase is not configured. Please set up Firebase credentials to save data.");
    }
  };

  const handleEdit = (line: EstimatingLine) => {
    setEditingId(line.id!);
    setEditingLine({ ...line });
  };

  const handleSave = () => {
    if (!editingId) return;
    
    try {
      const linePath = getProjectPath(companyId, projectId, "lines", editingId);
      updateDocument(linePath, editingLine);
      setEditingId(null);
      setEditingLine({});
    } catch (error: any) {
      console.error("Failed to save line:", error);
      alert("Firebase is not configured. Please set up Firebase credentials to save data.");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingLine({});
  };

  const handleDelete = (lineId: string) => {
    if (confirm("Are you sure you want to delete this line?")) {
      try {
        const linePath = getProjectPath(companyId, projectId, "lines", lineId);
        deleteDocument(linePath);
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
      createDocument(linesPath, duplicated);
    } catch (error: any) {
      console.error("Failed to duplicate line:", error);
      alert("Firebase is not configured. Please set up Firebase credentials to save data.");
    }
  };

  const handleChange = (field: keyof EstimatingLine, value: any) => {
    setEditingLine({ ...editingLine, [field]: value });
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
  const coatingSystems = ["None", "Paint", "Powder", "Galv"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          {isManualMode ? "Manual Entry Mode" : "Voice Input Mode"}
        </h2>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleImportCSV}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleAddLine}
            disabled={!isManualMode}
            title={!isManualMode ? "Enable Manual Entry to add lines manually" : ""}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Line
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          {/* Due to complexity, showing first part of table structure */}
          <div className="text-sm text-gray-600 p-4">
            <p className="font-semibold mb-2">Comprehensive Estimating Grid</p>
            <p>Full grid with all columns, grouped headers, and calculations is being implemented...</p>
            <p className="mt-2 text-xs">This will include: Identification, Material (Rolled/Plate), Labor, Cost, and Admin sections with proper visibility rules.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
