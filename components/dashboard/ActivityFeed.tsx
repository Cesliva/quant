"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, FileText, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { cn } from "@/lib/utils/cn";

interface ActivityItem {
  id: string;
  type: "estimate" | "win" | "loss" | "voice" | "ai";
  message: string;
  timestamp: Date;
  projectName?: string;
}

interface ActivityFeedProps {
  companyId: string;
  className?: string;
}

export default function ActivityFeed({ companyId, className }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setProjects([]);
      return () => {};
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<any>(projectsPath, (docs) => {
      setProjects(docs || []);
    });

    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    const getDateFromField = (value: any): Date | null => {
      if (!value) return null;
      if (typeof value.toDate === "function") {
        return value.toDate();
      }
      if (value instanceof Date) {
        return value;
      }
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    };

    const calculatedActivities: ActivityItem[] = [];

    projects.forEach((project) => {
      const createdAt = getDateFromField(project.createdAt) || new Date();
      const updatedAt = getDateFromField(project.updatedAt) || createdAt;
      const hasUpdated =
        updatedAt.getTime() - createdAt.getTime() > 60 * 1000; // more than 1 minute difference

      let type: ActivityItem["type"] = "estimate";
      let message = "New project created";
      let timestamp = createdAt;

      if (project.status === "won") {
        type = "win";
        message = "Project won";
        timestamp = updatedAt;
      } else if (project.status === "lost") {
        type = "loss";
        message = "Project lost";
        timestamp = updatedAt;
      } else if (hasUpdated) {
        type = "estimate";
        message = "Project updated";
        timestamp = updatedAt;
      }

      calculatedActivities.push({
        id: `${project.id}-${timestamp.getTime()}`,
        type,
        message,
        timestamp,
        projectName: project.projectName || "Untitled Project",
      });
    });

    calculatedActivities.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    setActivities(calculatedActivities.slice(0, 8));
  }, [projects]);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "estimate":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "win":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "loss":
        return <XCircle className="w-4 h-4 text-red-600" />;
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
    <Card className={cn("border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white h-full", className)}>
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 tracking-normal">
          <Clock className="w-5 h-5 text-gray-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 tracking-normal mb-2">No Recent Activity</h3>
            <p className="text-sm text-gray-500">Activity will appear here as you work on projects</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={`p-4 rounded-xl border-2 ${getActivityColor(activity.type)} transition-all duration-200 hover:shadow-md`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{activity.message}</p>
                    {activity.projectName && (
                      <p className="text-sm text-gray-600 mt-1 font-medium">{activity.projectName}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1.5">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

