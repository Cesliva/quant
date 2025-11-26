"use client";

import { Sparkles, ShieldCheck, Lock, ClipboardCheck } from "lucide-react";
import WidgetTile from "./widgets/WidgetTile";

interface Recommendation {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
}

interface AIRecommendationsWidgetProps {
  className?: string;
}

const recommendations: Recommendation[] = [
  {
    title: "Run Spec Compliance",
    description: "Division 5 + Division 09 pending review.",
    icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
    badge: "AI",
  },
  {
    title: "Lock Estimate Summary",
    description: "Columbia AirPort pending executive approval.",
    icon: <Lock className="w-4 h-4 text-amber-500" />,
    badge: "Workflow",
  },
  {
    title: "Publish Budget Codes",
    description: "Apply standard Fortune 500 template.",
    icon: <ClipboardCheck className="w-4 h-4 text-emerald-500" />,
    badge: "Finance",
  },
  {
    title: "Confirm Risk Mitigation",
    description: "Review AESS weld schedule adders.",
    icon: <ShieldCheck className="w-4 h-4 text-rose-500" />,
    badge: "Risk",
  },
];

export default function AIRecommendationsWidget({ className }: AIRecommendationsWidgetProps) {
  return (
    <WidgetTile size="medium" className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <p className="text-base font-semibold text-gray-900">Recommended Next Steps</p>
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gray-400">AI</span>
      </div>
      <p className="text-sm text-gray-600">
        AI-driven checklist for estimators + leadership.
      </p>
      <div className="space-y-3">
        {recommendations.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 flex items-start gap-3"
          >
            <div className="p-2 rounded-xl bg-white shadow-sm border border-white">{item.icon}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                  {item.badge}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetTile>
  );
}

