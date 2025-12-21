"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated (after loading completes)
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900">Quant Estimating AI</h2>
            <p className="text-sm text-gray-600">Project Details</p>
          </div>
        </div>
      }>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 p-6 overflow-x-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

