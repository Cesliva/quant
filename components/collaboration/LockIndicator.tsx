"use client";

import { useEditLock } from "@/lib/hooks/useEditLock";
import { Lock, Unlock } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

interface LockIndicatorProps {
  projectId: string | null;
  section: string;
  className?: string;
}

export function LockIndicator({ projectId, section, className = "" }: LockIndicatorProps) {
  const { lock, isLocked, canEdit, acquireLock, releaseLock } = useEditLock(projectId, section);
  const { user } = useAuth();

  if (!projectId || !lock) {
    return null;
  }

  // If locked by current user, show unlock option
  if (lock.userId === user?.uid) {
    return (
      <div className={`flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded ${className}`}>
        <Unlock className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-800">You have this section locked</span>
        <button
          onClick={releaseLock}
          className="ml-auto text-xs text-green-600 hover:text-green-800 underline"
        >
          Unlock
        </button>
      </div>
    );
  }

  // If locked by another user
  if (isLocked) {
    return (
      <div className={`flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded ${className}`}>
        <Lock className="w-4 h-4 text-yellow-600" />
        <span className="text-sm text-yellow-800">
          <span className="font-medium">{lock.userName}</span> is editing this section
        </span>
      </div>
    );
  }

  return null;
}

