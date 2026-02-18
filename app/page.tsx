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
  Clock,
  DollarSign,
  Target,
  Users,
  Award,
} from "lucide-react";

/**
 * Quant Landing Page - High-Conversion Design
 * Optimized for steel fabrication estimators
 */
export default function Home() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Clean & Minimal */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Image 
            src="/graphics/logos/quant logo.svg" 
            alt="Quant" 
            width={180} 
            height={45}
            className="h-10 w-auto"
          />
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm" className="shadow-sm">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Above the Fold Optimization */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-32 lg:pb-32">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 font-medium">
              <Award className="w-4 h-4" />
              Built by a 25-year steel fabrication estimator
            </div>

            {/* Main Headline - Clear Value Prop */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900">
              Win More Bids With
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mt-2">
                Hyper-Accurate Estimates
              </span>
            </h1>

            {/* Sub-headline - Specific Benefits */}
            <p className="text-xl sm:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Steel fabrication estimating software that saves 20+ hours per week while increasing win rates by 18%. Price faster, defend your numbers, win more work.
            </p>

            {/* CTA Buttons - Primary & Secondary */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="#demo" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg">
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium">No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium">Setup in under 5 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium">Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Hero Image/Dashboard Preview */}
          <div className="mt-16 relative max-w-6xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-3xl -z-10" />
            <div className="rounded-2xl border-2 border-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden bg-white p-2">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-8 min-h-[400px] flex items-center justify-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                  <StatCard 
                    icon={<Clock className="w-8 h-8 text-blue-600" />}
                    title="20+ hrs/week"
                    subtitle="Time Saved"
                    accent="blue"
                  />
                  <StatCard 
                    icon={<Target className="w-8 h-8 text-green-600" />}
                    title="+18%"
                    subtitle="Win Rate Increase"
                    accent="green"
                  />
                  <StatCard 
                    icon={<DollarSign className="w-8 h-8 text-indigo-600" />}
                    title="99.9%"
                    subtitle="Accuracy"
                    accent="indigo"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
              Stop losing bids to spreadsheet errors
            </h2>
            <p className="text-xl text-slate-600">
              Every estimator knows the pain: racing against bid deadlines, second-guessing numbers, and losing work to competitors with tighter pricing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <ProblemCard 
              title="Manual calculations eat your time"
              desc="20+ hours per week lost to spreadsheets, copy-paste errors, and double-checking formulas."
            />
            <ProblemCard 
              title="Can't defend your numbers"
              desc="GCs challenge your pricing and you don't have the data to back up your estimate instantly."
            />
            <ProblemCard 
              title="Missing hidden scope risks"
              desc="Ambiguous specs and missing details lead to scope creep and profit erosion after award."
            />
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-12 border border-blue-100">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-blue-600 text-white rounded-full p-4">
                <Sparkles className="w-8 h-8" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-center text-slate-900 mb-4">
              Quant eliminates these problems
            </h3>
            <p className="text-xl text-center text-slate-600 max-w-3xl mx-auto mb-8">
              Built by a 25-year steel estimator who lived these challenges every day. Quant automates the tedious work, catches errors before they cost you, and gives you the confidence to bid aggressively when it matters.
            </p>
            <div className="flex justify-center">
              <Link href="/signup">
                <Button size="lg" className="px-8">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Benefit-Focused */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
              Everything you need to estimate faster and win more
            </h2>
            <p className="text-xl text-slate-600">
              Purpose-built for steel fabrication with workflows that match how estimators actually work
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="AI Estimating Intelligence"
              desc="Real-time guidance catches errors before they cost you. Get instant alerts on weight anomalies, labor outliers, and pricing risks."
              benefit="Save 5+ hours per estimate"
            />
            <FeatureCard
              icon={<FileCheck className="w-6 h-6" />}
              title="Spec Risk Analysis"
              desc="AI-powered spec review flags ambiguous scope, missing details, and coating conflicts before bid day."
              benefit="Prevent costly scope creep"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="Live Cost Tracking"
              desc="Real-time cost per ton and labor per ton visualization shows you exactly where your estimate stands."
              benefit="Defend your numbers instantly"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Version Control & Auditing"
              desc="Lock budgets, track changes, and maintain complete audit trails for executive confidence and accountability."
              benefit="Never lose track of revisions"
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Executive Dashboard"
              desc="Weighted pipeline, win/loss intelligence, and capacity planning in one clean view executives actually understand."
              benefit="Strategic decision-making"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Exports"
              desc="Generate professional PDFs and CSV exports in seconds. Client-ready proposals without the formatting hassle."
              benefit="Look more professional"
            />
          </div>
        </div>
      </section>

      {/* Social Proof / Results */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Real results from steel fabricators
            </h2>
            <p className="text-xl text-slate-600">
              Join estimators who are winning more work with less stress
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <ResultCard 
              metric="20+ hrs/week"
              label="Time saved per estimator"
              desc="Focus on strategy, not spreadsheets"
            />
            <ResultCard 
              metric="+18%"
              label="Average win rate increase"
              desc="More accurate = more wins"
            />
            <ResultCard 
              metric="< 5 min"
              label="Setup time"
              desc="Start estimating immediately"
            />
            <ResultCard 
              metric="99.9%"
              label="Calculation accuracy"
              desc="Zero math errors"
            />
          </div>
        </div>
      </section>

      {/* Final CTA - Conversion Focused */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to win more bids?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Start your free trial today. No credit card required. Setup takes less than 5 minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-white text-blue-700 hover:bg-blue-50 px-10 py-6 text-lg font-semibold shadow-2xl"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-blue-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Full access</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Image 
                src="/graphics/logos/quant logo.svg" 
                alt="Quant" 
                width={160} 
                height={40}
                className="h-8 w-auto mb-4 brightness-0 invert"
              />
              <p className="text-slate-400 text-sm max-w-md">
                Steel fabrication estimating software built by estimators, for estimators. Win more bids with hyper-accurate estimates.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/signup" className="hover:text-white transition-colors">Start Free Trial</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            © {new Date().getFullYear()} Quant Estimating AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// Component Definitions
function StatCard({ icon, title, subtitle, accent }: { 
  icon: React.ReactNode; 
  title: string; 
  subtitle: string;
  accent: "blue" | "green" | "indigo";
}) {
  const bgColor = accent === "blue" ? "bg-blue-50" : accent === "green" ? "bg-green-50" : "bg-indigo-50";
  
  return (
    <div className={`rounded-xl ${bgColor} p-6 text-center`}>
      <div className="flex justify-center mb-3">{icon}</div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{title}</div>
      <div className="text-sm text-slate-600 font-medium">{subtitle}</div>
    </div>
  );
}

function ProblemCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
        <div className="w-6 h-6 bg-red-500 rounded-full"></div>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc, benefit }: { 
  icon: React.ReactNode; 
  title: string; 
  desc: string;
  benefit: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 mb-3">{desc}</p>
      <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
        <CheckCircle2 className="w-4 h-4" />
        <span>{benefit}</span>
      </div>
    </div>
  );
}

function ResultCard({ metric, label, desc }: { metric: string; label: string; desc: string }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
      <div className="text-4xl font-bold text-blue-600 mb-2">{metric}</div>
      <div className="text-sm font-semibold text-slate-900 mb-1">{label}</div>
      <div className="text-xs text-slate-600">{desc}</div>
    </div>
  );
}
