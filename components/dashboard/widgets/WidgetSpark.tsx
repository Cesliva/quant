"use client";

import WidgetTile from "./WidgetTile";

interface WidgetSparkProps {
  label: string;
  values: number[];
  captions?: { left: string; right: string };
  valueLabel?: string;
}

export default function WidgetSpark({
  label,
  values,
  captions,
  valueLabel,
}: WidgetSparkProps) {
  const maxVal = Math.max(...values, 1);

  return (
    <WidgetTile size="small">
      <p className="text-[11px] uppercase tracking-[0.4em] text-gray-500 font-semibold">
        {label}
      </p>
      <div className="flex items-end gap-1 h-20">
        {values.map((v, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-full bg-gradient-to-t from-blue-200 to-blue-500 shadow-inner"
            style={{ height: `${(v / maxVal) * 100}%` }}
          />
        ))}
      </div>
      {valueLabel && (
        <p className="text-2xl font-black text-gray-900">{valueLabel}</p>
      )}
      {captions && (
        <div className="text-xs text-gray-500 font-semibold flex justify-between">
          <span>{captions.left}</span>
          <span>{captions.right}</span>
        </div>
      )}
    </WidgetTile>
  );
}




