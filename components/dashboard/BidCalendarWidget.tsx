"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import BidProductionScheduleModal from "./BidProductionScheduleModal";
import { cn } from "@/lib/utils/cn";

interface BidEvent {
  id?: string;
  date: string; // YYYY-MM-DD format
  projectName: string;
  projectId?: string;
  generalContractor: string;
  bidTime?: string; // Time in HH:mm format
  notes?: string;
  status: "draft" | "active" | "submitted" | "won" | "lost";
  estimatedValue?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface BidCalendarWidgetProps {
  companyId: string;
  className?: string;
}

export default function BidCalendarWidget({ companyId, className }: BidCalendarWidgetProps) {
  const [events, setEvents] = useState<BidEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load events from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const eventsPath = `companies/${companyId}/bidEvents`;
    const unsubscribe = subscribeToCollection<BidEvent>(
      eventsPath,
      (data) => {
        setEvents(data);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Get upcoming bids (all future bids, not just next 7 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Get all future bids (including beyond 7 days)
  const allFutureBids = events
    .filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today; // All future bids, not just next 7 days
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5); // Show top 5 upcoming

  // Use allFutureBids for display, but keep upcomingBids for "This Week" count
  const upcomingBids = allFutureBids;

  // Get today's bids
  const todayStr = today.toISOString().split("T")[0];
  const todayBids = events.filter(event => event.date === todayStr);

  // Get this week's bid count
  const thisWeekBids = events.filter(event => {
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today && eventDate <= nextWeek;
  }).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (dateStr === today.toISOString().split("T")[0]) {
      return "Today";
    } else if (dateStr === tomorrow.toISOString().split("T")[0]) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <>
      <Card className={cn("border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white h-full", className)}>
        <CardHeader className="pb-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Calendar className="w-5 h-5 text-blue-600" />
              Bid-Production Schedule Snapshot
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 border-2"
            >
              Open Schedule
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-6 mb-6 pb-6 border-b border-gray-200">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">{todayBids.length}</div>
              <div className="text-sm text-gray-600 font-medium">Today</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">{thisWeekBids}</div>
              <div className="text-sm text-gray-600 font-medium">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">{events.length}</div>
              <div className="text-sm text-gray-600 font-medium">Total</div>
            </div>
          </div>

          {/* Upcoming Bids List */}
          <div className="space-y-3">
            {upcomingBids.length > 0 ? (
              upcomingBids.map((bid) => {
                const daysUntil = getDaysUntil(bid.date);
                const isUrgent = daysUntil <= 3;

                return (
                  <div
                    key={bid.id}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                      isUrgent
                        ? "bg-orange-50 border-orange-200 hover:border-orange-300"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                          <h4 className="font-semibold text-gray-900 text-base truncate">
                            {bid.projectName}
                          </h4>
                          {isUrgent && (
                            <span className="px-2.5 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-semibold whitespace-nowrap">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2 font-medium">{bid.generalContractor}</p>
                        <div className="flex items-center gap-2.5 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(bid.date)}</span>
                          {daysUntil > 0 && (
                            <span className="text-gray-400">• {daysUntil} days</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">No Upcoming Bids</h3>
                <p className="text-sm text-gray-500 mb-4">Schedule your first bid to get started</p>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsModalOpen(true)}
                  className="border-2"
                >
                  Add Bid
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full Calendar Modal */}
      {isModalOpen && (
        <BidProductionScheduleModal
          companyId={companyId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

