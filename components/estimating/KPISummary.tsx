"use client";

import { Card } from "@/components/ui/Card";
import { EstimatingLine } from "./EstimatingGrid";

interface KPISummaryProps {
  lines: EstimatingLine[];
}

export default function KPISummary({ lines }: KPISummaryProps) {
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
    <div className="grid grid-cols-4 gap-4 mb-6">
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
  );
}

