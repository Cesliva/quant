"use client";

import { CalendarDays, MapPin, AlertCircle } from "lucide-react";
import WidgetTile from "./widgets/WidgetTile";
import { cn } from "@/lib/utils/cn";

interface MilestoneItem {
  id: string;
  name: string;
  bidDate: string;
  gc?: string;
  status?: string;
}

interface UpcomingMilestonesWidgetProps {
  milestones: MilestoneItem[];
  className?: string;
}

export default function UpcomingMilestonesWidget({
  milestones,
  className,
}: UpcomingMilestonesWidgetProps) {
  const formattedMilestones = milestones.slice(0, 3);

  const dateFormatter = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const daysUntil = (value: string) => {
    const today = new Date();
    const target = new Date(value);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <WidgetTile size="medium" className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-purple-500" />
          <p className="text-base font-semibold text-gray-900">Upcoming Milestones</p>
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gray-400">Schedule</span>
      </div>
      <div className="space-y-4">
        {formattedMilestones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-gray-900 mb-1">No upcoming bids</p>
            <p className="text-xs text-gray-500">
              Add bid dates to populate this panel automatically.
            </p>
          </div>
        ) : (
          formattedMilestones.map((milestone) => {
            const days = daysUntil(milestone.bidDate);
            const isUrgent = days <= 3;
            return (
              <div
                key={milestone.id}
                className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{milestone.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {milestone.gc || "GC TBD"}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mt-1">
                    {milestone.status || "Bid"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{dateFormatter(milestone.bidDate)}</p>
                  <p
                    className={cn(
                      "text-xs font-semibold flex items-center justify-end gap-1",
                      isUrgent ? "text-orange-600" : "text-gray-500"
                    )}
                  >
                    {isUrgent && <AlertCircle className="w-3 h-3" />}
                    {days > 0 ? `${days}d` : "Due"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </WidgetTile>
  );
}

