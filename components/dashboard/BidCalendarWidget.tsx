"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { 
  subscribeToCollection
} from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import BidCalendarModal from "./BidCalendarModal";

interface BidEvent {
  id?: string;
  date: string; // YYYY-MM-DD format
  projectName: string;
  projectId?: string;
  generalContractor: string;
  notes?: string;
  status: "draft" | "active" | "submitted" | "won" | "lost";
  estimatedValue?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface BidCalendarWidgetProps {
  companyId: string;
}

export default function BidCalendarWidget({ companyId }: BidCalendarWidgetProps) {
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
      <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Upcoming Bids
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2"
            >
              View Full Calendar
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{todayBids.length}</div>
              <div className="text-xs text-gray-600">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{thisWeekBids}</div>
              <div className="text-xs text-gray-600">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{events.length}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
          </div>

          {/* Upcoming Bids List */}
          <div className="space-y-2 mt-6">
            {upcomingBids.length > 0 ? (
              upcomingBids.map((bid) => {
                const daysUntil = getDaysUntil(bid.date);
                const isUrgent = daysUntil <= 3;

                return (
                  <div
                    key={bid.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isUrgent
                        ? "bg-orange-50 border-orange-200"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">
                            {bid.projectName}
                          </h4>
                          {isUrgent && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full font-medium whitespace-nowrap">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{bid.generalContractor}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
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
              <div className="text-center py-8 text-gray-500 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-4 text-gray-400" />
                <p>No upcoming bids</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4"
                >
                  Add Bid
                </Button>
              </div>
            )}
          </div>

          {upcomingBids.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="w-full flex items-center justify-center"
              >
                View All Bids in Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Calendar Modal */}
      {isModalOpen && (
        <BidCalendarModal
          companyId={companyId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

