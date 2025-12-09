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
  BookOpen,
  Calendar,
  Shield,
} from "lucide-react";
import { QMark } from "../ui/QMark";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";

const navigation = [
  { name: "Structural Steel Estimate", href: "/estimating", icon: ClipboardList },
  { name: "AI Spec Review", href: "/spec-review", icon: FileCheck, aiIcon: Sparkles },
  { name: "AI Generated Proposal", href: "/proposal", icon: FileEdit, aiIcon: Sparkles },
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
          <Link
            href={permissions?.role === "admin" && permissions?.canAccessSettings !== false ? "/settings" : "#"}
            onClick={(e) => {
              if (permissions?.role !== "admin" || permissions?.canAccessSettings === false) {
                e.preventDefault();
                const message = permissions?.canAccessSettings === false
                  ? "Settings Access Restricted\n\n" +
                    "Your license type restricts settings access to administrators only.\n\n" +
                    "For single-user licenses: You have full settings access.\n" +
                    "For multi-user licenses: Only administrators can access settings.\n\n" +
                    "Contact your company administrator if you need settings access."
                  : "Admin Access Required\n\n" +
                    "Company Settings is only available to users with Admin role.\n\n" +
                    "To get admin access:\n" +
                    "1. Contact your company administrator\n" +
                    "2. Ask them to go to Settings → Users\n" +
                    "3. They can change your role to 'Admin'\n\n" +
                    "Note: The person who created the company account is automatically an admin.";
                alert(message);
              }
            }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative",
              pathname === "/settings" || pathname?.startsWith("/settings")
                ? "bg-gray-100 text-blue-600 font-medium"
                : permissions?.role !== "admin"
                ? "text-gray-400 cursor-not-allowed opacity-60"
                : "text-gray-700 hover:bg-gray-50"
            )}
            title={permissions?.role !== "admin" ? "Admin access required" : "Company Settings"}
          >
            <Settings className="w-5 h-5" />
            <span>Company Settings</span>
            {permissions?.role !== "admin" && (
              <Shield className="w-4 h-4 ml-auto text-gray-400" title="Admin Only" />
            )}
          </Link>
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
        
        {/* Divider */}
        <div className="pt-2 pb-2">
          <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Project Tools</p>
        </div>
        
        {isProjectPage && projectId && (
          <>
            <Link
              href={`/projects/${projectId}`}
              onClick={(e) => {
                // Debug: log navigation attempt
                if (!projectId) {
                  console.error("Project Dashboard: projectId is missing");
                  e.preventDefault();
                  return;
                }
                console.log("Navigating to project dashboard:", `/projects/${projectId}`);
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
          </>
        )}
        {navigation.map((item) => {
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
            } else if (item.name === "Import Quotes") {
              href = `/import-quotes?projectId=${projectId}`;
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
            if (item.name === "Import Quotes") {
              if (isProjectPage && projectId) {
                return pathname === "/import-quotes" && projectIdFromQuery === projectId;
              }
              return pathname === "/import-quotes" && !projectIdFromQuery;
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
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {AiIcon && (
                  <AiIcon className="w-3 h-3 absolute -top-1 -right-1 text-purple-500" />
                )}
              </div>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

