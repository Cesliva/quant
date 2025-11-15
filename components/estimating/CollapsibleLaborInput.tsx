"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Calculator } from "lucide-react";

interface CollapsibleLaborInputProps {
  value: number; // Total hours (decimal)
  onChange: (value: number) => void;
  label: "Weld" | "Drill/Punch";
  isReadOnly?: boolean;
  // Optional: for weld calculator - can use line data
  weldLengthFt?: number;
  weldLengthIn?: number;
  qty?: number;
  // Optional: callback to expose number of holes for hardware integration
  onNumberOfHolesChange?: (holes: number) => void;
}

/**
 * Converts decimal hours to hours and minutes
 */
function decimalToHoursMinutes(decimalHours: number): { hours: number; minutes: number } {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return { hours, minutes };
}

/**
 * Converts hours and minutes to decimal hours
 */
function hoursMinutesToDecimal(hours: number, minutes: number): number {
  return hours + (minutes / 60);
}

export default function CollapsibleLaborInput({
  value,
  onChange,
  label,
  isReadOnly = false,
  weldLengthFt,
  weldLengthIn,
  qty = 1,
  onNumberOfHolesChange,
}: CollapsibleLaborInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMode, setInputMode] = useState<"direct" | "calculator">("direct");
  
  // Direct mode state
  const [weldHours, setWeldHours] = useState<string>("0");
  const [weldMinutes, setWeldMinutes] = useState<string>("0");
  const [drillPunchHours, setDrillPunchHours] = useState<string>("0");
  const [drillPunchMinutes, setDrillPunchMinutes] = useState<string>("0");
  
  // Calculator mode state
  const [weldLengthFtInput, setWeldLengthFtInput] = useState<string>("");
  const [weldLengthInInput, setWeldLengthInInput] = useState<string>("");
  const [weldHoursPerFoot, setWeldHoursPerFoot] = useState<string>("0.25"); // Default rate
  const [numberOfHoles, setNumberOfHoles] = useState<string>("");
  const [hoursPerHole, setHoursPerHole] = useState<string>("0.05"); // Default rate

  // Initialize from line data if available (for weld)
  useEffect(() => {
    if (label === "Weld" && weldLengthFt !== undefined && weldLengthIn !== undefined && !isExpanded) {
      setWeldLengthFtInput(weldLengthFt.toString());
      setWeldLengthInInput(weldLengthIn.toString());
    }
  }, [weldLengthFt, weldLengthIn, label, isExpanded]);

  // Update local state when value prop changes (but not while user is editing)
  useEffect(() => {
    if (!isExpanded) {
      // When collapsed, we only show total - don't update internal state
      return;
    }
    
    // When expanded, initialize from total value
    // For now, we'll split it 50/50 between weld and drill/punch as a starting point
    // In a real scenario, you might want to store breakdown separately
    const total = value || 0;
    if (label === "Weld") {
      const { hours, minutes } = decimalToHoursMinutes(total);
      setWeldHours(hours.toString());
      setWeldMinutes(minutes.toString());
    } else {
      const { hours, minutes } = decimalToHoursMinutes(total);
      setDrillPunchHours(hours.toString());
      setDrillPunchMinutes(minutes.toString());
    }
  }, [value, isExpanded, label]);

  // Calculate total from direct mode
  const calculateDirectTotal = (): number => {
    if (label === "Weld") {
      const h = weldHours === "" ? 0 : parseInt(weldHours, 10);
      const m = weldMinutes === "" ? 0 : parseInt(weldMinutes, 10);
      return hoursMinutesToDecimal(h, m);
    } else {
      const h = drillPunchHours === "" ? 0 : parseInt(drillPunchHours, 10);
      const m = drillPunchMinutes === "" ? 0 : parseInt(drillPunchMinutes, 10);
      return hoursMinutesToDecimal(h, m);
    }
  };

  // Calculate total from calculator mode
  const calculateCalculatorTotal = (): number => {
    if (label === "Weld") {
      const lengthFt = weldLengthFtInput === "" ? 0 : parseFloat(weldLengthFtInput);
      const lengthIn = weldLengthInInput === "" ? 0 : parseFloat(weldLengthInInput);
      const totalLength = lengthFt + (lengthIn / 12);
      const rate = weldHoursPerFoot === "" ? 0.25 : parseFloat(weldHoursPerFoot);
      return totalLength * rate * qty;
    } else {
      const holes = numberOfHoles === "" ? 0 : parseFloat(numberOfHoles);
      const rate = hoursPerHole === "" ? 0.05 : parseFloat(hoursPerHole);
      return holes * rate;
    }
  };

  // Update total whenever inputs change (only when expanded)
  useEffect(() => {
    if (!isExpanded) return;
    
    const total = inputMode === "direct" ? calculateDirectTotal() : calculateCalculatorTotal();
    // Only update if value actually changed to avoid unnecessary re-renders
    if (Math.abs(total - (value || 0)) > 0.001) {
      onChange(total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isExpanded,
    inputMode,
    weldHours,
    weldMinutes,
    drillPunchHours,
    drillPunchMinutes,
    weldLengthFtInput,
    weldLengthInInput,
    weldHoursPerFoot,
    numberOfHoles,
    hoursPerHole,
    qty,
    label,
    // Note: onChange and value are intentionally excluded to prevent infinite loops
  ]);

  const handleWeldHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*$/.test(val)) {
      setWeldHours(val);
    }
  };

  const handleWeldMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*$/.test(val)) {
      const numVal = val === "" ? 0 : parseInt(val, 10);
      const clampedVal = Math.max(0, Math.min(59, numVal));
      setWeldMinutes(clampedVal.toString());
    }
  };

  const handleDrillPunchHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*$/.test(val)) {
      setDrillPunchHours(val);
    }
  };

  const handleDrillPunchMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*$/.test(val)) {
      const numVal = val === "" ? 0 : parseInt(val, 10);
      const clampedVal = Math.max(0, Math.min(59, numVal));
      setDrillPunchMinutes(clampedVal.toString());
    }
  };

  const { hours: displayHours, minutes: displayMinutes } = decimalToHoursMinutes(value || 0);
  const displayDecimal = (value || 0).toFixed(2);

  if (isReadOnly) {
    return (
      <div className="text-gray-700 text-sm">
        {displayHours > 0 ? `${displayHours}h` : ""} {displayMinutes > 0 ? `${displayMinutes}m` : ""} {displayHours === 0 && displayMinutes === 0 ? "0h" : ""}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700">{label}:</span>
          <span className="text-sm text-gray-900">
            {displayHours > 0 ? `${displayHours}h` : ""} {displayMinutes > 0 ? `${displayMinutes}m` : ""} {displayHours === 0 && displayMinutes === 0 ? "0h" : ""}
          </span>
        </div>
        <span className="text-xs text-gray-500">{displayDecimal} hrs</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 py-3 border-t border-gray-200 space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Input Mode:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInputMode("direct")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  inputMode === "direct"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Direct Hours
              </button>
              <button
                type="button"
                onClick={() => setInputMode("calculator")}
                className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                  inputMode === "calculator"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Calculator className="w-3 h-3" />
                Calculator
              </button>
            </div>
          </div>

          {/* Direct Mode */}
          {inputMode === "direct" && (
            <div className="space-y-3">
              {label === "Weld" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Weld Hours</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={weldHours}
                      onChange={handleWeldHoursChange}
                      className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      maxLength={3}
                    />
                    <span className="text-xs text-gray-600">h</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={weldMinutes}
                      onChange={handleWeldMinutesChange}
                      className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      maxLength={2}
                    />
                    <span className="text-xs text-gray-600">m</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Drill/Punch Hours</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={drillPunchHours}
                      onChange={handleDrillPunchHoursChange}
                      className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      maxLength={3}
                    />
                    <span className="text-xs text-gray-600">h</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={drillPunchMinutes}
                      onChange={handleDrillPunchMinutesChange}
                      className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      maxLength={2}
                    />
                    <span className="text-xs text-gray-600">m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calculator Mode */}
          {inputMode === "calculator" && (
            <div className="space-y-3">
              {label === "Weld" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Weld Length (ft)</label>
                      <input
                        type="number"
                        value={weldLengthFtInput}
                        onChange={(e) => setWeldLengthFtInput(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Weld Length (in)</label>
                      <input
                        type="number"
                        value={weldLengthInInput}
                        onChange={(e) => setWeldLengthInInput(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hours per Foot</label>
                    <input
                      type="number"
                      value={weldHoursPerFoot}
                      onChange={(e) => setWeldHoursPerFoot(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.25"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  {qty > 1 && (
                    <div className="text-xs text-gray-500">
                      Quantity: {qty} × {(() => {
                        const lengthFt = weldLengthFtInput === "" ? 0 : parseFloat(weldLengthFtInput);
                        const lengthIn = weldLengthInInput === "" ? 0 : parseFloat(weldLengthInInput);
                        const totalLength = lengthFt + (lengthIn / 12);
                        return totalLength.toFixed(2);
                      })()} ft = {(() => {
                        const lengthFt = weldLengthFtInput === "" ? 0 : parseFloat(weldLengthFtInput);
                        const lengthIn = weldLengthInInput === "" ? 0 : parseFloat(weldLengthInInput);
                        const totalLength = lengthFt + (lengthIn / 12);
                        return (totalLength * qty).toFixed(2);
                      })()} ft total
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Number of Holes</label>
                    <input
                      type="number"
                      value={numberOfHoles}
                      onChange={(e) => {
                        setNumberOfHoles(e.target.value);
                        const holes = parseFloat(e.target.value) || 0;
                        if (onNumberOfHolesChange) {
                          onNumberOfHolesChange(holes);
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hours per Hole</label>
                    <input
                      type="number"
                      value={hoursPerHole}
                      onChange={(e) => setHoursPerHole(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.05"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Total Display */}
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Total:</span>
              <span className="text-sm font-semibold text-gray-900">
                {displayHours > 0 ? `${displayHours}h` : ""} {displayMinutes > 0 ? `${displayMinutes}m` : ""} {displayHours === 0 && displayMinutes === 0 ? "0h" : ""} ({displayDecimal} hrs)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

