"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { Home, ChevronLeft, ChevronRight } from "lucide-react";
import { QMark } from "@/components/ui/QMark";

export default function Sidebar() {
  const pathname = usePathname();

  const { isCollapsed, setCollapsed } = useSidebar();

  useEffect(() => {
    setCollapsed(true);
    localStorage.removeItem("sidebarCollapsed");
    localStorage.removeItem("sidebarUserToggled");
  }, [pathname, setCollapsed]);

  const toggleSidebar = () => setCollapsed(!isCollapsed);

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-30 h-screen bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("p-4", isCollapsed && "px-2")}>
        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute top-4 right-0 translate-x-1/2 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors z-10",
            isCollapsed ? "rotate-180" : ""
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
        </button>

        <div className={cn("mb-8", isCollapsed && "mb-4")}>
          <Link
            href="/dashboard"
            className="block"
            title={isCollapsed ? "Quant Estimating AI — Company Dashboard" : undefined}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center">
                <QMark px={32} className="w-8 h-8" />
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                  Quant Estimating AI
                </h2>
                <p className="text-sm text-gray-600">Company Dashboard</p>
              </>
            )}
          </Link>
        </div>

        <nav className="space-y-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center rounded-lg transition-colors",
              isCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
              pathname === "/dashboard"
                ? "bg-gray-100 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            )}
            title={isCollapsed ? "Company Dashboard" : undefined}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>Company Dashboard</span>}
          </Link>
        </nav>
      </div>
    </div>
  );
}
