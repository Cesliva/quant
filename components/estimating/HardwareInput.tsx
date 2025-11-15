"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Wrench } from "lucide-react";

interface HardwareInputProps {
  boltDiameter: string;
  boltType: string;
  boltLength?: number;
  quantity: number;
  costPerSet: number;
  totalCost: number;
  onChange: (field: string, value: any) => void;
  numberOfHoles?: number; // Auto-populate from drill/punch calculator
  isReadOnly?: boolean;
}

const BOLT_DIAMETERS = [
  "1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "7/8", 
  "1", "1-1/8", "1-1/4", "1-3/8", "1-1/2"
];

const BOLT_TYPES = [
  "A325",
  "A490",
  "A307",
  "A193 B7",
  "A193 B16",
  "A194 2H",
  "A194 2HM",
  "A563",
  "F1554 Gr36",
  "F1554 Gr55",
  "F1554 Gr105",
  "Anchor Bolt",
  "Other"
];

export default function HardwareInput({
  boltDiameter,
  boltType,
  boltLength,
  quantity,
  costPerSet,
  totalCost,
  onChange,
  numberOfHoles,
  isReadOnly = false,
}: HardwareInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localBoltDiameter, setLocalBoltDiameter] = useState(boltDiameter || "");
  const [localBoltType, setLocalBoltType] = useState(boltType || "");
  const [localBoltLength, setLocalBoltLength] = useState(boltLength?.toString() || "");
  const [localQuantity, setLocalQuantity] = useState(quantity?.toString() || "");
  const [localCostPerSet, setLocalCostPerSet] = useState(costPerSet?.toString() || "");

  // Auto-populate quantity from number of holes if provided
  useEffect(() => {
    if (numberOfHoles && numberOfHoles > 0 && (!localQuantity || localQuantity === "0")) {
      setLocalQuantity(numberOfHoles.toString());
      onChange("hardwareQuantity", numberOfHoles);
    }
  }, [numberOfHoles]); // Only run when numberOfHoles changes

  // Sync local state with props
  useEffect(() => {
    setLocalBoltDiameter(boltDiameter || "");
    setLocalBoltType(boltType || "");
    setLocalBoltLength(boltLength?.toString() || "");
    setLocalQuantity(quantity?.toString() || "");
    setLocalCostPerSet(costPerSet?.toString() || "");
  }, [boltDiameter, boltType, boltLength, quantity, costPerSet]);

  // Calculate total cost when inputs change
  useEffect(() => {
    if (!isExpanded) return;
    
    const qty = parseFloat(localQuantity) || 0;
    const cost = parseFloat(localCostPerSet) || 0;
    const calculatedTotal = qty * cost;
    
    if (Math.abs(calculatedTotal - (totalCost || 0)) > 0.01) {
      onChange("hardwareCost", calculatedTotal);
    }
  }, [localQuantity, localCostPerSet, isExpanded, totalCost, onChange]);

  if (isReadOnly) {
    return (
      <div className="text-gray-700 text-sm">
        {boltDiameter && boltType ? (
          <div>
            {boltDiameter}" {boltType} × {quantity || 0} = ${(totalCost || 0).toFixed(2)}
          </div>
        ) : (
          <span>-</span>
        )}
      </div>
    );
  }

  const displayTotal = totalCost || 0;
  const hasHardware = boltDiameter && boltType && quantity > 0;

  return (
    <div className="w-full">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          <Wrench className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Hardware</span>
        </div>
        <div className="text-sm text-gray-800">
          {hasHardware ? (
            <span>${displayTotal.toFixed(2)}</span>
          ) : (
            <span className="text-gray-400">Not set</span>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 py-3 border-t border-gray-200 space-y-4 bg-white rounded-b-lg">
          {/* Bolt Diameter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Bolt Diameter
            </label>
            <select
              value={localBoltDiameter}
              onChange={(e) => {
                setLocalBoltDiameter(e.target.value);
                onChange("hardwareBoltDiameter", e.target.value);
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Diameter...</option>
              {BOLT_DIAMETERS.map((diameter) => (
                <option key={diameter} value={diameter}>
                  {diameter}"
                </option>
              ))}
            </select>
          </div>

          {/* Bolt Type/Grade */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Bolt Type / Grade
            </label>
            <select
              value={localBoltType}
              onChange={(e) => {
                setLocalBoltType(e.target.value);
                onChange("hardwareBoltType", e.target.value);
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Type...</option>
              {BOLT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Bolt Length (Optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Bolt Length (in) <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              type="number"
              value={localBoltLength}
              onChange={(e) => {
                setLocalBoltLength(e.target.value);
                const length = e.target.value === "" ? undefined : parseFloat(e.target.value);
                onChange("hardwareBoltLength", length);
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Auto (standard length)"
              step="0.25"
              min="0"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Quantity (Bolt Sets)
              {numberOfHoles && numberOfHoles > 0 && (
                <span className="text-blue-600 text-xs ml-1">
                  (Auto from {numberOfHoles} holes)
                </span>
              )}
            </label>
            <input
              type="number"
              value={localQuantity}
              onChange={(e) => {
                setLocalQuantity(e.target.value);
                const qty = parseFloat(e.target.value) || 0;
                onChange("hardwareQuantity", qty);
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              min="0"
              step="1"
            />
          </div>

          {/* Cost per Set */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cost per Set (Bolt + Nut + Washer)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={localCostPerSet}
                onChange={(e) => {
                  setLocalCostPerSet(e.target.value);
                  const cost = parseFloat(e.target.value) || 0;
                  onChange("hardwareCostPerSet", cost);
                }}
                className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {/* Total Display */}
          <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Total Hardware Cost:</span>
            <span className="text-sm font-bold text-gray-900">
              ${displayTotal.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

