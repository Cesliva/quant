"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { PenSquare, FileSpreadsheet, Sparkles, ArrowUpRight } from "lucide-react";
import WidgetTile from "./widgets/WidgetTile";

interface QuickActionsWidgetProps {
  className?: string;
}

const actions = [
  {
    title: "New Project",
    description: "Kick off a fresh estimate or pursuit.",
    icon: <PenSquare className="w-4 h-4" />,
    href: "/projects/new",
  },
  {
    title: "Import Estimate",
    description: "Pull takeoffs or cost data from Excel.",
    icon: <FileSpreadsheet className="w-4 h-4" />,
    href: "/estimates/import",
  },
  {
    title: "Run AI Spec Review",
    description: "Analyze specs for traps + RFIs.",
    icon: <Sparkles className="w-4 h-4" />,
    href: "/ai/spec-review",
  },
];

export default function QuickActionsWidget({ className }: QuickActionsWidgetProps) {
  return (
    <WidgetTile size="large" className={className}>
      <div>
        <p className="text-[11px] uppercase tracking-[0.4em] text-gray-500 font-semibold">
          Quick Actions
        </p>
        <p className="text-sm text-gray-600">
          Launch the workflows teams use every day.
        </p>
      </div>
      <div className="flex-1 flex flex-col gap-3">
        {actions.map((action) => (
          <Link key={action.title} href={action.href}>
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-between border-2 rounded-2xl px-4 bg-white/90 hover:bg-blue-50"
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {action.icon}
                  {action.title}
                </span>
                <span className="text-xs text-gray-500">{action.description}</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400" />
            </Button>
          </Link>
        ))}
      </div>
    </WidgetTile>
  );
}

