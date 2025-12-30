"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { 
  FileText, 
  ClipboardList, 
  FileCheck, 
  FileEdit,
  Home,
  Upload,
  Package,
  Building2,
  ArrowLeft,
  Sparkles,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { QMark } from "@/components/ui/QMark";

const navigation = [
  { name: "Structural Steel Estimate", href: "/estimating", icon: ClipboardList },
  // { name: "Misc Metals AI", href: "/misc-metals", icon: Package, aiIcon: Sparkles }, // Removed - will be in a later version
  { name: "AI Spec Review", href: "/spec-review", icon: FileCheck, aiIcon: Sparkles },
  { name: "AI Generated Proposal", href: "/proposal", icon: FileEdit, aiIcon: Sparkles },
];

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectIdFromParams = params?.id as string | undefined;
  const projectIdFromQuery = searchParams?.get("projectId");
  const projectId = projectIdFromParams || projectIdFromQuery || undefined;
  
  // Check if we're on a project sub-page (either in /projects/[id] or with projectId query param)
  const hasProjectIdInPath = pathname?.startsWith("/projects/") && projectIdFromParams;
  const hasProjectIdInQuery = Boolean(projectIdFromQuery);
  const isProjectPage = hasProjectIdInPath || hasProjectIdInQuery;
  const isProjectDashboard = pathname === `/projects/${projectIdFromParams}`;
  const isProjectSubPage = isProjectPage && !isProjectDashboard;
  const isReportsPage = pathname === `/projects/${projectIdFromParams}/reports`;
  const isProjectDetailsPage = false; // Details page removed - consolidated into dashboard
  
  // Check if we're on the settings page
  const isSettingsPage = pathname === "/settings" || pathname?.startsWith("/settings");

  // Collapsed state - ALWAYS start collapsed by default on all pages
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    // Always start collapsed on every page load/navigation
    // Clear any saved expanded state to ensure default collapsed behavior
    setIsCollapsed(true);
    localStorage.removeItem("sidebarCollapsed");
    localStorage.removeItem("sidebarUserToggled");
  }, [pathname]); // Reset to collapsed on every route change

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Don't persist state - always reset to collapsed on page navigation
  };

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 min-h-screen transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className={cn("p-4", isCollapsed && "px-2")}>
      {/* Toggle Button */}
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
        <Link href="/" className="block" title={isCollapsed ? "Quant Estimating AI" : undefined}>
          {isCollapsed ? (
            <div className="flex flex-col items-center">
              <QMark px={32} className="w-8 h-8" />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">Quant Estimating AI</h2>
              <p className="text-sm text-gray-600">Project Details</p>
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
        
        {!isSettingsPage && isProjectPage && projectId && (
          <>
            <Link
              href={`/projects/${projectId}`}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                isCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                isProjectDashboard
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              title={isCollapsed ? "Project Dashboard" : undefined}
            >
              <Building2 className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>Project Dashboard</span>}
            </Link>
            <Link
              href={`/projects/${projectId}/reports`}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                isCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                isReportsPage
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              title={isCollapsed ? "Structural Steel Estimate Summary" : undefined}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>Structural Steel Estimate Summary</span>}
            </Link>
          </>
        )}
        {!isSettingsPage && navigation.map((item) => {
          const Icon = item.icon;
          const AiIcon = (item as any).aiIcon;
          
          // If on a project page, use project-specific routes
          let href = item.href;
          if (isProjectPage && projectId) {
            // Map navigation items to project-specific routes
            if (item.name === "Structural Steel Estimate") {
              href = `/projects/${projectId}/estimating`;
            } else if (item.name === "AI Spec Review") {
              href = `/spec-review?projectId=${projectId}`;
            } else if (item.name === "AI Generated Proposal") {
              href = `/proposal?projectId=${projectId}`;
            }
          }
          
          // Determine if this navigation item is active
          const isActive = (() => {
            // Check exact pathname matches first
            if (item.name === "Structural Steel Estimate") {
              if (isProjectPage && projectId) {
                return pathname === `/projects/${projectId}/estimating`;
              }
              return pathname === "/estimating" && !projectIdFromQuery;
            }
            if (item.name === "AI Spec Review") {
              if (isProjectPage && projectId) {
                return pathname === "/spec-review" && projectIdFromQuery === projectId;
              }
              return pathname === "/spec-review" && !projectIdFromQuery;
            }
            if (item.name === "AI Generated Proposal") {
              if (isProjectPage && projectId) {
                return pathname === "/proposal" && projectIdFromQuery === projectId;
              }
              return pathname === "/proposal" && !projectIdFromQuery;
            }
            // Fallback: check if pathname starts with the base href (without query params)
            const baseHref = item.href.split("?")[0];
            return pathname === baseHref || pathname?.startsWith(baseHref + "/");
          })();
          
          return (
            <Link
              key={item.name}
              href={href}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                isCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                isActive
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {AiIcon && (
                  <AiIcon className="w-3 h-3 absolute -top-1 -right-1 text-purple-500" />
                )}
              </div>
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}

