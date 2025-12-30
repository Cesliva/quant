"use client";

import { Card } from "@/components/ui/Card";
import { EstimatingLine } from "./EstimatingGrid";
import { Plus } from "lucide-react";

interface KPISummaryProps {
  lines: EstimatingLine[];
  onAddLine?: () => void;
  isManualMode?: boolean;
}

export default function KPISummary({ lines, onAddLine, isManualMode = false }: KPISummaryProps) {
  const totals = lines.reduce(
    (acc, line) => {
      // Only count active (non-void) lines
      if (line.status === "Void") {
        return acc;
      }
      
      // Weight: use totalWeight for Material, plateTotalWeight for Plate
      const weight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      
      // Surface Area: use totalSurfaceArea for Material, plateSurfaceArea for Plate
      const surfaceArea = line.materialType === "Material"
        ? (line.totalSurfaceArea || 0)
        : (line.plateSurfaceArea || 0);
      
      return {
        weight: acc.weight + weight,
        surfaceArea: acc.surfaceArea + surfaceArea,
        laborHours: acc.laborHours + (line.totalLabor || 0),
        cost: acc.cost + (line.totalCost || 0),
      };
    },
    { weight: 0, surfaceArea: 0, laborHours: 0, cost: 0 }
  );

  return (
    <div className="relative mb-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total Weight</div>
            <div className="text-2xl font-bold text-gray-900">
              {totals.weight.toLocaleString("en-US", { maximumFractionDigits: 2 })} lbs
            </div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {(totals.weight / 2000).toLocaleString("en-US", { maximumFractionDigits: 2 })} tons
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total Surface Area</div>
            <div className="text-2xl font-bold text-gray-900">
              {totals.surfaceArea.toLocaleString("en-US", { maximumFractionDigits: 2 })} SF
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total Man Hours</div>
            <div className="text-2xl font-bold text-gray-900">
              {totals.laborHours.toLocaleString("en-US", { maximumFractionDigits: 2 })} hrs
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {(totals.weight > 0 ? (totals.laborHours / (totals.weight / 2000)) : 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} MH/Ton
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totals.cost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
          </div>
        </Card>
      </div>
      
      {/* Add Line Button - Positioned at bottom right of KPI card */}
      {isManualMode && onAddLine && (
        <div className="absolute bottom-0 right-0 z-10">
          <div className="relative group">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
            
            {/* Main button */}
            <button
              onClick={onAddLine}
              className="relative flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 active:scale-95 group"
              title="Add New Line"
            >
              {/* Icon with rotation animation */}
              <div className="relative">
                <Plus className="w-6 h-6 transition-transform duration-300 group-hover:rotate-90" />
                {/* Ripple effect */}
                <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 animate-ping"></span>
              </div>
              
              {/* Text with slide-in animation */}
              <span className="font-semibold text-sm whitespace-nowrap hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Add Line
              </span>
              
              {/* Line count badge */}
              {lines.length > 0 && (
                <div className="absolute -top-2 -right-2 bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-blue-600">
                  {lines.filter(l => l.status !== "Void").length}
                </div>
              )}
            </button>
            
            {/* Tooltip on hover */}
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              Add new estimating line
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

