"use client";

import { Suspense, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils/cn";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Hide sidebar on company dashboard
  const isDashboardPage = pathname === "/dashboard";

  useEffect(() => {
    // CRITICAL SECURITY: Immediately redirect to login if not authenticated
    // This must happen BEFORE any dashboard content is rendered
    // Also check that user has valid email (required for real authentication)
    if (!loading && (!user || !user.email || user.uid === "dev-user") && pathname !== "/") {
      router.replace("/login");
      return;
    }
  }, [user, loading, router, pathname]);

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

  // CRITICAL SECURITY: Don't render ANY dashboard content if not authenticated
  // Also verify user has valid email (required for real authentication)
  // Return loading state while redirect happens
  if (!user || !user.email || user.uid === "dev-user") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {!isDashboardPage && (
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
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isDashboardPage && <Header />}
        <main className={cn("flex-1 overflow-x-auto min-w-0", isDashboardPage ? "" : "p-6")}>{children}</main>
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

