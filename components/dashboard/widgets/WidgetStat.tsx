"use client";

import { ReactNode } from "react";
import WidgetTile from "./WidgetTile";
import { cn } from "@/lib/utils/cn";

interface WidgetStatProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  gradient?: string;
  size?: "medium" | "small" | "mini";
  className?: string;
}

export default function WidgetStat({
  label,
  value,
  sublabel,
  icon,
  gradient,
  size = "medium",
  className,
}: WidgetStatProps) {
  return (
    <WidgetTile
      size={size}
      gradient={gradient}
      className={cn("space-y-3", className)}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-[11px] uppercase tracking-[0.4em] font-semibold",
            gradient ? "text-white/80" : "text-gray-500"
          )}
        >
          {label}
        </p>
        {icon && <div className="text-white">{icon}</div>}
      </div>
      <div className="text-4xl font-black">{value}</div>
      {sublabel && (
        <p
          className={cn(
            "text-sm font-semibold",
            gradient ? "text-white/80" : "text-gray-600"
          )}
        >
          {sublabel}
        </p>
      )}
    </WidgetTile>
  );
}

