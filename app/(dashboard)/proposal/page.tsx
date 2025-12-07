"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";

// Redirect to enhanced proposal page
function ProposalPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get("projectId");

  useEffect(() => {
    // Redirect to enhanced proposal page
    const enhancedPath = projectId 
      ? `/proposal/enhanced?projectId=${projectId}`
      : "/proposal/enhanced";
    router.replace(enhancedPath);
  }, [projectId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading enhanced proposal page...</p>
      </div>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <ProposalPageContent />
    </Suspense>
  );
}
