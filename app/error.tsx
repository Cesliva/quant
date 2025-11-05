"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center space-y-4 max-w-md mx-auto p-8">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900">Something went wrong!</h1>
        <p className="text-gray-600">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-500">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-4 justify-center pt-4">
          <Button variant="primary" onClick={reset}>
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

