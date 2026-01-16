"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DashboardShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function DashboardShell({
  children,
  className,
  contentClassName,
}: DashboardShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 text-slate-800",
        className
      )}
    >
      <div
        className={cn(
          "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
