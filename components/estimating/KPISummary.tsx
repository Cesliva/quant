"use client";

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
    <div className="sticky top-0 z-50 mb-0 pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-blue-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Total Weight</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
            {(totals.weight / 2000).toLocaleString("en-US", { maximumFractionDigits: 1 })}
          </p>
          <p className="text-sm opacity-85">{totals.weight.toLocaleString("en-US", { maximumFractionDigits: 0 })} lbs</p>
        </div>
        
        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-indigo-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Total Surface Area</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
            {totals.surfaceArea.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm opacity-85">SF</p>
        </div>
        
        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-orange-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Total Man Hours</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
            {totals.laborHours.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm opacity-85">
            {totals.weight > 0 ? `${(totals.laborHours / (totals.weight / 2000)).toFixed(1)} MH/T` : "No weight"}
          </p>
        </div>
        
        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-emerald-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Total Cost</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
            ${totals.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm opacity-85">Estimate total</p>
        </div>
      </div>
    </div>
  );
}

