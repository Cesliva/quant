"use client";

interface QMarkProps {
  px?: number; // size in pixels (default 64)
  className?: string;
}

export function QMark({ px = 64, className = "" }: QMarkProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-500 text-white font-black shadow-lg ${className}`}
      style={{ width: px, height: px }}
      aria-label="Quant"
    >
      <span className="text-lg leading-none">Q</span>
    </div>
  );
}

