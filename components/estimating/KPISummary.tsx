"use client";

import { Card } from "@/components/ui/Card";
import { EstimatingLine } from "./EstimatingGrid";

interface KPISummaryProps {
  lines: EstimatingLine[];
}

export default function KPISummary({ lines }: KPISummaryProps) {
  const totals = lines.reduce(
    (acc, line) => ({
      weight: acc.weight + (line.weight || 0),
      surfaceArea: acc.surfaceArea + (line.surfaceArea || 0),
      laborHours: acc.laborHours + (line.laborHours || 0),
      cost: acc.cost + (line.cost || 0),
    }),
    { weight: 0, surfaceArea: 0, laborHours: 0, cost: 0 }
  );

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <Card>
        <div className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Weight</div>
          <div className="text-2xl font-bold text-gray-900">
            {totals.weight.toFixed(2)} lbs
          </div>
        </div>
      </Card>
      
      <Card>
        <div className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Surface Area</div>
          <div className="text-2xl font-bold text-gray-900">
            {totals.surfaceArea.toFixed(2)} SF
          </div>
        </div>
      </Card>
      
      <Card>
        <div className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Labor Hours</div>
          <div className="text-2xl font-bold text-gray-900">
            {totals.laborHours.toFixed(2)} hrs
          </div>
        </div>
      </Card>
      
      <Card>
        <div className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Cost</div>
          <div className="text-2xl font-bold text-gray-900">
            ${totals.cost.toFixed(2)}
          </div>
        </div>
      </Card>
    </div>
  );
}

