"use client";

import { useUserPresence } from "@/lib/hooks/useUserPresence";
import { Users } from "lucide-react";

interface UserPresenceProps {
  projectId: string | null;
  currentPage?: string;
  className?: string;
}

export function UserPresence({ projectId, currentPage = "details", className = "" }: UserPresenceProps) {
  const { activeUsers } = useUserPresence(projectId, currentPage);

  if (!projectId || activeUsers.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Users className="w-4 h-4 text-gray-400" />
      <span className="text-sm text-gray-500">Active:</span>
      <div className="flex items-center gap-2">
        {activeUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full"
            title={`${user.name} - viewing ${user.viewing}`}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-700">{user.name}</span>
            <span className="text-xs text-gray-400">({user.viewing})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

