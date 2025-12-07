"use client";

interface QLoaderProps {
  size?: number; // px
  className?: string;
}

export function QLoader({ size = 18, className = "" }: QLoaderProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-white/70 text-blue-700 font-black animate-spin ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.65 }}
      aria-label="Loading"
    >
      Q
    </div>
  );
}

