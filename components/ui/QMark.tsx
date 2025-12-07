"use client";

interface QMarkProps {
  px?: number; // size in pixels (default 64)
  className?: string;
}

export function QMark({ px = 64, className = "" }: QMarkProps) {
  return (
    <img
      src="/graphics/logos/Q.svg"
      alt="Quant"
      className={className}
      style={{ width: px, height: px }}
    />
  );
}

