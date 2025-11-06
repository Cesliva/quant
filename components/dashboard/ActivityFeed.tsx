"use client";

import { useState, useEffect } from "react";
import { Clock, FileText, CheckCircle, XCircle, Mic, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface ActivityItem {
  id: string;
  type: "estimate" | "win" | "loss" | "voice" | "ai";
  message: string;
  timestamp: Date;
  projectName?: string;
}

interface ActivityFeedProps {
  companyId: string;
}

export default function ActivityFeed({ companyId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Mock activities - replace with real Firestore queries
    const mockActivities: ActivityItem[] = [
      {
        id: "1",
        type: "estimate",
        message: "New estimate created",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        projectName: "Downtown Office Building",
      },
      {
        id: "2",
        type: "win",
        message: "Project won",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        projectName: "Industrial Warehouse",
      },
      {
        id: "3",
        type: "voice",
        message: "Voice input processed",
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        projectName: "Bridge Restoration",
      },
      {
        id: "4",
        type: "ai",
        message: "Spec review completed",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        projectName: "Downtown Office Building",
      },
      {
        id: "5",
        type: "estimate",
        message: "Estimate updated",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        projectName: "Industrial Warehouse",
      },
    ];

    setActivities(mockActivities);
  }, [companyId]);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "estimate":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "win":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "loss":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "voice":
        return <Mic className="w-4 h-4 text-purple-600" />;
      case "ai":
        return <Sparkles className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "estimate":
        return "bg-blue-50 border-blue-200";
      case "win":
        return "bg-green-50 border-green-200";
      case "loss":
        return "bg-red-50 border-red-200";
      case "voice":
        return "bg-purple-50 border-purple-200";
      case "ai":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-5 h-5 text-gray-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`p-3 rounded-lg border ${getActivityColor(activity.type)} transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  {activity.projectName && (
                    <p className="text-xs text-gray-600 mt-0.5">{activity.projectName}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

