import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

