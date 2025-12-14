"use client";

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
  FolderKanban,
  Settings,
  TrendingUp,
  Shield,
  BookOpen,
  Calendar,
} from "lucide-react";
import { QMark } from "../ui/QMark";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";

const navigation = [
  { name: "Structural Steel Estimate", href: "/estimating", icon: ClipboardList },
  { name: "AI Spec Review", href: "/spec-review", icon: FileCheck, aiIcon: Sparkles },
  { name: "AI Generated Proposal", href: "/proposal/enhanced", icon: FileEdit, aiIcon: Sparkles },
  { name: "Import Quotes", href: "/import-quotes", icon: Upload },
];

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const { permissions, loading: permissionsLoading } = useUserPermissions();
  const projectIdFromParams = params?.id as string | undefined;
  const projectIdFromQuery = searchParams?.get("projectId");
  const projectId = projectIdFromParams || projectIdFromQuery || undefined;
  
  // Check if we're on a project sub-page (either in /projects/[id] or with projectId query param)
  const hasProjectIdInPath = pathname?.startsWith("/projects/") && projectIdFromParams;
  const hasProjectIdInQuery = Boolean(projectIdFromQuery);
  const isProjectPage = hasProjectIdInPath || hasProjectIdInQuery;
  
  // Determine if we're on the project dashboard (exact match or no sub-path)
  const isProjectDashboard = projectIdFromParams 
    ? (pathname === `/projects/${projectIdFromParams}` || pathname === `/projects/${projectIdFromParams}/`)
    : false;
  
  const isProjectSubPage = isProjectPage && !isProjectDashboard;
  const isReportsPage = projectIdFromParams ? pathname === `/projects/${projectIdFromParams}/reports` : false;
  const isProjectDetailsPage = projectIdFromParams ? pathname === `/projects/${projectIdFromParams}/details` : false;

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 sidebar-print-hide">
      <div className="mb-4">
        <Link href="/dashboard" className="block">
          <div className="flex items-center justify-center">
            <QMark px={96} />
          </div>
        </Link>
      </div>
      
      <nav className="space-y-1">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
            pathname === "/dashboard"
              ? "bg-gray-100 text-blue-600 font-medium"
              : "text-gray-700 hover:bg-gray-50"
          )}
        >
          <Home className="w-5 h-5" />
          <span>Company Dashboard</span>
        </Link>
        
        {/* Quick Navigation Links */}
        <div className="pt-2 pb-2">
          <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Links</p>
          <Link
            href="/projects"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              pathname === "/projects"
                ? "bg-gray-100 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <FolderKanban className="w-5 h-5" />
            <span>All Projects</span>
          </Link>
          <Link
            href="/reports"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              pathname === "/reports"
                ? "bg-gray-100 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Reports & Analytics</span>
          </Link>
          {/* Company Settings - Hidden for members, visible for owner/admin */}
          {permissions?.canAccessSettings && (
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                pathname === "/settings" || pathname?.startsWith("/settings")
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              title={permissions.isOwner ? "You manage this workspace" : "Workspace administration"}
            >
              <Settings className="w-5 h-5" />
              <div className="flex-1">
                <span>Company Settings</span>
                <p className="text-xs text-gray-500 mt-0.5">Workspace administration</p>
              </div>
            </Link>
          )}
          {/* Fix Owner Access - Temporary helper link (remove after fixing) */}
          {!permissions?.canAccessSettings && !permissionsLoading && (
            <Link
              href="/fix-owner-access"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-amber-700 hover:bg-amber-50 border border-amber-200"
              )}
              title="Fix owner access if you're the first user"
            >
              <Shield className="w-5 h-5" />
              <div className="flex-1">
                <span>Fix Owner Access</span>
                <p className="text-xs text-amber-600 mt-0.5">First user setup helper</p>
              </div>
            </Link>
          )}
          <Link
            href="/address-book"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              pathname === "/address-book"
                ? "bg-gray-100 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <BookOpen className="w-5 h-5" />
            <span>Address Book</span>
          </Link>
          <Link
            href="/bid-schedule"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              pathname === "/bid-schedule"
                ? "bg-gray-100 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <Calendar className="w-5 h-5" />
            <span>Bid & Production Schedule</span>
          </Link>
        </div>
        
        {/* Project tools are hidden until a project context is available */}
        <div className="pt-2 pb-2">
          <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Project Tools
          </p>
        </div>

        {isProjectPage && projectId ? (
          <>
            <Link
              href={`/projects/${projectId}`}
              onClick={(e) => {
                if (!projectId) {
                  console.error("Project Dashboard: projectId is missing");
                  e.preventDefault();
                  return;
                }
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                isProjectDashboard
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Building2 className="w-5 h-5" />
              <span>Project Dashboard</span>
            </Link>
            <Link
              href={`/projects/${projectId}/details`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isProjectDetailsPage
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <FileText className="w-5 h-5" />
              <span>Project Details</span>
            </Link>
            <Link
              href={`/projects/${projectId}/reports`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isReportsPage
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Structural Steel Estimate Summary</span>
            </Link>
            {navigation.map((item) => {
              const Icon = item.icon;
              const AiIcon = (item as any).aiIcon;

              let href = item.href;
              if (projectId) {
                if (item.name === "Structural Steel Estimate") {
                  href = `/projects/${projectId}/estimating`;
                } else if (item.name === "AI Spec Review") {
                  href = `/spec-review?projectId=${projectId}`;
                } else if (item.name === "AI Generated Proposal") {
                  href = `/proposal/enhanced?projectId=${projectId}`;
                } else if (item.name === "Import Quotes") {
                  href = `/import-quotes?projectId=${projectId}`;
                }
              }

              const isActive = (() => {
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
                    return (
                      (pathname === "/proposal/enhanced" || pathname === "/proposal") &&
                      projectIdFromQuery === projectId
                    );
                  }
                  return pathname === "/proposal/enhanced" || (pathname === "/proposal" && !projectIdFromQuery);
                }
                if (item.name === "Import Quotes") {
                  if (isProjectPage && projectId) {
                    return pathname === "/import-quotes" && projectIdFromQuery === projectId;
                  }
                  return pathname === "/import-quotes" && !projectIdFromQuery;
                }
                const baseHref = item.href.split("?")[0];
                return pathname === baseHref || pathname?.startsWith(baseHref + "/");
              })();

              return (
                <Link
                  key={item.name}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive ? "bg-gray-100 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {AiIcon && <AiIcon className="w-3 h-3 absolute -top-1 -right-1 text-purple-500" />}
                  </div>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </>
        ) : (
          <div className="mx-4 mt-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
            Open a project to access project tools.
          </div>
        )}
      </nav>
    </div>
  );
}

