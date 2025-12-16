"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/collaboration/NotificationBell";
import { UserAvatar } from "@/components/collaboration/UserAvatar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const companyId = useCompanyId();
  
  // Determine the page title based on the current path
  const getPageTitle = () => {
    if (pathname === "/") {
      return "Company Dashboard";
    } else if (pathname?.startsWith("/projects/") && pathname.includes("/estimating")) {
      return "Estimating";
    } else if (pathname?.startsWith("/projects/") && pathname.includes("/reports")) {
      return "Estimating Summary";
    } else if (pathname?.startsWith("/projects/") && !pathname.includes("/estimating") && !pathname.includes("/reports") && !pathname.includes("/details") && !pathname.includes("/spec-review") && !pathname.includes("/proposal")) {
      return "Project Dashboard";
    } else if (pathname?.startsWith("/projects/") && pathname.includes("/details")) {
      return "Project Details";
    } else if (pathname?.includes("/spec-review")) {
      return "AI Spec Review";
    } else if (pathname?.includes("/proposal")) {
      return "AI Generated Proposal";
    } else if (pathname?.includes("/estimating") && !pathname.includes("/projects/")) {
      return "Estimating";
    } else if (pathname?.includes("/import-quotes")) {
      return "Import Quotes";
    }
    return "Company Dashboard";
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            {getPageTitle()}
          </Link>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Quant Estimating AI</span>
        </div>
        <div className="flex items-center gap-4">
          {companyId && <NotificationBell />}
          {user && (
            <Link href="/settings/users/profile">
              <UserAvatar userId={user.uid} size="md" showName={false} className="cursor-pointer hover:opacity-80" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

