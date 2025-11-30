"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { AuditLog, formatAuditLogForDisplay } from "@/lib/utils/auditLog";
import { Clock, User, FileText, Settings, Download, Trash2, Plus, Edit } from "lucide-react";

interface RecentActivityProps {
  companyId: string;
  projectId?: string;
  limit?: number;
}

export default function RecentActivity({ companyId, projectId, limit = 10 }: RecentActivityProps) {
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      setLoading(false);
      return;
    }

    const auditLogsPath = `companies/${companyId}/auditLogs`;
    
    // Subscribe to audit logs
    const unsubscribe = subscribeToCollection<AuditLog>(
      auditLogsPath,
      (logs) => {
        // Filter by project if specified
        let filteredLogs = logs;
        if (projectId) {
          filteredLogs = logs.filter(log => log.projectId === projectId);
        }
        
        // Sort by timestamp (newest first) and limit
        const sorted = filteredLogs
          .sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return timeB - timeA;
          })
          .slice(0, limit);
        
        setActivities(sorted);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading audit logs:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId, limit]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'UPDATE':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'DELETE':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'EXPORT':
        return <Download className="w-4 h-4 text-purple-600" />;
      case 'IMPORT':
        return <FileText className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatTime = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm">Loading activity...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <div
              key={activity.id || index}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="mt-0.5">
                {getActionIcon(activity.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {activity.userName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {activity.description || formatAuditLogForDisplay(activity)}
                </p>
                {activity.changes && activity.changes.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {activity.changes.length} field{activity.changes.length > 1 ? 's' : ''} changed
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

