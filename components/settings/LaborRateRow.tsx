"use client";

import Input from "@/components/ui/Input";
import {
  type LaborRateWithId,
  type LaborRateMode,
  calculateShopRate,
  getBurdenDollars,
  BURDEN_DOLLARS_CAP,
  INDIRECTS_DOLLARS_CAP,
} from "@/lib/types/laborRates";
import { Trash2 } from "lucide-react";
import { useCallback } from "react";

interface LaborRateRowProps {
  rate: LaborRateWithId;
  rateMode: LaborRateMode;
  onUpdate: (id: string, field: keyof LaborRateWithId, value: string | number) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export default function LaborRateRow({
  rate,
  rateMode,
  onUpdate,
  onRemove,
  canRemove,
}: LaborRateRowProps) {
  const mode = rate.rateMode ?? rateMode;
  const baseWage = rate.baseWage ?? 0;
  const burdenDollars = getBurdenDollars(rate);
  const indirectsDollars = rate.indirectsDollars ?? 0;
  const shopRate =
    mode === "calculated"
      ? calculateShopRate(baseWage, burdenDollars, indirectsDollars)
      : (rate.shopRate ?? rate.rate);

  const handleModeChange = useCallback(
    (nextMode: LaborRateMode) => {
      onUpdate(rate.id, "rateMode", nextMode);
      if (nextMode === "manual") {
        onUpdate(rate.id, "shopRate", shopRate);
      } else {
        onUpdate(rate.id, "baseWage", rate.baseWage ?? shopRate);
        onUpdate(rate.id, "burdenDollars", burdenDollars);
        onUpdate(rate.id, "indirectsDollars", indirectsDollars);
      }
    },
    [rate.id, rate.baseWage, burdenDollars, indirectsDollars, shopRate, onUpdate]
  );

  const formatCurrency = (val: number) =>
    val === 0 ? "" : val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
      <div className={`flex-1 grid gap-4 ${mode === "manual" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
          <Input
            value={rate.trade}
            onChange={(e) => onUpdate(rate.id, "trade", e.target.value)}
            placeholder="e.g., Fabricator, Welder"
          />
        </div>
        <div className="min-w-[200px] shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5 gap-0">
            <button
              type="button"
              onClick={() => handleModeChange("manual")}
              title="Enter your shop rate directly ($/hr)"
              className={`flex-1 min-w-[70px] px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-md ${
                mode === "manual"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("calculated")}
              title="Shop rate = Labor + Directs + Indirects"
              className={`flex-1 min-w-[90px] px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-md ${
                mode === "calculated"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
            >
              Calculated
            </button>
          </div>
        </div>
        {mode === "manual" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Rate ($/hr)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={rate.shopRate ?? rate.rate}
                onChange={(e) =>
                  onUpdate(rate.id, "shopRate", parseFloat(e.target.value) || 0)
                }
                placeholder="0.00"
                className="pl-8"
              />
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labor ($/hr)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={baseWage === 0 ? "" : baseWage}
                  onChange={(e) =>
                    onUpdate(rate.id, "baseWage", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" title="Benefits, payroll taxes">Directs ($/hr)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  min={0}
                  max={BURDEN_DOLLARS_CAP}
                  step="0.01"
                  value={burdenDollars === 0 ? "" : burdenDollars}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    onUpdate(rate.id, "burdenDollars", Math.min(v, BURDEN_DOLLARS_CAP));
                  }}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" title="Consumables, overhead, equipment">Indirects ($/hr)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  min={0}
                  max={INDIRECTS_DOLLARS_CAP}
                  step="0.01"
                  value={indirectsDollars === 0 ? "" : indirectsDollars}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    onUpdate(rate.id, "indirectsDollars", Math.min(v, INDIRECTS_DOLLARS_CAP));
                  }}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Shop Rate ($/hr)
              </label>
              <div className="px-4 py-2 rounded-lg border border-gray-200 bg-gray-100 text-gray-700 font-medium">
                ${formatCurrency(shopRate)}
              </div>
            </div>
          </>
        )}
      </div>
      {canRemove && (
        <button
          onClick={() => onRemove(rate.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-8"
          title="Remove trade"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
