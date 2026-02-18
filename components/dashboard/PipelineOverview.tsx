import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { TrendingUp, Activity, Layers } from "lucide-react";

interface PipelineProject {
  estimatedValue?: number | string;
  bidDueDate?: string;
  status?: string;
}

interface PipelineOverviewProps {
  projects: PipelineProject[];
  winRate?: number;
  totalBids?: number;
  compact?: boolean;
}

const MONTHS_TO_SHOW = 6;

export default function PipelineOverview({
  projects,
  winRate = 0,
  totalBids = 0,
  compact = false,
}: PipelineOverviewProps) {
  const now = new Date();
  const months: { label: string; value: number }[] = [];

  for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: date.toLocaleString("en-US", { month: "short" }),
      value: 0,
    });
  }

  let totalPipeline = 0;
  let awardedCount = 0;

  projects.forEach((project) => {
    const rawValue =
      typeof project.estimatedValue === "string"
        ? parseFloat(project.estimatedValue)
        : project.estimatedValue;

    const value = Number.isFinite(rawValue) ? (rawValue as number) : 0;
    totalPipeline += value;
    if (project.status === "won") awardedCount += 1;

    if (!project.bidDueDate || !value) return;

    const bidDate = new Date(project.bidDueDate);
    months.forEach((month) => {
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - (MONTHS_TO_SHOW - 1 - months.indexOf(month)),
        1
      );
      if (
        bidDate.getFullYear() === monthDate.getFullYear() &&
        bidDate.getMonth() === monthDate.getMonth()
      ) {
        month.value += value;
      }
    });
  });

  const maxMonthValue =
    Math.max(...months.map((m) => m.value), 1) || 1;

  const avgBid =
    projects.length > 0 ? totalPipeline / projects.length : 0;

  if (compact) {
    return (
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-indigo-50 via-white to-blue-100/60 hover:-translate-y-2 transition-all duration-300 overflow-hidden relative min-w-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <CardTitle className="flex items-center gap-2 text-xs font-extrabold text-gray-900 uppercase tracking-wide">
            <Activity className="w-4 h-4 text-indigo-600" />
            Pipeline Outlook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Weighted Pipeline
              </p>
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                ${totalPipeline.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-3.5 h-3.5" />
                {winRate.toFixed(1)}% win rate
              </span>
              <span className="flex items-center gap-1 text-purple-600">
                <Layers className="w-3.5 h-3.5" />
                {totalBids} bids
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-lg bg-white h-full">
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 tracking-normal">
          <Activity className="w-5 h-5 text-blue-600" />
          Pipeline Outlook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5">
          <div className="text-sm font-semibold text-blue-800 mb-1">
            Weighted Pipeline
          </div>
          <div className="text-3xl font-extrabold text-gray-900 tracking-tight mb-4">
            ${totalPipeline.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              {winRate.toFixed(1)}% win rate
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-4 h-4 text-purple-600" />
              {totalBids} logged bids
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900 tracking-normal">
              6-Month Bid Value Trend
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              USD (k)
            </span>
          </div>
          <div className="flex items-end gap-2 h-32 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            {months.map((month) => {
              const percentage = (month.value / maxMonthValue) * 100;
              return (
                <div
                  key={month.label}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-blue-500 to-blue-300 transition-all duration-200"
                      style={{
                        height: `${percentage}%`,
                        minHeight: percentage > 0 ? "6px" : "0px",
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {month.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
              Avg Bid Size
            </p>
            <p className="text-xl font-bold text-emerald-900">
              ${avgBid.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50/70 p-4">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
              Awards YTD
            </p>
            <p className="text-xl font-bold text-purple-900">{awardedCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

