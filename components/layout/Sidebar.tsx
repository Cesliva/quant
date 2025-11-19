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
} from "lucide-react";

const navigation = [
  { name: "Estimating", href: "/estimating?projectId=1", icon: ClipboardList },
  { name: "AI Spec Review", href: "/spec-review", icon: FileCheck, aiIcon: Sparkles },
  { name: "AI Generated Proposal", href: "/proposal", icon: FileEdit, aiIcon: Sparkles },
  { name: "Import Quotes", href: "/import-quotes", icon: Upload },
  { name: "Material Nesting", href: "/material-nesting", icon: Package },
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

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
      <div className="mb-8">
        <Link href="/" className="block">
          <h2 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">Quant Estimating AI</h2>
          <p className="text-sm text-gray-600">Project Details</p>
        </Link>
      </div>
      
      <nav className="space-y-1">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
            pathname === "/"
              ? "bg-gray-100 text-blue-600 font-medium"
              : "text-gray-700 hover:bg-gray-50"
          )}
        >
          <Home className="w-5 h-5" />
          <span>Company Dashboard</span>
        </Link>
        
        {isProjectPage && projectId && (
          <>
            <Link
              href={projectIdFromParams ? `/projects/${projectId}` : `/projects/${projectId}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isProjectDashboard
                  ? "bg-gray-100 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Building2 className="w-5 h-5" />
              <span>Project Dashboard</span>
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
              <span>Estimating Summary</span>
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
            if (item.name === "Estimating") {
              href = `/projects/${projectId}/estimating`;
            } else if (item.name === "AI Spec Review") {
              href = `/spec-review?projectId=${projectId}`;
            } else if (item.name === "AI Generated Proposal") {
              href = `/proposal?projectId=${projectId}`;
            }
            // Other items can keep their original href or add projectId query param if needed
          }
          
          const isActive = pathname?.startsWith(item.href) || 
            (isProjectPage && projectId && (
              (item.name === "Estimating" && pathname === `/projects/${projectId}/estimating`) ||
              (item.name === "AI Spec Review" && pathname === "/spec-review" && projectIdFromQuery === projectId) ||
              (item.name === "AI Generated Proposal" && pathname === "/proposal" && projectIdFromQuery === projectId)
            ));
          
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

