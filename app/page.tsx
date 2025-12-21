"use client";

import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Sparkles,
  BarChart3,
  FileCheck,
  Zap,
  Shield,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

/**
 * Quant Landing Page
 * Apple-inspired, hyper-modern marketing page.
 * Shows a dashboard CTA when logged in; otherwise sign-in / get-started CTAs.
 */
export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Image 
              src="/graphics/logos/quant logo.svg" 
              alt="Quant Estimating AI" 
              width={540} 
              height={120}
              className="h-14 sm:h-16 w-auto"
            />
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button variant="primary" className="px-4">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" className="px-4">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="primary" className="px-4">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 space-y-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight">
              Hyper-accurate steel estimates,
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                built to edge out the competition.
              </span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl">
              Quant blends hard-earned field experience with modern AI. Every workflow, calculation, and control is tuned to help fabricators price with confidence, defend numbers, and grow through strategic information processing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button size="lg" className="px-7">
                  {user ? "Enter Dashboard" : "Start Free Trial"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              {!user && (
                <Link href="/login">
                  <Button size="lg" variant="outline" className="px-7">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Weight + labor precision
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Spec risk & scope defense
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Executive-ready insights
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-purple-500/20 blur-3xl" />
              <div className="relative rounded-3xl border border-slate-200/70 bg-white shadow-xl shadow-slate-200 overflow-hidden p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-sm font-medium text-slate-700">Estimator Command Console</div>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <CardStat title="Win Rate" value="+18%" caption="MoM improvement" />
                  <CardStat title="Pipeline Confidence" value="93%" caption="AI validated" />
                  <CardStat title="Hours Reclaimed" value="21h" caption="Per week" />
                  <CardStat title="Variance Alerts" value="Zero" caption="Before bid" />
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-br from-slate-50 to-white space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-3 mb-2">
                    <Image 
                      src="/graphics/logos/Q.svg" 
                      alt="Q" 
                      width={40} 
                      height={40}
                      className="h-10 w-10"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">Strategic AI Insights</div>
                      <div className="text-xs text-slate-500">Estimator-trained guardrails</div>
                    </div>
                  </div>
                  <FeatureLine icon={<BarChart3 className="w-4 h-4 text-indigo-600" />} text="Cost per ton & labor per ton with live variance" />
                  <FeatureLine icon={<FileCheck className="w-4 h-4 text-indigo-600" />} text="Spec risk checks before you publish a number" />
                  <FeatureLine icon={<Shield className="w-4 h-4 text-indigo-600" />} text="Scope defense to prevent hidden creep" />
                  <FeatureLine icon={<TrendingUp className="w-4 h-4 text-indigo-600" />} text="Executive clarity without losing estimator accuracy" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story & Differentiators */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-slate-100 p-10 lg:p-14 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <div className="text-sm font-medium text-slate-500">Why Quant</div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">
              Built by a 25-year steel estimator. Tuned to win modern bids.
            </h2>
            <p className="text-slate-600">
              Quant is crafted by someone who has priced steel for decades—now distilled into a hyper-modern toolchain. Every check and insight helps you price fast, defend your numbers, and edge out competitors with strategic information processing.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Estimator-first workflows",
                "Spec risk intelligence",
                "Labor + weight precision",
                "Executive-ready reporting",
              ].map((pill) => (
                <span key={pill} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">
                  {pill}
                </span>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 grid md:grid-cols-2 gap-4">
            <MiniCard title="Accuracy under pressure" desc="Automated calcs for weight, labor, and coatings—validated before you publish a number." />
            <MiniCard title="Strategic clarity" desc="Variance, risk, and trend views so you know where to win and where to walk away." />
            <MiniCard title="Frictionless exports" desc="AI-reviewed proposals and reports that are client-ready, instantly." />
            <MiniCard title="Operational lift" desc="Hours back each week so estimators focus on strategy, not spreadsheets." />
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10 space-y-3">
          <div className="text-sm font-medium text-slate-500">Modern toolkit</div>
          <h2 className="text-3xl font-semibold text-slate-900">Everything an estimator needs to move faster.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Sparkles className="w-5 h-5 text-indigo-600" />,
              title: "AI Estimating Intelligence",
              desc: "Guides pricing with estimator-trained logic and live guardrails.",
            },
            {
              icon: <FileCheck className="w-5 h-5 text-indigo-600" />,
              title: "Spec & Scope Defense",
              desc: "Flags ambiguous scope, coatings, and connections before bid day.",
            },
            {
              icon: <BarChart3 className="w-5 h-5 text-indigo-600" />,
              title: "Cost Trends & Variance",
              desc: "Live streamgraph of cost per ton and labor per ton to defend your number.",
            },
            {
              icon: <Shield className="w-5 h-5 text-indigo-600" />,
              title: "Controls & Approvals",
              desc: "Lock budgets, versions, and audit trails for executive confidence.",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
              title: "Executive Clarity",
              desc: "Weighted pipeline, win/loss intelligence, and risk exposure at a glance.",
            },
            {
              icon: <Zap className="w-5 h-5 text-indigo-600" />,
              title: "Lightning Execution",
              desc: "Minutes to produce a defensible number; export to PDF/CSV instantly.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 space-y-3"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">{item.icon}</div>
              <div className="text-base font-semibold text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-600">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="bg-white border-t border-b border-slate-200/80 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-6">
          {[
            { label: "Time saved per estimator", value: "20+ hrs/week" },
            { label: "Bid confidence lift", value: "+18% win rate" },
            { label: "Variance caught pre-bid", value: "Zero surprises" },
            { label: "Built for estimators", value: "Crafted by one" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="text-sm text-slate-500 mb-1">{stat.label}</div>
              <div className="text-2xl font-semibold text-slate-900">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-10 lg:p-14 shadow-2xl shadow-slate-900/20 border border-slate-700/60">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="text-sm uppercase tracking-[0.2em] text-slate-300">Quant Estimating AI</div>
              <h3 className="text-3xl lg:text-4xl font-semibold leading-tight">
                Built by a veteran estimator. Crafted to win the next one.
              </h3>
              <p className="text-slate-200 max-w-2xl">
                Harness AI tuned for steel, with controls a seasoned estimator would demand. Price faster, defend your numbers, and grow with confidence.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button size="lg" variant="primary" className="bg-white text-slate-900 hover:bg-slate-100 border-0">
                  {user ? "Go to Dashboard" : "Start Free Trial"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              {!user && (
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-500 text-white hover:bg-white hover:text-slate-900"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image 
              src="/graphics/logos/Q.svg" 
              alt="Quant" 
              width={36} 
              height={36}
              className="h-9 w-9"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Quant Estimating AI</div>
              <div className="text-xs text-slate-500">Steel fabrication estimating, reimagined.</div>
            </div>
          </div>
          <div className="flex gap-5 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link href={user ? "/dashboard" : "/login"} className="hover:text-slate-900">
              {user ? "Dashboard" : "Sign In"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CardStat({
  title,
  value,
  caption,
}: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs text-slate-500 mb-1">{title}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-emerald-600">{caption}</div>
    </div>
  );
}

function FeatureLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function MiniCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="text-sm font-semibold text-slate-900 mb-1">{title}</div>
      <div className="text-sm text-slate-600">{desc}</div>
    </div>
  );
}
