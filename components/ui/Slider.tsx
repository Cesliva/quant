"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
  disabled = false,
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const percentage = ((value[0] - min) / (max - min)) * 100;

  const updateValue = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newValue = min + (percentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    onValueChange([clampedValue]);
  }, [min, max, step, onValueChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e);
  }, [disabled, updateValue]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (disabled) return;
    updateValue(e);
  }, [disabled, updateValue]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={sliderRef}
      className={`relative h-2 bg-slate-200 rounded-full cursor-pointer select-none ${className} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute h-full bg-blue-600 rounded-full transition-all"
        style={{ width: `${percentage}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md hover:scale-110 transition-transform cursor-grab active:cursor-grabbing"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  );
}

