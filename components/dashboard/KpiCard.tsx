"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface KpiCardProps {
  id: string;
  title: string;
  icon: ReactNode;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  accentColor: string;
  iconBgColor: string;
  iconColor: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
  expandedContent?: ReactNode;
  className?: string;
  tooltip?: ReactNode;
}

export default function KpiCard({
  id,
  title,
  icon,
  gradientFrom,
  gradientVia,
  gradientTo,
  accentColor,
  iconBgColor,
  iconColor,
  isExpanded,
  onToggle,
  children,
  expandedContent,
  className,
  tooltip,
}: KpiCardProps) {
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);

  // Measure expanded content height
  useEffect(() => {
    if (isExpanded && expandedRef.current) {
      setExpandedHeight(expandedRef.current.scrollHeight);
    } else {
      setExpandedHeight(null);
    }
  }, [isExpanded, expandedContent]);

  const handleClick = () => {
    onToggle(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Map gradient colors to Tailwind classes
  const gradientClass = {
    "blue-50": "from-blue-50 via-white to-blue-100/50",
    "green-50": "from-green-50 via-white to-emerald-100/50",
    "purple-50": "from-purple-50 via-white to-violet-100/50",
    "amber-50": "from-amber-50 via-white to-yellow-100/50",
    "red-50": "from-red-50 via-white to-rose-100/50",
  }[gradientFrom] || "from-gray-50 via-white to-gray-100/50";

  const accentGradientClass = {
    "blue-500": "from-blue-500 to-blue-600",
    "green-500": "from-green-500 to-emerald-600",
    "purple-500": "from-purple-500 to-violet-600",
    "amber-500": "from-amber-500 to-yellow-600",
    "red-500": "from-red-500 to-rose-600",
  }[accentColor] || "from-gray-500 to-gray-600";

  return (
    <Card
      className={cn(
        "border-0 shadow-2xl bg-gradient-to-br transition-all duration-300 overflow-hidden relative min-w-0",
        gradientClass,
        isExpanded
          ? "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
          : "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:-translate-y-2",
        className
      )}
      style={{
        opacity: isExpanded ? 1 : undefined,
        transform: isExpanded ? undefined : undefined,
      }}
    >
      <div
        className={cn(
          "absolute top-0 left-0 w-full h-1 bg-gradient-to-r transition-all duration-300",
          accentGradientClass
        )}
      />
      
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="cursor-pointer"
      >
        <CardHeader className="pb-5">
          <CardTitle className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={cn("p-2 rounded-lg", iconBgColor)}>
                <div className={iconColor}>{icon}</div>
              </div>
              <span>{title}</span>
            </div>
            <div className="flex items-center gap-2">
              {tooltip}
              <div className="flex items-center gap-1">
                {isExpanded ? (
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                )}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </div>

      {/* Expanded Panel */}
      {expandedContent && (
        <div
          ref={expandedRef}
          className={cn(
            "overflow-hidden transition-all duration-[200ms] ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
          style={{
            maxHeight: isExpanded && expandedHeight !== null ? `${expandedHeight}px` : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-4 pb-2 2xl:pt-6 2xl:pb-4 border-t border-gray-200/50 mt-4 2xl:mt-5">
            {expandedContent}
          </div>
        </div>
      )}
    </Card>
  );
}
