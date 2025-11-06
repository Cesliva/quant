"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash2, Download, FileText, Maximize2, RotateCw, CheckCircle, Eye, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { subscribeToCollection, getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import NestingCanvas from "@/components/nesting/NestingCanvas";

interface NestItem {
  id: string;
  itemDescription: string;
  materialType: "Rolled" | "Plate";
  // For plates
  thickness?: number;
  width?: number;
  length?: number;
  qty?: number;
  // For rolled
  shapeType?: string;
  sizeDesignation?: string;
  lengthFt?: number;
  qty?: number;
  // Nesting info
  stockSize?: string; // e.g., "48x96", "60x120"
  position?: { x: number; y: number };
  rotation?: number;
  waste?: number; // percentage
}

interface NestingSheet {
  id: string;
  name: string;
  materialType: "Plate" | "Rolled";
  stockSize: string; // For plates: "48x96", for rolled: "W12x65x20"
  items: NestItem[];
  totalWaste: number;
  utilization: number; // percentage
}

export default function MaterialNestingPage() {
  const router = useRouter();
  const companyId = "default"; // TODO: Get from auth context
  
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [availableLines, setAvailableLines] = useState<EstimatingLine[]>([]);
  const [nestingSheets, setNestingSheets] = useState<NestingSheet[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [newSheetStockSize, setNewSheetStockSize] = useState("48x96");
  const [selectedMaterialType, setSelectedMaterialType] = useState<"Plate" | "Rolled">("Plate");
  const [viewingSheet, setViewingSheet] = useState<string | null>(null);

  // Standard stock sizes for plates (width x length in inches)
  const plateStockSizes = [
    "48x96", "48x120", "48x144", "60x96", "60x120", "60x144", "72x96", "72x120", "72x144", "96x120", "96x144", "120x144"
  ];

  // Standard stock lengths for rolled materials (in feet)
  const rolledStockLengths = [20, 24, 30, 40, 50, 60];

  // Mock projects - replace with real Firestore query
  const projects = [
    { id: "1", name: "Downtown Office Building" },
    { id: "2", name: "Industrial Warehouse" },
    { id: "3", name: "Bridge Restoration" },
  ];

  // Load estimating lines from selected project
  useEffect(() => {
    if (!selectedProject || !isFirebaseConfigured()) return;

    const linesPath = getProjectPath(companyId, selectedProject, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setAvailableLines(data);
      }
    );

    return () => unsubscribe();
  }, [companyId, selectedProject]);

  const handleAddToNest = () => {
    if (selectedItems.size === 0) {
      alert("Please select items to nest");
      return;
    }

    // Determine material type from selected items
    const selectedLines = availableLines.filter(line => selectedItems.has(line.id!));
    const materialType = selectedLines[0]?.materialType === "Plate" ? "Plate" : "Rolled";
    setSelectedMaterialType(materialType);
    setNewSheetStockSize(materialType === "Plate" ? "48x96" : "20");
    setIsCreatingSheet(true);
  };

  const handleCreateNestingSheet = () => {
    if (!newSheetName.trim() || !newSheetStockSize) {
      alert("Please enter a sheet name and select stock size");
      return;
    }

    // Determine material type from selected items
    const selectedLines = availableLines.filter(line => selectedItems.has(line.id!));
    const materialType = selectedLines[0]?.materialType === "Plate" ? "Plate" : "Rolled";

    const itemsToNest = selectedLines.map((line, index) => {
      let position = { x: 0, y: 0 };
      
      if (line.materialType === "Plate" && line.width && line.plateLength) {
        // Simple positioning algorithm for plates
        const [stockWidth, stockLength] = newSheetStockSize.split("x").map(Number);
        const itemsPerRow = Math.floor(stockWidth / line.width);
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;
        position = { x: col * line.width, y: row * line.plateLength };
      }

      return {
        id: line.id!,
        itemDescription: line.itemDescription,
        materialType: line.materialType,
        thickness: line.thickness,
        width: line.width,
        length: line.plateLength,
        qty: line.materialType === "Plate" ? line.plateQty : line.qty,
        shapeType: line.shapeType,
        sizeDesignation: line.sizeDesignation,
        lengthFt: line.lengthFt,
        lengthIn: line.lengthIn,
        position,
        rotation: 0,
      };
    });

    // Calculate nesting for rolled materials
    let totalWaste = 0;
    let utilization = 0;
    
    if (materialType === "Rolled") {
      const stockLengthFt = parseFloat(newSheetStockSize);
      const result = calculateRolledNesting(itemsToNest, stockLengthFt);
      totalWaste = result.waste;
      utilization = result.utilization;
    } else {
      totalWaste = calculateWaste(itemsToNest, newSheetStockSize);
      utilization = 100 - totalWaste;
    }

    const sheet: NestingSheet = {
      id: `sheet-${Date.now()}`,
      name: newSheetName,
      materialType,
      stockSize: newSheetStockSize,
      items: itemsToNest,
      totalWaste,
      utilization,
    };

    setNestingSheets([...nestingSheets, sheet]);
    setSelectedItems(new Set());
    setIsCreatingSheet(false);
    setNewSheetName("");
    setNewSheetStockSize(materialType === "Plate" ? "48x96" : "20");
  };

  const calculateWaste = (items: NestItem[], stockSize: string): number => {
    // Simplified waste calculation for plates
    // In production, this would use actual nesting algorithms
    const [width, length] = stockSize.split("x").map(Number);
    const totalArea = width * length;
    
    let usedArea = 0;
    items.forEach(item => {
      if (item.materialType === "Plate" && item.width && item.length) {
        usedArea += (item.width * item.length * (item.qty || 1));
      }
    });

    const waste = totalArea > 0 ? ((totalArea - usedArea) / totalArea) * 100 : 0;
    return Math.max(0, waste);
  };

  const calculateRolledNesting = (items: NestItem[], stockLengthFt: number) => {
    // Calculate how many stock lengths are needed and waste percentage
    let totalStockLengths = 0;
    let totalUsedLength = 0;
    let totalRequiredLength = 0;

    // Group items by shape and size for better nesting
    const itemGroups: { [key: string]: NestItem[] } = {};
    items.forEach(item => {
      if (item.materialType === "Rolled") {
        const key = `${item.shapeType}-${item.sizeDesignation}`;
        if (!itemGroups[key]) itemGroups[key] = [];
        itemGroups[key].push(item);
      }
    });

    // Calculate for each group
    Object.values(itemGroups).forEach(group => {
      group.forEach(item => {
        const itemLengthFt = (item.lengthFt || 0) + ((item.lengthIn || 0) / 12);
        const qty = item.qty || 1;
        const totalItemLength = itemLengthFt * qty;
        totalRequiredLength += totalItemLength;

        // Calculate how many stock lengths needed (with kerf allowance)
        const kerf = 0.125; // 1/8" kerf per cut in feet
        const usableLength = stockLengthFt - kerf; // Account for first cut
        const itemsPerStock = Math.floor(usableLength / itemLengthFt);
        
        if (itemsPerStock > 0) {
          const stockNeeded = Math.ceil(qty / itemsPerStock);
          totalStockLengths += stockNeeded;
          totalUsedLength += (stockNeeded * stockLengthFt);
        } else {
          // Item is longer than stock, need one stock per item
          totalStockLengths += qty;
          totalUsedLength += (qty * stockLengthFt);
        }
      });
    });

    const waste = totalUsedLength > 0 
      ? ((totalUsedLength - totalRequiredLength) / totalUsedLength) * 100 
      : 0;
    const utilization = 100 - waste;

    return { waste: Math.max(0, waste), utilization: Math.max(0, utilization), stockLengths: totalStockLengths };
  };

  const handleExportQuote = (sheet: NestingSheet) => {
    const quoteData = {
      sheetName: sheet.name,
      stockSize: sheet.stockSize,
      materialType: sheet.materialType,
      items: sheet.items.map(item => ({
        description: item.itemDescription,
        size: item.materialType === "Plate" 
          ? `${item.thickness}" x ${item.width}" x ${item.length}"`
          : `${item.sizeDesignation} x ${item.lengthFt}'`,
        quantity: item.qty,
      })),
      utilization: sheet.utilization.toFixed(1),
      waste: sheet.totalWaste.toFixed(1),
    };

    const blob = new Blob([JSON.stringify(quoteData, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name.replace(/\s+/g, "_")}_nesting_quote.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (confirm("Are you sure you want to delete this nesting sheet?")) {
      setNestingSheets(nestingSheets.filter(s => s.id !== sheetId));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Material Nesting</h1>
          <p className="text-gray-600">
            Optimize material usage by nesting parts on standard stock sizes for quote requests
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Project Selection & Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Project Selector */}
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Select Project & Materials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Available Items */}
                {selectedProject && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Select Items to Nest
                      </label>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAddToNest}
                        disabled={selectedItems.size === 0}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create Nesting Sheet ({selectedItems.size})
                      </Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                      {availableLines.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                          <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No line items found in this project</p>
                          <p className="text-xs text-gray-400 mt-1">Add items in the estimating workspace first</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {availableLines.map((line) => {
                            const isSelected = selectedItems.has(line.id!);
                            return (
                              <div
                                key={line.id}
                                className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                                  isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                                }`}
                                onClick={() => {
                                  const newSelected = new Set(selectedItems);
                                  if (isSelected) {
                                    newSelected.delete(line.id!);
                                  } else {
                                    newSelected.add(line.id!);
                                  }
                                  setSelectedItems(newSelected);
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-gray-900">{line.itemDescription}</span>
                                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                        {line.materialType === "Plate" ? "Plate" : "Material"}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                      {line.materialType === "Plate" ? (
                                        <>
                                          <p>Size: {line.thickness}" × {line.width}" × {line.length}"</p>
                                          <p>Qty: {line.plateQty || 1} • Grade: {line.plateGrade || "A36"}</p>
                                        </>
                                      ) : (
                                        <>
                                          <p>Size: {line.sizeDesignation} × {line.lengthFt || 0}'</p>
                                          <p>Qty: {line.qty || 1} • Grade: {line.grade || "A36"}</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Nesting Sheets */}
          <div className="space-y-4">
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Maximize2 className="w-5 h-5 text-green-600" />
                  Nesting Sheets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nestingSheets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <Maximize2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No nesting sheets yet</p>
                    <p className="text-xs text-gray-400 mt-1">Select items and create a sheet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nestingSheets.map((sheet) => (
                      <div
                        key={sheet.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{sheet.name}</h4>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Stock: {sheet.materialType === "Plate" ? `${sheet.stockSize}"` : `${sheet.stockSize}'`} • {sheet.materialType}
                          </p>
                          {sheet.materialType === "Rolled" && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {(() => {
                                const stockLengthFt = parseFloat(sheet.stockSize);
                                const result = calculateRolledNesting(sheet.items, stockLengthFt);
                                return `${result.stockLengths} stock length(s) needed`;
                              })()}
                            </p>
                          )}
                        </div>
                          <button
                            onClick={() => handleDeleteSheet(sheet.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                          <div className="p-2 bg-green-50 rounded">
                            <p className="text-gray-600">Utilization</p>
                            <p className="font-bold text-green-700">{sheet.utilization.toFixed(1)}%</p>
                          </div>
                          <div className="p-2 bg-orange-50 rounded">
                            <p className="text-gray-600">Waste</p>
                            <p className="font-bold text-orange-700">{sheet.totalWaste.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          {sheet.items.length} item(s)
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingSheet(sheet.id)}
                            className="flex-1 gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportQuote(sheet)}
                            className="flex-1 gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Export
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Create Nesting Sheet Modal */}
        {isCreatingSheet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>Create Nesting Sheet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sheet Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    placeholder="e.g., Plate Nesting - Project ABC"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Type
                  </label>
                  <div className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded">
                    {selectedMaterialType === "Plate" ? "📄 Plate Material" : "🔩 Material"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Size <span className="text-red-500">*</span>
                  </label>
                  {selectedMaterialType === "Plate" ? (
                    <>
                      <select
                        value={newSheetStockSize}
                        onChange={(e) => setNewSheetStockSize(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {plateStockSizes.map((size) => (
                          <option key={size} value={size}>
                            {size}" (Width × Length)
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Standard plate sizes in inches (width × length)
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        value={newSheetStockSize}
                        onChange={(e) => setNewSheetStockSize(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {rolledStockLengths.map((length) => (
                          <option key={length} value={length.toString()}>
                            {length}' (Standard Stock Length)
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Standard stock lengths in feet for rolled materials (angles, HSS, wide flange, etc.)
                      </p>
                    </>
                  )}
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Selected Items: {selectedItems.size}
                  </p>
                  <p className="text-xs text-blue-700">
                    {selectedMaterialType === "Plate" 
                      ? "Items will be automatically arranged on the stock size to minimize waste"
                      : "System will calculate how many stock lengths are needed based on item lengths and quantities"}
                  </p>
                  {selectedMaterialType === "Rolled" && (
                    <div className="mt-2 text-xs text-blue-600">
                      <p className="font-medium">Example:</p>
                      <p>50 pieces of L3×3×1/4 at 6" each on 20' stock = {(() => {
                        const itemLengthFt = 6 / 12;
                        const stockLength = parseFloat(newSheetStockSize);
                        const kerf = 0.125;
                        const usableLength = stockLength - kerf;
                        const itemsPerStock = Math.floor(usableLength / itemLengthFt);
                        const stockNeeded = itemsPerStock > 0 ? Math.ceil(50 / itemsPerStock) : 50;
                        return `${stockNeeded} × ${stockLength}' stock needed`;
                      })()}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={handleCreateNestingSheet}
                    className="flex-1"
                    disabled={!newSheetName.trim()}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Sheet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreatingSheet(false);
                      setNewSheetName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Nesting Sheet Modal */}
        {viewingSheet && (() => {
          const sheet = nestingSheets.find(s => s.id === viewingSheet);
          if (!sheet) return null;
          
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Maximize2 className="w-5 h-5 text-green-600" />
                      {sheet.name}
                    </CardTitle>
                    <button
                      onClick={() => setViewingSheet(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Nesting Canvas */}
                  {sheet.materialType === "Plate" && (
                    <NestingCanvas
                      stockSize={sheet.stockSize}
                      items={sheet.items}
                      materialType={sheet.materialType}
                    />
                  )}

                  {/* Rolled Material Summary */}
                  {sheet.materialType === "Rolled" && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock Length Calculation</h4>
                      {(() => {
                        const stockLengthFt = parseFloat(sheet.stockSize);
                        const result = calculateRolledNesting(sheet.items, stockLengthFt);
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Stock Length:</p>
                                <p className="font-bold text-gray-900">{stockLengthFt}'</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Stock Lengths Needed:</p>
                                <p className="font-bold text-gray-900">{result.stockLengths}</p>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-gray-300">
                              <p className="text-xs text-gray-600">
                                Items are cut from standard {stockLengthFt}' stock lengths with 1/8" kerf allowance per cut.
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Sheet Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs text-gray-600 mb-1">Utilization</p>
                      <p className="text-2xl font-bold text-green-700">{sheet.utilization.toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-xs text-gray-600 mb-1">Waste</p>
                      <p className="text-2xl font-bold text-orange-700">{sheet.totalWaste.toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-gray-600 mb-1">Items</p>
                      <p className="text-2xl font-bold text-blue-700">{sheet.items.length}</p>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Nested Items</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Item</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Shape/Size</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Length</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Qty</th>
                            {sheet.materialType === "Plate" && (
                              <>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Position X</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Position Y</th>
                              </>
                            )}
                            {sheet.materialType === "Rolled" && (
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">Stock Needed</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sheet.items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900">{item.itemDescription}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {item.materialType === "Plate"
                                  ? `${item.thickness}" × ${item.width}" × ${item.length}"`
                                  : `${item.shapeType || ""} ${item.sizeDesignation || ""}`.trim()}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {item.materialType === "Plate"
                                  ? "-"
                                  : `${item.lengthFt || 0}' ${item.lengthIn ? `${item.lengthIn}"` : ""}`.trim()}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">{item.qty || 1}</td>
                              {sheet.materialType === "Plate" && (
                                <>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {item.position?.x.toFixed(1) || "0"}"
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {item.position?.y.toFixed(1) || "0"}"
                                  </td>
                                </>
                              )}
                              {sheet.materialType === "Rolled" && (
                                <td className="px-3 py-2 text-right text-gray-700">
                                  {(() => {
                                    const itemLengthFt = (item.lengthFt || 0) + ((item.lengthIn || 0) / 12);
                                    const stockLengthFt = parseFloat(sheet.stockSize);
                                    const kerf = 0.125;
                                    const usableLength = stockLengthFt - kerf;
                                    const itemsPerStock = Math.floor(usableLength / itemLengthFt);
                                    const qty = item.qty || 1;
                                    const stockNeeded = itemsPerStock > 0 ? Math.ceil(qty / itemsPerStock) : qty;
                                    return `${stockNeeded} × ${stockLengthFt}'`;
                                  })()}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Export Button */}
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={() => handleExportQuote(sheet)} className="gap-2">
                      <Download className="w-4 h-4" />
                      Export Quote for Supplier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Instructions */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>How Material Nesting Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Select Project & Items</p>
                <p>Choose a project and select the material items you want to nest together for quote requests.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Create Nesting Sheet</p>
                <p>Select a standard stock size (e.g., 48"×96" plate) and the system will optimize item placement to minimize waste.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Export for Quotes</p>
                <p>Export the nested material list to send to suppliers for pricing. The quote includes utilization and waste percentages.</p>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 Tip: Group similar materials (same thickness, grade) for better nesting efficiency and pricing.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

