"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, FlaskConical, X } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { loadCompanySettings, type CompanySettings } from "@/lib/utils/settingsLoader";

const DISMISS_KEY = "quant.demoModeBanner.dismissed";

export default function DemoModeBanner() {
  const { user, loading } = useAuth();
  const companyId = useCompanyId();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (!companyId || companyId === "default") return;

    let cancelled = false;
    (async () => {
      try {
        const s = await loadCompanySettings(companyId);
        if (!cancelled) setSettings(s);
      } catch {
        // ignore — banner just won't show
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, user, loading]);

  const showSampleData = useMemo(() => {
    // Matches existing behavior in settings/projects/dashboard pages:
    // default to true unless explicitly set to false.
    return settings ? settings.showSampleData !== false : false;
  }, [settings]);

  const canShow = !!user && !loading && companyId !== "default" && showSampleData && !dismissed;
  if (!canShow) return null;

  return (
    <div className="sticky top-0 z-50">
      <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-amber-50/70 to-white backdrop-blur supports-[backdrop-filter]:bg-amber-50/70">
        <div className="mx-auto max-w-[1400px] px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200/60">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-slate-900">
                    Demo mode
                    <span className="font-medium text-slate-600"> — sample data is enabled</span>
                  </div>
                  <div className="group relative inline-block">
                    <Info className="h-4 w-4 text-slate-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-80 bg-slate-900 text-white text-xs rounded-lg p-2 z-10 pointer-events-none whitespace-normal">
                      Some projects/metrics may be synthetic training data. Disable this in Settings when you’re ready to run on live data only.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                        <div className="w-2 h-2 bg-slate-900 rotate-45" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-600 mt-0.5 truncate">
                  Tip: turn this off before exporting reports to clients.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/settings/seed-data"
                className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200/70 border border-amber-200/60 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Manage
              </Link>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.sessionStorage.setItem(DISMISS_KEY, "1");
                  } catch {}
                  setDismissed(true);
                }}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white/60 transition-colors text-slate-500"
                aria-label="Dismiss demo mode banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


