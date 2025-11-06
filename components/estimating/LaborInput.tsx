"use client";

import { useState, useEffect } from "react";

interface LaborInputProps {
  value: number; // Decimal hours (e.g., 2.5 = 2 hours 30 minutes)
  onChange: (value: number) => void; // Callback with decimal hours
  label: string;
  isReadOnly?: boolean;
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

export default function LaborInput({
  value,
  onChange,
  label,
  isReadOnly = false,
}: LaborInputProps) {
  const { hours: initialHours, minutes: initialMinutes } = decimalToHoursMinutes(value || 0);
  const [hours, setHours] = useState<string>(initialHours.toString());
  const [minutes, setMinutes] = useState<string>(initialMinutes.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Update local state when value prop changes (but not while user is editing)
  useEffect(() => {
    if (!isFocused) {
      const { hours: h, minutes: m } = decimalToHoursMinutes(value || 0);
      setHours(h.toString());
      setMinutes(m.toString());
    }
  }, [value, isFocused]);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*$/.test(val)) {
      setHours(val);
      const h = val === "" ? 0 : parseInt(val, 10);
      const m = minutes === "" ? 0 : parseInt(minutes, 10);
      onChange(hoursMinutesToDecimal(h, m));
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*$/.test(val)) {
      // Clamp minutes to 0-59
      const numVal = val === "" ? 0 : parseInt(val, 10);
      const clampedVal = Math.max(0, Math.min(59, numVal));
      setMinutes(clampedVal.toString());
      const h = hours === "" ? 0 : parseInt(hours, 10);
      onChange(hoursMinutesToDecimal(h, clampedVal));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Normalize values on blur
    const h = hours === "" ? 0 : parseInt(hours, 10);
    const m = minutes === "" ? 0 : parseInt(minutes, 10);
    const normalizedM = Math.max(0, Math.min(59, m));
    setHours(h.toString());
    setMinutes(normalizedM.toString());
    const decimalValue = hoursMinutesToDecimal(h, normalizedM);
    onChange(decimalValue);
  };

  if (isReadOnly) {
    const { hours: h, minutes: m } = decimalToHoursMinutes(value || 0);
    return (
      <div className="text-gray-700">
        {h > 0 ? `${h}h` : ""} {m > 0 ? `${m}m` : ""} {h === 0 && m === 0 ? "0h" : ""}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={hours}
          onChange={handleHoursChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0"
          maxLength={3}
        />
        <span className="text-xs text-gray-600">h</span>
        <input
          type="text"
          inputMode="numeric"
          value={minutes}
          onChange={handleMinutesChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className="w-12 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0"
          maxLength={2}
        />
        <span className="text-xs text-gray-600">m</span>
      </div>
      <div className="text-xs text-gray-500">
        {(() => {
          const h = hours === "" ? 0 : parseInt(hours, 10);
          const m = minutes === "" ? 0 : parseInt(minutes, 10);
          const decimal = hoursMinutesToDecimal(h, m);
          return `${decimal.toFixed(2)} hrs`;
        })()}
      </div>
    </div>
  );
}

