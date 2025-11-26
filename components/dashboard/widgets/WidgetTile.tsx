"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type WidgetSize = "hero" | "large" | "medium" | "small" | "mini";

interface WidgetTileProps {
  children: ReactNode;
  size?: WidgetSize;
  gradient?: string;
  className?: string;
  borderColor?: string;
}

const sizeMap: Record<WidgetSize, string> = {
  hero: "min-h-[320px]",
  large: "min-h-[260px]",
  medium: "min-h-[220px]",
  small: "min-h-[180px]",
  mini: "min-h-[140px]",
};

export default function WidgetTile({
  children,
  size = "medium",
  gradient,
  className,
  borderColor = "border-white/20",
}: WidgetTileProps) {
  return (
    <div
      className={cn(
        "rounded-[30px] border shadow-[0_25px_60px_-30px_rgba(6,24,44,0.5)] backdrop-blur-xl relative overflow-hidden",
        gradient
          ? `bg-gradient-to-br ${gradient} text-white`
          : "bg-white/95 text-gray-900",
        sizeMap[size],
        borderColor,
        "p-6 flex flex-col gap-4",
        className
      )}
    >
      {gradient && (
        <div className="pointer-events-none absolute inset-0 bg-white/5 mix-blend-soft-light" />
      )}
      <div className="relative z-10 flex-1 flex flex-col gap-4">{children}</div>
    </div>
  );
}

