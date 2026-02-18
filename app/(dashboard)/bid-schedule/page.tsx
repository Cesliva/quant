"use client";

import { Suspense } from "react";
import BidProductionScheduleModal from "@/components/dashboard/BidProductionScheduleModal";
import { useCompanyId } from "@/lib/hooks/useCompanyId";

function BidScheduleContent() {
  const companyId = useCompanyId();

  return (
    <BidProductionScheduleModal
      companyId={companyId}
      isOpen={true}
      onClose={() => {}}
      asPage={true}
    />
  );
}

export default function BidSchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <BidScheduleContent />
    </Suspense>
  );
}

