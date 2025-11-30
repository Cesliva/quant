"use client";

import { Suspense } from "react";
import CompanyAddressBook from "@/components/settings/CompanyAddressBook";
import { useCompanyId } from "@/lib/hooks/useCompanyId";

function AddressBookContent() {
  const companyId = useCompanyId();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight mb-2 text-slate-900">Company Address Book</h1>
          <p className="text-slate-600">Manage your customer, contractor, and vendor contacts</p>
        </div>
        <CompanyAddressBook companyId={companyId} compact={false} />
      </div>
    </div>
  );
}

export default function AddressBookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <AddressBookContent />
    </Suspense>
  );
}

