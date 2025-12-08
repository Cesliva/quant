"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { NotificationBell } from "@/components/collaboration/NotificationBell";
import { UserAvatar } from "@/components/collaboration/UserAvatar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import Button from "@/components/ui/Button";
import { LogOut } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const companyId = useCompanyId();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  
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

  // Check for unsaved changes before signing out
  const handleSignOut = async () => {
    // Check if there are unsaved changes on the current page
    const hasUnsavedChanges = checkForUnsavedChanges();
    
    if (hasUnsavedChanges) {
      const shouldSave = window.confirm(
        "You have unsaved changes. Would you like to save before signing out?\n\n" +
        "Click OK to save, Cancel to sign out without saving."
      );
      
      if (shouldSave) {
        // Try to trigger save on the current page
        const saveButton = document.querySelector('[data-save-button]') as HTMLButtonElement;
        if (saveButton && !saveButton.disabled) {
          saveButton.click();
          // Wait a moment for save to complete
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check if save was successful (status should be "saved")
          const saveStatus = document.querySelector('[data-save-status]')?.getAttribute('data-save-status');
          if (saveStatus === 'unsaved' || saveStatus === 'saving') {
            const proceed = window.confirm("Save is still in progress or failed. Do you want to sign out anyway?");
            if (!proceed) {
              return;
            }
          }
        } else {
          const proceed = window.confirm("No save button found or save button is disabled. Do you want to sign out anyway?");
          if (!proceed) {
            return;
          }
        }
      }
      // If shouldSave is false, user clicked Cancel - proceed with sign out
    }
    
    try {
      await signOut();
      router.push("/login");
    } catch (error: any) {
      console.error("Sign out error:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  // Check for unsaved changes on the current page
  const checkForUnsavedChanges = (): boolean => {
    // Check for save status indicators
    const saveStatusElements = document.querySelectorAll('[data-save-status]');
    for (const element of saveStatusElements) {
      const status = element.getAttribute('data-save-status');
      if (status === 'unsaved' || status === 'saving') {
        return true;
      }
    }
    
    // Check for unsaved class indicators
    const unsavedIndicators = document.querySelectorAll('.unsaved, [data-unsaved="true"]');
    if (unsavedIndicators.length > 0) {
      return true;
    }
    
    return false;
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 header-print-hide">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            {getPageTitle()}
          </Link>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Quant Estimating AI</span>
        </div>
        <div className="flex items-center gap-4">
          {companyId && <NotificationBell />}
          {user && (
            <>
              <Link href="/settings/users/profile">
                <UserAvatar userId={user.uid} size="md" showName={false} className="cursor-pointer hover:opacity-80" />
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

