"use client";

import WidgetTile from "./WidgetTile";
import { cn } from "@/lib/utils/cn";

interface WidgetDonutProps {
  label: string;
  value: number;
  suffix?: string;
  segments?: Array<{ label: string; value: number; color: string }>;
  className?: string;
}

export default function WidgetDonut({
  label,
  value,
  suffix = "%",
  segments = [],
  className,
}: WidgetDonutProps) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const dashArray = `${normalizedValue * 2.64} ${264 - normalizedValue * 2.64}`;

  return (
    <WidgetTile className={cn("items-center justify-center", className)}>
      <p className="text-[11px] uppercase tracking-[0.4em] text-gray-500 font-semibold">
        {label}
      </p>
      <div className="relative flex items-center justify-center">
        <svg width="140" height="140" className="-rotate-90">
          <circle
            cx="70"
            cy="70"
            r="42"
            stroke="#e5e7eb"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          <circle
            cx="70"
            cy="70"
            r="42"
            stroke="url(#grad)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dashArray}
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute text-center">
          <div className="text-4xl font-black text-gray-900">
            {value}
            <span className="text-xl font-semibold">{suffix}</span>
          </div>
          <p className="text-xs text-gray-500 font-semibold">Win Rate</p>
        </div>
      </div>
      {segments.length > 0 && (
        <div className="flex justify-center gap-4 text-xs text-gray-500 font-semibold">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label} {segment.value}%
            </div>
          ))}
        </div>
      )}
    </WidgetTile>
  );
}




