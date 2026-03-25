"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/hooks/useAuth";
import { BRAND } from "@/lib/branding";
import { ArrowRight } from "lucide-react";

/** Unsplash images - steel fabrication, industrial. Swap for /public/graphics/landing/*.jpg when ready */
const LANDING_IMAGES = {
  hero: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80", // structural steel
  problem: "https://images.unsplash.com/photo-1581092160562-40e08e68c317?auto=format&fit=crop&w=1920&q=80", // industrial shop
  breakthrough: "https://images.unsplash.com/photo-1504917595217-d26dc0c90b8e?auto=format&fit=crop&w=1920&q=80", // steel construction
  fabrication: "https://images.unsplash.com/photo-1504328345607-63d87a3c83b8?auto=format&fit=crop&w=1920&q=80", // welding
  builtFor: "https://images.unsplash.com/photo-1565793298595-6a879b1d26c2?auto=format&fit=crop&w=1920&q=80", // metal workshop
  speed: "https://images.unsplash.com/photo-1513467538354-83e5236b6447?auto=format&fit=crop&w=1920&q=80", // industrial interior
  cta: "https://images.unsplash.com/photo-1504309092620-4d0ecb5da9fb?auto=format&fit=crop&w=1920&q=80", // structural steel
};

function SectionBg({
  imgUrl,
  dark = true,
  overlayStrength = 0.55,
  grain = true,
}: {
  imgUrl: string;
  dark?: boolean;
  overlayStrength?: number;
  grain?: boolean;
}) {
  const overlay = dark
    ? `linear-gradient(to bottom, rgba(0,0,0,${overlayStrength}) 0%, rgba(0,0,0,${overlayStrength * 0.95}) 50%, rgba(0,0,0,${Math.min(overlayStrength * 1.05, 0.85)}) 100%)`
    : `linear-gradient(to bottom, rgba(245,245,247,${overlayStrength}) 0%, rgba(245,245,247,${overlayStrength * 0.95}) 50%, rgba(245,245,247,${Math.min(overlayStrength * 1.05, 0.9)}) 100%)`;
  return (
    <div
      className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${grain ? "landing-grain" : ""}`}
      style={{
        backgroundImage: `${overlay}, url(${imgUrl})`,
      }}
    />
  );
}

/**
 * Quant Landing Page — Product reveal
 * Reflects Quant's identity: steel fabrication, blue/indigo palette, professional precision
 */
export default function Home() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white antialiased" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}>
      {/* Header — Quant brand gradient CTA */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5 flex items-center justify-end bg-[#0f172a]/95 backdrop-blur-xl border-b border-slate-700/50" style={{ boxShadow: "inset 0 -1px 0 0 rgba(99, 102, 241, 0.15)" }}>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-[17px] text-slate-400 hover:text-indigo-300 transition-colors duration-200">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-2.5 text-[17px] font-medium rounded-[980px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            Start Free Trial
          </Link>
        </div>
      </header>

      {/* SECTION 1 — Hero (Apple-style: logo, staggered motion, single CTA) */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-24 overflow-hidden">
        {/* Quant brand gradient vignette — blue + indigo glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 50%, transparent 40%, rgba(15,23,42,0.5) 100%),
              radial-gradient(ellipse 60% 50% at 50% 0%, ${BRAND.glowBlue}, transparent 50%),
              radial-gradient(ellipse 50% 40% at 80% 20%, ${BRAND.glowIndigo}, transparent 45%),
              radial-gradient(ellipse 40% 30% at 20% 30%, ${BRAND.glowIndigo}, transparent 40%)
            `,
          }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
          {/* Logo — staggered entrance */}
          <Link
            href="/signup"
            className="block animate-fade-in-up mb-12 sm:mb-16 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg"
            style={{ animationDelay: "0.1s" }}
          >
            <Image
              src="/graphics/logos/quant logo.svg"
              alt="Quant"
              width={280}
              height={72}
              className="w-48 sm:w-56 lg:w-64 h-auto brightness-0 invert"
              priority
            />
          </Link>
          {/* Tagline — staggered */}
          <p
            className="animate-fade-in-up text-[17px] sm:text-[19px] text-slate-400 font-light tracking-tight max-w-md leading-relaxed mb-14 sm:mb-16"
            style={{ animationDelay: "0.25s" }}
          >
            The estimating engine built for steel fabricators.
          </p>
          {/* Primary CTA — Quant brand gradient */}
          <Link
            href="/signup"
            className="animate-fade-in-up inline-flex items-center justify-center gap-2 px-8 py-4 text-[17px] font-medium rounded-[980px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-200"
            style={{ animationDelay: "0.4s" }}
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          {/* Trust signal — brand accent */}
          <p
            className="animate-fade-in-up mt-12 sm:mt-14 text-[13px] text-slate-500"
            style={{ animationDelay: "0.55s" }}
          >
            <span className="text-indigo-400/80">Trusted by fabrication shops</span> nationwide
          </p>
        </div>
        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up flex flex-col items-center gap-2"
          style={{ animationDelay: "0.7s" }}
        >
          <span className="text-[11px] text-slate-500 uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-blue-400/60 via-indigo-400/40 to-transparent rounded-full" />
        </div>
      </section>

      {/* SECTION 2 — The Problem */}
      <section className="relative py-[140px] px-6 lg:px-12 overflow-hidden">
        <SectionBg imgUrl={LANDING_IMAGES.problem} dark overlayStrength={0.55} />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-[40px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.1] mb-12">
            The work never ends.
          </h2>
          <p className="text-[18px] sm:text-[20px] text-white/70 leading-[1.6] max-w-2xl mx-auto">
            Slow takeoffs. Repetitive calculations. Inconsistent labor estimates. Every bid eats hours you don&apos;t have.
          </p>
        </div>
      </section>

      {/* SECTION 3 — The Breakthrough */}
      <section className="relative py-[140px] px-6 lg:px-12 overflow-hidden">
        <SectionBg imgUrl={LANDING_IMAGES.breakthrough} dark={false} overlayStrength={0.5} />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/30 via-transparent to-indigo-50/20" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-[40px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.1] mb-12 text-slate-900">
            Fabrication-aware estimating.
          </h2>
          <p className="text-[18px] sm:text-[20px] text-slate-600 leading-[1.6] max-w-2xl mx-auto">
            Quant automatically calculates fabrication labor when you add connections. Add a base plate to a column — labor appears. No spreadsheets. No guesswork.
          </p>
        </div>
      </section>

      {/* SECTION 4 — Fabrication Intelligence */}
      <section className="relative py-[140px] px-6 lg:px-12 overflow-hidden">
        <SectionBg imgUrl={LANDING_IMAGES.fabrication} dark overlayStrength={0.6} />
        <div className="relative z-10 max-w-5xl mx-auto">
          <h2 className="text-[40px] sm:text-[48px] font-semibold tracking-[-0.03em] text-center mb-20">
            It understands steel.
          </h2>
          <div className="space-y-[120px]">
            <div className="text-center">
              <p className="text-[28px] sm:text-[32px] font-medium mb-8">Base plates</p>
              <p className="text-[18px] text-slate-300 max-w-xl mx-auto">Dimensions, weld size, hole count — Quant derives labor from the geometry.</p>
            </div>
            <div className="text-center">
              <p className="text-[28px] sm:text-[32px] font-medium mb-8">Shear tabs</p>
              <p className="text-[18px] text-slate-300 max-w-xl mx-auto">Connection type, plate thickness, weld scheme — labor calculated automatically.</p>
            </div>
            <div className="text-center">
              <p className="text-[28px] sm:text-[32px] font-medium mb-8">Weld calculations</p>
              <p className="text-[18px] text-slate-300 max-w-xl mx-auto">Weld size, sides, condition. Quant uses your shop&apos;s productivity assumptions.</p>
            </div>
            <div className="text-center">
              <p className="text-[28px] sm:text-[32px] font-medium mb-8">Labor automation</p>
              <p className="text-[18px] text-slate-300 max-w-xl mx-auto">Handle. Layout. Drill. Fit. Weld. Clean. Each bucket populated, traceable, defensible.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — Built for Fabricators */}
      <section className="relative py-[140px] px-6 lg:px-12 overflow-hidden">
        <SectionBg imgUrl={LANDING_IMAGES.builtFor} dark={false} overlayStrength={0.45} />
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/40 via-transparent to-blue-50/30" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-[40px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.1] mb-12 text-slate-900">
            Your shop. Your numbers.
          </h2>
          <p className="text-[18px] sm:text-[20px] text-slate-600 leading-[1.6] max-w-2xl mx-auto">
            Configure your labor assumptions once. Quant performs the math every time. Seeded shop productivity — not generic industry rates.
          </p>
        </div>
      </section>

      {/* SECTION 6 — Speed and Productivity */}
      <section className="relative py-[140px] px-6 lg:px-12 overflow-hidden">
        <SectionBg imgUrl={LANDING_IMAGES.speed} dark overlayStrength={0.6} />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-[40px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.1] mb-16">
            Hours become minutes.
          </h2>
          <div className="grid sm:grid-cols-2 gap-12 max-w-2xl mx-auto">
            <div className="rounded-2xl bg-slate-800/50 border border-slate-600/50 p-10 text-left backdrop-blur-sm">
              <p className="text-slate-400 text-[15px] font-medium uppercase tracking-wider mb-4">Traditional</p>
              <p className="text-[48px] font-semibold mb-2">8–12 hrs</p>
              <p className="text-[17px] text-slate-400">Per structural estimate</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-blue-900/50 to-indigo-900/40 border border-indigo-500/30 p-10 text-left backdrop-blur-sm">
              <p className="text-indigo-300 text-[15px] font-medium uppercase tracking-wider mb-4">Quant</p>
              <p className="text-[48px] font-semibold mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">45 min</p>
              <p className="text-[17px] text-slate-400">Same scope</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — Interface (brand gradient: app body feel) */}
      <section id="demo" className="py-[140px] px-6 lg:px-12 bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-50/60 text-slate-900 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[40px] sm:text-[48px] font-semibold tracking-[-0.03em] text-center mb-20">
            Built for the way you work.
          </h2>
          <Link href="/signup" className="block group">
            <div className="rounded-2xl bg-slate-800 overflow-hidden shadow-2xl aspect-video flex flex-col items-center justify-center relative transition-transform duration-500 group-hover:scale-[1.01] border border-slate-600/30 ring-2 ring-transparent group-hover:ring-indigo-500/30 transition-all duration-300">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '48px 32px' }} />
              <div className="relative text-center">
                <p className="text-slate-400 text-[15px] font-medium tracking-wider mb-2">Quant</p>
                <p className="text-slate-500 text-[17px]">Estimating interface — try it free</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* SECTION 8 — Final CTA */}
      <section className="relative py-[160px] px-6 lg:px-12 overflow-hidden">
        <SectionBg imgUrl={LANDING_IMAGES.cta} dark overlayStrength={0.6} />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.15), transparent 70%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(59,130,246,0.08), transparent 60%)",
          }}
        />
        <div className="relative z-10 text-center">
          <h2 className="text-[48px] sm:text-[56px] lg:text-[64px] font-semibold tracking-[-0.03em] leading-[1.05] mb-10">
            Ready to estimate faster?
          </h2>
          <p className="text-[20px] text-slate-300 max-w-xl mx-auto mb-12">
            Request a demo. See Quant in action.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 text-[17px] font-medium rounded-[980px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#demo" className="text-[17px] text-slate-400 hover:text-indigo-400 transition-colors">
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 lg:px-12 border-t border-slate-700/50 bg-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Image
            src="/graphics/logos/quant logo.svg"
            alt="Quant"
            width={120}
            height={30}
            className="h-6 w-auto brightness-0 invert opacity-70"
          />
          <div className="flex items-center gap-8 text-[15px] text-slate-400">
            <Link href="/signup" className="hover:text-indigo-400 transition-colors">Start Free Trial</Link>
            <Link href="/login" className="hover:text-indigo-400 transition-colors">Sign In</Link>
            <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 text-center text-[13px] text-slate-500">
          © {new Date().getFullYear()} Quant. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
