"use client";

import Image from "next/image";

interface QLoaderProps {
  size?: number; // px
  className?: string;
}

export function QLoader({ size = 18, className = "" }: QLoaderProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-white/70 animate-spin ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    >
      <Image
        src="/graphics/logos/Q.svg"
        alt="Quant"
        width={size}
        height={size}
        className="w-full h-full"
      />
    </div>
  );
}

