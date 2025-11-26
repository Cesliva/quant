"use client";

import { Lightbulb, Target, Activity, Clock3 } from "lucide-react";
import WidgetTile from "./widgets/WidgetTile";

interface ProjectSummary {
  id: string;
  status?: string;
  bidDueDate?: string;
  estimatedValue?: number | string;
  winProbability?: number;
}

interface AIInsightsWidgetProps {
  projects: ProjectSummary[];
  winRate: number;
  totalBids: number;
  className?: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function AIInsightsWidget({
  projects,
  winRate,
  totalBids,
  className,
}: AIInsightsWidgetProps) {
  const activeBids = projects.filter((p) => p.status === "active");
  const totalPipelineValue = activeBids.reduce((sum, project) => {
    const value =
      typeof project.estimatedValue === "string"
        ? parseFloat(project.estimatedValue) || 0
        : project.estimatedValue || 0;
    const probability = project.winProbability ?? 0.5;
    return sum + value * probability;
  }, 0);

  const nextDue = [...projects]
    .filter((p) => p.bidDueDate)
    .sort(
      (a, b) => new Date(a.bidDueDate || "").getTime() - new Date(b.bidDueDate || "").getTime()
    )[0];

  const insights = [
    {
      icon: <Activity className="w-4 h-4 text-blue-600" />,
      label: "Weighted Pipeline",
      primary: formatCurrency(totalPipelineValue),
      support: `${activeBids.length} active bids`,
    },
    {
      icon: <Target className="w-4 h-4 text-emerald-600" />,
      label: "Win Rate (90d)",
      primary: `${winRate.toFixed(1)}%`,
      support: `${totalBids} logged decisions`,
    },
    nextDue
      ? {
          icon: <Clock3 className="w-4 h-4 text-orange-500" />,
          label: "Next Due",
          primary: new Date(nextDue.bidDueDate!).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          support: nextDue.status ? nextDue.status.toUpperCase() : "Bid",
        }
      : {
          icon: <Clock3 className="w-4 h-4 text-slate-500" />,
          label: "Next Due",
          primary: "No deadlines",
          support: "Add bids to track urgency",
        },
  ];

  return (
    <WidgetTile
      size="large"
      gradient="from-blue-500/90 via-indigo-500/90 to-sky-500/90"
      borderColor="border-white/20"
      className={className}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Lightbulb className="w-5 h-5" />
          <p className="text-base font-semibold tracking-tight">AI Insights</p>
        </div>
        <span className="text-xs font-semibold text-white/70 tracking-[0.4em]">LIVE</span>
      </div>
      <p className="text-sm text-white/80">
        Prioritized signals from current bids and win/loss data.
      </p>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-2xl border border-white/40 bg-white/10 px-4 py-3 shadow-sm backdrop-blur-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 shadow-inner">
                {insight.icon}
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                  {insight.label}
                </p>
                <p className="text-sm font-semibold text-gray-600">{insight.support}</p>
              </div>
            </div>
            <p className="text-lg font-extrabold text-white">{insight.primary}</p>
          </div>
        ))}
      </div>
    </WidgetTile>
  );
}

