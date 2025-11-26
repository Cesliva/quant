"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { formatActivity } from "@/lib/utils/activityLogger";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { Clock } from "lucide-react";

interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details?: any;
  timestamp: any;
}

interface ActivityFeedProps {
  projectId: string | null;
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({ projectId, maxItems = 20, className = "" }: ActivityFeedProps) {
  const companyId = useCompanyId();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId || !companyId) {
      return;
    }

    const activitiesPath = `companies/${companyId}/projects/${projectId}/activities`;
    const unsubscribe = subscribeToCollection<Activity>(
      activitiesPath,
      (data) => {
        // Sort by timestamp descending and limit
        const sorted = data
          .sort((a, b) => {
            const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return bTime - aTime;
          })
          .slice(0, maxItems);
        setActivities(sorted);
      }
    );

    return () => unsubscribe();
  }, [projectId, companyId, maxItems]);

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "Just now";
    
    const time = timestamp.toMillis ? timestamp.toMillis() : timestamp;
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!projectId) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-2 text-sm border-b border-gray-100 pb-2 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{activity.userName}</span>
                  {" "}
                  <span className="text-gray-600">{formatActivity(activity.action)}</span>
                  {activity.details && Object.keys(activity.details).length > 0 && (
                    <span className="text-gray-400 ml-1">
                      ({Object.entries(activity.details).map(([k, v]) => `${k}: ${v}`).join(", ")})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatTime(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

