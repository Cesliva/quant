"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            Dashboard
          </Link>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Quant Estimating AI</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Project Details</span>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="outline" size="sm">Settings</Button>
          </Link>
          <Button variant="primary" size="sm">New Project</Button>
        </div>
      </div>
    </header>
  );
}

