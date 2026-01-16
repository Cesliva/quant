"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface KpiExpandedPanelProps {
  children: ReactNode;
  className?: string;
}

export default function KpiExpandedPanel({
  children,
  className,
}: KpiExpandedPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}

interface ExpandedSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function ExpandedSection({
  title,
  children,
  className,
}: ExpandedSectionProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h4>
      )}
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}
