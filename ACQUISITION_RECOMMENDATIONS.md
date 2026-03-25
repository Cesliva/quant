# Quant Steel Estimating — Acquisition Readiness Recommendations

**Target Acquirer:** Tekla (Trimble), Steel Fabrication Software  
**Audience:** Product, Engineering, and Business Leadership  
**Last Updated:** March 2025  

This document outlines prioritized recommendations to enhance Quant's appeal as an acquisition target, organized by impact and effort.

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Quick Wins (0–2 weeks)](#quick-wins-02-weeks)
3. [High-Impact (1–3 months)](#high-impact-13-months)
4. [Strategic (3–6 months)](#strategic-36-months)
5. [Tekla Integration Roadmap](#tekla-integration-roadmap)
6. [UI/UX Polish Checklist](#uiux-polish-checklist)
7. [Technical Debt & Prerequisites](#technical-debt--prerequisites)

---

## Executive Summary

**Quant's Acquisition Strengths:**
- Steel-specific domain expertise (25-year estimator pedigree)
- AI-first: spec review, proposal generation — not bolt-on
- Modern stack: Next.js 14, Firebase, real-time
- Labor Fingerprint™: proprietary labor auto-fill
- Narrow focus: structural steel only (not generic construction)

**Key Gaps to Address:**
- UI differentiation (feels generic SaaS vs. premium tool)
- Integration surface (import/export, BIM/ERP connectors)
- Estimate intelligence (benchmarking, learning from actuals)
- Proposal–estimate integration (tighter linkage)

---

## Quick Wins (0–2 weeks)

Low-effort, high-visibility improvements.

### 1. Empty States with Clear CTAs ✅ Implemented
**Where:** Projects list, Dashboard, Estimating grid when no lines  
**What:** Replace blank/loading with friendly empty states + next step  
**Example:** "No projects yet. Create your first estimate →"  
**Files:** `app/(dashboard)/projects/page.tsx`, `components/estimating/EstimatingGridCompact.tsx`  
**Done:** Projects empty state with contextual copy + Clear Filters when filtered; Estimating grid empty state with helpful description.

### 2. Keyboard Shortcut Legend ✅ Implemented
**Where:** Estimating page  
**What:** Add `?` modal showing Ctrl+Z/Y, Ctrl+Alt+Number for field nav  
**Files:** `components/ui/KeyboardShortcutsModal.tsx`, `app/(dashboard)/projects/[id]/estimating/page.tsx`  
**Done:** `?` key or keyboard icon opens shortcuts modal.

### 3. Consistent Loading Skeletons
**Where:** Spec Review, Proposal, Reports  
**What:** Use Skeleton components during AI/export operations instead of spinners  
**Files:** `app/(dashboard)/spec-review/page.tsx`, `app/(dashboard)/proposal/enhanced/page.tsx`, `components/ui/Skeleton.tsx`

### 4. Proposal–Estimate Live Sync Indicator
**Where:** Proposal enhanced page  
**What:** Badge/label: "Estimate total: $X,XXX" that updates when estimate changes  
**Files:** `app/(dashboard)/proposal/enhanced/page.tsx`

### 5. KPI Summary Click-Through
**Where:** KPISummary component  
**What:** Click Total Weight → scroll to weight column or filter; click Cost → cost breakdown  
**Files:** `components/estimating/KPISummary.tsx`

---

## High-Impact (1–3 months)

Moderate effort, strong acquisition value.

### Estimating Solutions

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 1 | **CSV/BOM Import** — Import line items from CSV with column mapping wizard | Medium | High |
| 2 | **Assembly Library** — Pre-built connection assemblies (base plate, clip, gusset) with one-click add | Medium | High |
| 3 | **Benchmarking** — Show "vs. company avg MH/T" and "vs. last bid" on each line/category | Medium | High |
| 4 | **Labor Fingerprint Audit** — "Why this labor?" tooltip linking to subcategory rule | Low | Medium |
| 5 | **Bulk Edit** — Multi-select rows, apply rate override or status change in one action | Medium | High |
| 6 | **Outlier Flags** — Auto-flag lines where labor or cost/ton deviates >20% from avg | Low | Medium |

### AI & Spec Review

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 7 | **Spec-to-Estimate Linking** — Link spec compliance items to estimate lines; show "covers spec §X" | Medium | High |
| 8 | **RFI Export** — Export recommended clarifications as RFI draft (Word/PDF) | Low | Medium |
| 9 | **Spec Section Highlighting** — In spec review results, link to source spec section (if PDF page known) | Low | Medium |

### Proposal

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 10 | **Live Estimate Sync** — Proposal totals and breakdowns always reflect current estimate | Low | High |
| 11 | **Proposal Templates** — Save/load proposal layouts and section order per company | Medium | Medium |
| 12 | **Inline Proposal Edit** — Edit AI-generated text in-place with diff view | Medium | Medium |

### Reports & Analytics

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 13 | **Saved Report Configs** — Save filter + sort + columns as named report | Low | Medium |
| 14 | **Visual Cost Breakdown** — Pie/bar chart of material/labor/coating/hardware | Low | Medium |
| 15 | **Cross-Project Comparison** — Compare MH/T, cost/ton across multiple projects | Medium | Medium |

### Material Nesting

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 16 | **Nesting Export** — Export to DSTV, NC, or CSV for cutting machines | Medium | High |
| 17 | **Visual Nesting Layout** — Simple 2D visualization of bars on stock | Medium | Medium |

---

## Strategic (3–6 months)

Larger initiatives for acquisition differentiation.

### Tekla Integration

| # | Initiative | Description |
|---|------------|-------------|
| 1 | **Tekla BOM Import** — Parse Tekla export (XML/CSV) to seed structural estimate |
| 2 | **PowerFab Export** — Send estimate or assemblies to Tekla PowerFab |
| 3 | **SSO / Trimble Identity** — Single sign-on via Trimble for enterprise pilots |
| 4 | **API Layer** — REST/GraphQL API for estimates, lines, projects (enables ERP/BIM integrations) |

### Estimate Intelligence

| # | Initiative | Description |
|---|------------|-------------|
| 5 | **Learning from Actuals** — Use estimate-vs-actual data to tune Labor Fingerprint and default rates |
| 6 | **Version Comparison** — Estimate versioning; compare "v2 vs v1" side-by-side |
| 7 | **Predictive Labor** — Suggest labor hours based on historical similar items |
| 8 | **Multi-Project Nesting** — Optimize stock across multiple projects |

### UI/UX Premium Feel

| # | Initiative | Description |
|---|------------|-------------|
| 9 | **Typography System** — Distinct display + body font pair (avoid Inter/Roboto) |
| 10 | **Motion System** — Subtle transitions (expand/collapse, tab switch, save feedback) |
| 11 | **Density Modes** — "Comfortable" vs "Dense" for power estimators |
| 12 | **Mobile/Tablet** — Responsive estimating for tablet field use |
| 13 | **Dark Mode** — Optional dark theme for long estimating sessions |

---

## Tekla Integration Roadmap

Recommended integration sequence for acquisition discussions.

```
Phase 1: Data Import (Months 1–2)
├── Tekla BOM/weight export → Quant estimate
├── CSV import with mapping
└── Assembly templates from Tekla library

Phase 2: Bidirectional (Months 3–4)
├── Quant estimate → PowerFab job/assembly
├── SSO with Trimble identity
└── Shared address book / GC contacts

Phase 3: BIM-Led (Months 5–6)
├── Model-to-estimate (weight, count from Tekla model)
├── Spec linkage (model objects ↔ spec sections)
└── Nesting export for Tekla-compatible machines
```

---

## UI/UX Polish Checklist

Apple/Tekla-grade refinement.

### Typography
- [ ] Define primary display font (headings)
- [ ] Define body font (tables, forms)
- [ ] Establish type scale (4–5 sizes)
- [ ] Ensure WCAG AA contrast

### Color
- [ ] Reduce reliance on blue for everything
- [ ] Define semantic palette (success, warning, error)
- [ ] Use opacity layers instead of flat colors

### Motion
- [ ] Expand/collapse transitions
- [ ] Tab switch transitions
- [ ] Save confirmation feedback
- [ ] Skeleton loaders for async content

### Density
- [ ] Add "Dense" mode for estimating table
- [ ] Consistent padding grid (4/8/16/24px)

### Empty States
- [ ] All list views have empty state + CTA
- [ ] First-time user onboarding tips

### Error Handling
- [ ] User-friendly error messages
- [ ] Retry flows for network/AI failures
- [ ] Validation vs. system error distinction

---

## Technical Debt & Prerequisites

Before acquisition or major features.

| Item | Priority |
|------|----------|
| E2E tests for estimating save/edit flow | High |
| E2E tests for proposal generation + export | High |
| API contract documentation (OpenAPI) | Medium |
| Security audit (multi-tenant, auth) | High |
| Performance profiling (large estimates, 500+ lines) | Medium |
| Remove console.log in production | Low |

---

## Implementation Notes

### CSV Import
- Use `xlsx` (already in deps) for Excel; add `papaparse` or native for CSV
- Wizard: 1) Upload 2) Map columns 3) Preview 4) Import
- Validate required fields (shape/size or plate dims, qty, length)

### Assembly Library
- Store at `companies/{id}/assemblyTemplates` in Firestore
- Seed with: Base Plate, Shear Tab, Gusset, Stiffener, Clip, Brace
- Apply template → fill labor + optional material defaults

### Benchmarking
- Compute company-wide avg MH/T and cost/ton by category
- Store in company settings or compute on-demand
- Show as badge/tooltip: "12% above company avg"

### Labor Fingerprint Audit
- Add `getSuggestedLaborExplanation(line, parent)` returning human-readable reason
- Display in tooltip or collapsible "Why" section

---

## Document History

| Date | Change |
|------|--------|
| Mar 2025 | Initial acquisition recommendations document |
