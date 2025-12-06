"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  Zap, 
  Shield, 
  BarChart3, 
  FileCheck, 
  Brain,
  CheckCircle2,
  ArrowRight,
  Play,
  Star,
  TrendingUp,
  Clock,
  Users,
  Target
} from "lucide-react";

function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: BarChart3,
      title: "Win/Loss Analytics",
      description: "Track your bid performance with detailed win/loss analysis. Identify patterns, improve your strategy, and increase your win rate with data-driven insights.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Brain,
      title: "AI Spec Review",
      description: "Automatically analyze project specifications for compliance, risks, and opportunities. Get instant RFI suggestions.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: FileCheck,
      title: "Smart Proposal Generation",
      description: "Generate professional proposals in minutes. AI-powered content tailored to your project and company standards.",
      color: "from-emerald-500 to-teal-500"
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track win rates, pipeline value, and project performance. Make data-driven decisions with executive dashboards.",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Multi-tenant architecture with role-based permissions. Your data is secure, isolated, and backed up automatically.",
      color: "from-indigo-500 to-blue-500"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Real-time collaboration, instant calculations, and seamless synchronization across all your devices and team members.",
      color: "from-yellow-500 to-orange-500"
    }
  ];

  const benefits = [
    "Reduce estimating time by 70%",
    "Increase win rate with data-driven insights",
    "Eliminate calculation errors",
    "Collaborate seamlessly with your team",
    "Track every project from bid to completion",
    "Generate professional proposals in minutes"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-white/85 backdrop-blur-xl shadow-md" : "bg-white/60 backdrop-blur-lg"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <div className="flex items-center gap-3">
              <img 
                src="/graphics/logos/quant logo.svg" 
                alt="Quant AI" 
                className="h-20 w-auto drop-shadow-sm"
              />
              <span className="text-lg font-semibold text-slate-900 tracking-tight hidden sm:inline">
                Quant <span className="text-slate-500 font-medium">Steel Estimating Suite</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/login"
                className="px-4 py-2 text-slate-700 hover:text-blue-600 font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/signup"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 border border-white/30"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        {/* Gradient accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 -left-20 h-72 w-72 bg-gradient-to-br from-blue-500/25 via-indigo-400/20 to-transparent blur-3xl" />
          <div className="absolute top-10 right-[-6rem] h-80 w-80 bg-gradient-to-bl from-purple-500/25 via-indigo-400/20 to-transparent blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold mb-4 border border-blue-100 shadow-sm">
              <Star className="w-4 h-4 fill-blue-600 text-blue-600" />
              <span>AI-Powered Steel Estimating</span>
              <span className="text-slate-400">•</span>
              <span>Enterprise-grade delivery</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-5 leading-[0.95] tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-500 bg-clip-text text-transparent">
                Estimate Faster.
              </span>
              <br />
              <span className="text-slate-900">Win More Bids.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-700 mb-10 leading-relaxed max-w-4xl mx-auto">
              The only steel fabrication estimating platform that pairs AI with deep industry expertise—
              delivering enterprise accuracy, executive-ready proposals, and real-time collaboration.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link 
                href="/signup"
                className="group px-9 py-4.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-500 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-1 flex items-center gap-3 border border-white/20"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="px-9 py-4.5 bg-white text-slate-800 rounded-2xl font-semibold text-lg shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300 flex items-center gap-3">
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-sm border border-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-sm border border-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-sm border border-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Cancel anytime</span>
              </div>
            </div>

            {/* Trust bar */}
            <div className="mt-12">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Trusted by leading fabricators</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center justify-items-center text-slate-400">
                {["SteelCore", "NorthBridge", "TitanFab", "Summit Metals", "PrecisionWorks"].map((brand) => (
                  <div key={brand} className="text-base md:text-lg font-semibold tracking-wide opacity-80">
                    {brand}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Time Saved", value: "70%", icon: Clock },
              { label: "Win Rate Increase", value: "35%", icon: TrendingUp },
              { label: "Active Users", value: "500+", icon: Users },
              { label: "Projects Managed", value: "10K+", icon: BarChart3 }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 mb-4">
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-slate-900 mb-2">{stat.value}</div>
                <div className="text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Win
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Powerful features designed specifically for steel fabrication estimators
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="group p-8 bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100"
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Why Leading Fabricators Choose Quant
              </h2>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Join hundreds of steel fabrication companies that have transformed their estimating process with AI.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-white">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">35%</div>
                    <div className="text-blue-100">Average Win Rate Increase</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">70%</div>
                    <div className="text-blue-100">Time Saved on Estimates</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">5 min</div>
                    <div className="text-blue-100">Average Proposal Generation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-12 md:p-16 shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Estimating?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Start your free 14-day trial. No credit card required. Cancel anytime.
            </p>
            <Link 
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <img 
                src="/graphics/logos/quant logo.svg" 
                alt="Quant AI" 
                className="h-48 w-auto"
              />
            </div>
            <div className="flex items-center gap-6 text-slate-600">
              <Link href="#" className="hover:text-blue-600 transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">Terms</Link>
              <Link href="#" className="hover:text-blue-600 transition-colors">Contact</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} Quant AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // Redirect authenticated users to dashboard
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />;
  }

  // This shouldn't render as we redirect, but just in case
  return null;
}
