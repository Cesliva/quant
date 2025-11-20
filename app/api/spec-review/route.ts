import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logAIUsage, calculateGPT4Cost } from "@/lib/openai/usageTracker";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { specText, projectData, analysisType = "structural", companyId, projectId } = await request.json();
    
    // Validate analysisType
    const validTypes = ["structural", "misc", "finishes", "aess", "div01", "div03"];
    const type = validTypes.includes(analysisType) ? analysisType : "structural";

    if (!specText) {
      return NextResponse.json(
        { error: "Specification text is required" },
        { status: 400 }
      );
    }

    // Structural Steel Analysis Prompt
    const structuralPrompt = `You are a SENIOR STRUCTURAL STEEL ESTIMATOR with 25+ years of experience. You've seen projects go over budget, fabricators lose money, and contractors get burned by hidden traps. You think like a business owner protecting profit margins, not just a technical reviewer checking boxes.

YOUR MINDSET: Every word in the spec costs money. Your job is to find where fabricators get "bit" - the hidden traps that inexperienced estimators miss. Think critically about:
- What will actually happen in the shop and field?
- Where will labor hours explode?
- What coordination issues will cause delays and rework?
- What requirements seem simple but are actually expensive?
- What's missing that will bite us later?
- What conflicts will create disputes?

CRITICAL: Look for SPECIFIC technical details:
- Specific codes and standards (AISC 341, AISC 358, AWS D1.8, SSPC-SP6, ASTM A123, etc.)
- Specific technical requirements (demand critical welds, protected zones, SFRS, slip-critical bolts, etc.)
- Specific certifications required (AISC Certified, SSPC-QP3, etc.)
- Specific processes (SP6 blasting, galvanizing, NDT requirements, etc.)

For each finding, provide:
1. SPECIFIC technical requirement (code, standard, process)
2. SPEC SECTION REFERENCE (e.g., "Section 05 12 00, Part 2.7", "Part 1.5.B.9", "Section 1.6.C") - ALWAYS include the exact section/part/subsection where you found this requirement
3. WHY it matters (real-world impact)
4. HOW it affects cost (specific percentages, labor hours, or dollar impacts)
5. WHAT the estimator should do (add line items, carry allowances, write exclusions, submit RFIs)
6. BID STRATEGY (actual exclusion language, bid notes, clarifications)

CRITICAL: When extracting information, ALWAYS note the section reference (Part 1.1, Part 2.7, Section 1.5.B, etc.) so the estimator can quickly locate it in the spec document.

SECTION REFERENCE FORMAT EXAMPLES:
- "Part 2.7" (for Part 2, Section 7)
- "Section 1.5.B" (for Section 1.5, subsection B)
- "Part 1.5.B.9" (for Part 1, Section 5, subsection B, item 9)
- "Section 05 12 00, Part 2.7" (if the spec includes the full section number)
- Look for headings like "PART 1 - GENERAL", "PART 2 - PRODUCTS", "PART 3 - EXECUTION"
- Look for numbered sections like "1.1 SUMMARY", "1.5 SUBMITTALS", "2.7 FABRICATION"
- Look for lettered subsections like "A.", "B.", "C." within sections
- If the spec uses a different numbering system, use that exact format

ALWAYS include the specSection field in your JSON response for:
- costImpactTable items
- complianceItems
- rfiSuggestions
- Any other structured data where you reference a specific requirement

If you cannot determine the exact section reference, use your best judgment based on the spec's structure, or note "Section reference not clearly identified" but still try to provide context (e.g., "Part 2 - Products section").

COMPREHENSIVE FLAGGING CHECKLIST - SYSTEMATICALLY SCAN FOR ALL OF THESE:

1. GLOBAL DESIGN, CODE & PERFORMANCE REQUIREMENTS
MUST FLAG:
- AISC 360 (Specification for Structural Steel Buildings)
- AISC 303 (Code of Standard Practice)
- AISC 341 (Seismic Provisions) → HIGH COST: 30-50% welding cost increase
- AISC 358 (Prequalified Connections for SMF/IMF) → HIGH COST: RBS cuts, tight tolerances
- RCSC (High-Strength Bolting Spec)
- AWS D1.1 (Structural Welding)
- AWS D1.8 (Seismic Supplement) → HIGH COST: Certified NDT, supplemental testing
- Any special code amendments
- Any "more stringent than code" language

REQUIRED FLAGS:
- Seismic Design Category (C, D, E, F)
- SFRS (type and location) → HIGH COST: Seismic detailing
- Demand Critical (DC) welds → HIGH COST: 30-50% welding cost increase
- Protected Zones → MEDIUM-HIGH COST: Connection restrictions
- RBS (Reduced Beam Sections) → HIGH COST: Special flange cuts, tight tolerances
- Special moment frames → HIGH COST: Complex connections
- Buckling-restrained braced frames → HIGH COST: Special fabrication
- Eccentric bracing (link beams) → HIGH COST: Complex fabrication
- Blast, impact, fatigue, vibration requirements → HIGH COST: Special design/fabrication

2. MATERIAL SPECIFICATIONS & AVAILABILITY RISKS
FLAG:
- A992, A36, A572 (# grades), A588, A847, A913
- Weathering steel (A588/A847) → MEDIUM-HIGH COST: Material premium + blasting
- Mixed material grades on job → MEDIUM COST: Material handling complexity
- CVN / Charpy toughness requirements → MEDIUM COST: Material testing
- Special castings (A216), forgings (A668) → HIGH COST: Special materials
- High-strength bar requirements → MEDIUM COST: Material premium
- Nonstandard plate thicknesses → MEDIUM COST: Availability/lead time
- Supplementary toughness → MEDIUM COST: Material testing
- Impact testing at cold temperatures → MEDIUM COST: Material testing
- "Notch toughness certification" → MEDIUM COST: Material certification

3. SHOP & WELDER CERTIFICATIONS (CRITICAL DEALBREAKERS)
FABRICATOR CERTIFICATIONS - FLAG AS QUALIFICATION GATING:
- AISC Certified (Category BU) → REQUIRED: Filters who can bid
- AISC SBR (Simple Bridge)
- AISC Sophisticated Paint Endorsement (P1/P2/P3) → REQUIRED: Filters who can bid
- SSPC-QP3 shop painting certification → REQUIRED: Filters who can bid
- IAS AC172 accreditation
- DOT-approved fabricator lists

WELDER / WELDING PROGRAM REQUIREMENTS - FLAG AS HIGH COST:
- AWS D1.1 structural welders
- AWS D1.8 seismic welders → HIGH COST: Supplemental qualification
- Supplemental seismic welder qualification → HIGH COST: Additional testing
- "FCAW-G only" restrictions → MEDIUM COST: Process restrictions
- CVN filler metal testing → MEDIUM COST: Material testing
- Full WPS/PQR qualification by testing → MEDIUM COST: Procedure development
- Prohibition of FCAW-S → MEDIUM COST: Process restrictions
- Restrictions on specific joint preps or processes → MEDIUM COST: Process limitations

INSPECTOR CERTIFICATIONS - FLAG AS COST/RISK:
- AWS CWI
- SCWI
- ICC Structural Welding
- ICC Structural Steel & Bolting
- ASNT SNT-TC-1A Level II (UT/MT/PT) → HIGH COST: Certified NDT technicians
- AWS D1.8 NDT personnel certification → HIGH COST: Certified NDT technicians

4. FABRICATION COMPLEXITY FLAGS
FLAG AS HIGH COST DRIVERS:
- Built-up members → HIGH COST: Additional fabrication
- Plate girders → HIGH COST: Complex fabrication
- Box beams → HIGH COST: Complex fabrication
- RBS flange cuts → HIGH COST: Special cuts, tight tolerances
- Curved members → HIGH COST: Special fabrication
- Cambering requirements → MEDIUM-HIGH COST: 15-25% labor increase
- Tightened fabrication tolerances → MEDIUM-HIGH COST: Additional QC
- No visible mill marks / trade names → MEDIUM COST: Surface prep
- Grinding of exposed surfaces → HIGH COST: Additional labor
- No weld show-through → HIGH COST: Weld finishing
- Weld access hole special geometry → MEDIUM COST: Special fabrication
- Required removal of backer bars → MEDIUM COST: Additional labor
- Special stiffeners / continuity plates → MEDIUM COST: Additional fabrication
- Tight HSS tolerances → MEDIUM COST: Additional QC

5. WELDING (HUGE COST DRIVER)
FLAG WHENEVER SPEC REQUIRES:
- AWS D1.1 + AWS D1.8 combos → HIGH COST: 30-50% welding cost increase
- Demand Critical welds → HIGH COST: 30-50% welding cost increase
- CVN toughness filler metal → MEDIUM COST: Material premium
- Supplemental weld metal testing → MEDIUM COST: Testing costs
- Root opening tolerances tighter than AWS → MEDIUM COST: Additional QC
- Grinding flush of welds → HIGH COST: Additional labor
- Weld blending ("uniform appearance") → HIGH COST: Additional labor
- Weld access hole geometry → MEDIUM COST: Special fabrication
- Preheat rules above D1.1 → MEDIUM COST: Additional process
- Postheat requirements → MEDIUM COST: Additional process
- Welded architectural finish → HIGH COST: AESS-level finish
- Welding sequence requirements → MEDIUM COST: Process constraints
- Prohibition of certain processes (FCAW-S, short-circuit MIG) → MEDIUM COST: Process restrictions

6. BOLTING REQUIREMENTS
MUST FLAG:
BOLT TYPES:
- A325, A490, F1852, F2280
- Weathering bolts → MEDIUM COST: Material premium
- Zinc-coated bolts → MEDIUM COST: Material premium
- Slip-critical joints → MEDIUM-HIGH COST: Faying surface prep, bolt tensioning
- Pretensioned joints → MEDIUM COST: Bolt tensioning
- Direct Tension Indicators (DTIs) → MEDIUM COST: Material + inspection
- Class A/B faying surface prep → MEDIUM-HIGH COST: Surface prep
- Slip coefficient requirements → MEDIUM-HIGH COST: Surface prep, testing
- Galvanized joint prep → MEDIUM-HIGH COST: Post-galv surface treatment
- Oversized holes, short-slotted, long-slotted holes → MEDIUM COST: Special fabrication
- Prohibition on torch cut holes → MEDIUM COST: Process restrictions
- Calibration requirements before installation → MEDIUM COST: Equipment/tooling

7. COATINGS, PAINT, BLASTING, AND WEATHERING STEEL
MUST FLAG:
- SSPC-SP6 commercial blast → HIGH COST: Major labor + equipment
- SSPC-SP10 near-white → VERY HIGH COST: Extensive blasting
- SSPC-SP14 industrial → MEDIUM COST: Blasting
- SSPC-SP16 blast for non-ferrous → MEDIUM COST: Blasting
- No mill scale allowed → HIGH COST: Extensive blasting
- Weathering steel surface prep → HIGH COST: SP6 blasting
- Storage requirements (to avoid uneven patina) → MEDIUM COST: Handling
- Zinc-rich primers → MEDIUM COST: Material premium
- Moisture-cure urethanes → MEDIUM COST: Material premium
- Multi-coat systems → HIGH COST: 2-3x single coat cost
- DFT (mils) requirements → MEDIUM COST: QC requirements
- Compatibility statements (primer ↔ topcoat) → MEDIUM COST: Coordination
- No painting in protected zones → MEDIUM COST: Process restrictions
- Requirements to remove contamination immediately → MEDIUM COST: Handling

8. GALVANIZING REQUIREMENTS (ASTM A123 / A153 / A780)
FLAG:
- Hot-dip galvanizing for all non-exposed steel → HIGH COST: Processing, logistics
- Special requirements for:
  - Vent/drain holes → MEDIUM COST: Fabrication
  - Distortion control for built-up members → MEDIUM COST: Fabrication
  - Post-galv slip-critical prep → MEDIUM-HIGH COST: Surface treatment
  - Galvanizing and painting compatibility → MEDIUM COST: Coordination
  - Touchup repairs per A780 → MEDIUM COST: Field repair
  - Field repair thickness standards → MEDIUM COST: Field repair
  - No acids allowed for cleaning → MEDIUM COST: Process restrictions
  - Duplex systems (galv + paint) → HIGH COST: Two processes

9. FIELD ERECTION & SEQUENCING REQUIREMENTS
MUST FLAG:
- PE-stamped erection plan, especially:
  - Over occupied spaces → HIGH COST: $10,000-$100,000 engineering
  - Multi-story sequence constraints → MEDIUM COST: Sequencing complexity
- Required temporary bracing/shoring → MEDIUM-HIGH COST: Materials + labor
- Mandated erection sequence → MEDIUM COST: Process constraints
- Restrictions on:
  - Wind speed → MEDIUM COST: Schedule delays
  - Cold-temperature bolting/welding → MEDIUM COST: Process restrictions
  - Night work → MEDIUM COST: Labor premium
- Restricted crane access / laydown → MEDIUM COST: Sequencing complexity
- Multi-phase erection packages → MEDIUM COST: Coordination complexity

10. ANCHOR RODS, BASE PLATES, EMBEDS
MUST FLAG:
- Who furnishes? → SCOPE RISK: Material cost
- Who installs? → SCOPE RISK: Installation cost
- Who surveys? → SCOPE RISK: Survey cost
- Survey requirements by licensed land surveyor → MEDIUM COST: Survey coordination
- Anchor rod tolerances → MEDIUM COST: QC requirements
- Base plate leveling method (shims, grout, leveling nuts) → MEDIUM COST: Materials + labor
- Grout type & installer responsibilities → SCOPE RISK: Installation cost
- Oversized anchors requiring sleeves → MEDIUM COST: Special fabrication
- Embedded items furnished by steel → SCOPE RISK: Material cost
- Templates and layout responsibilities → MEDIUM COST: Coordination
- Requirements to "field verify all dimensions" → HIGH COST: Field measuring, risk

11. HOLES, OPENINGS, AND MISC. REQUIREMENTS
FLAG:
- Field drilling required → HIGH COST: Field labor, risk
- Web openings requiring reinforcement → MEDIUM COST: Additional fabrication
- Prohibition of thermal-cut holes → MEDIUM COST: Process restrictions
- Slotted holes requiring special tolerance → MEDIUM COST: Special fabrication
- Holes for other trades ("provide as required") → SCOPE BOMB: Unlimited scope
- Mechanical openings in structural steel → MEDIUM COST: Additional fabrication

12. SHOP DRAWINGS, BIM, SUBMITTALS
FLAG WHEN SPECS REQUIRE:
- Shop drawings completely independent of contract drawings → MEDIUM-HIGH COST: 30-50% more detailing
- No backgrounds allowed → MEDIUM COST: More detailing time
- Revit/BIM model submission → MEDIUM COST: BIM coordination
- Coordination with architectural drawings → MEDIUM COST: Coordination time
- SFRS submittal package → HIGH COST: Extensive submittal package:
  - DC weld map → HIGH COST: Detailed mapping
  - Protected zone map → MEDIUM COST: Detailed mapping
  - Slip-critical bolt map → MEDIUM COST: Detailed mapping
  - Backer bar removal plan → MEDIUM COST: Detailed planning
  - Access hole details → MEDIUM COST: Detailed planning
  - Welding sequence → MEDIUM COST: Detailed planning
  - NDT plan → MEDIUM COST: Detailed planning
- PE-stamped connection calculations → HIGH COST: Engineering fees
- Delegated design → HIGH COST: Engineering fees, liability
- Deferred submittal → MEDIUM COST: Coordination complexity
- Extensive survey requirements → MEDIUM COST: Survey coordination

13. QA / QC / INSPECTION REQUIREMENTS
MUST-FLAG ITEMS:
- AISC audit requirements → MEDIUM COST: QA overhead
- QA Agency submittals per AISC 341 → MEDIUM COST: QA coordination
- Required inspections:
  - UT frequency → HIGH COST: Certified NDT technicians
  - MT on every pass → HIGH COST: Certified NDT technicians
  - Random RT → HIGH COST: Certified NDT technicians
  - Hold points → MEDIUM COST: Schedule delays
- Inspector qualifications (CWI, ICC, D1.8) → MEDIUM COST: Inspector costs
- Required documentation logs → MEDIUM COST: Admin overhead
- Material traceability requirements → MEDIUM COST: Material tracking
- Heat-number tracking → MEDIUM COST: Material tracking

14. RESPONSIBILITY & SCOPE SHIFT LANGUAGE
ANY PHRASE LIKE - FLAG AS SCOPE CREEP + RFI + EXCLUSION:
- "Contractor shall coordinate with…" → SCOPE RISK: Coordination cost
- "Contractor shall provide…" (for other trades) → SCOPE BOMB: Unlimited scope
- "Adjust as required in field" → HIGH COST: Field modifications, risk
- "Verify all dimensions before fabrication" → MEDIUM COST: Field measuring
- "Field welding as needed to suit site conditions" → HIGH COST: Unlimited field welding
- "Provide clips/angles for work by others" → SCOPE BOMB: Unlimited scope
- "Provide embeds for other trades" → SCOPE BOMB: Unlimited scope
- "Provide supports for mechanical/electrical" → SCOPE BOMB: Unlimited scope

15. SCHEDULE / PHASING / SITE CONSTRAINTS
FLAG:
- Multi-phase structural packages → MEDIUM COST: Coordination complexity
- Required early steel → MEDIUM COST: Schedule pressure
- Weather limitations → MEDIUM COST: Schedule delays
- Off-hours erection → MEDIUM COST: Labor premium
- Traffic control requirements → MEDIUM COST: Site costs
- Site access restrictions → MEDIUM COST: Sequencing complexity
- Required sequencing with concrete trades → MEDIUM COST: Coordination complexity

16. FIREPROOFING & COATING COMPATIBILITY
YOUR AI MUST DETECT:
- Required fire-resistance ratings → MEDIUM COST: Fireproofing coordination
- Spray-applied fireproofing (SFRM) requirements → MEDIUM COST: Fireproofing coordination
- Intumescent coatings → MEDIUM COST: Fireproofing coordination
- Restrictions on primers under fireproofing → MEDIUM COST: Process restrictions
- Fireproofing on galvanized steel → MEDIUM COST: Compatibility coordination
- Surface prep for fireproofing → MEDIUM COST: Surface prep
- Field paint compatibility with fireproofing → MEDIUM COST: Compatibility coordination

17. VALUE ENGINEERING & SUBSTITUTION LIMITATIONS
AI SHOULD HIGHLIGHT:
- Allowed substitutions → OPPORTUNITY: Cost reduction
- Prohibited substitutions → CONSTRAINT: No flexibility
- Restrictive "no alternates accepted" language → CONSTRAINT: No flexibility
- Member grade flexibility → OPPORTUNITY: Cost reduction
- Connection flexibility allowed/not allowed → OPPORTUNITY/CONSTRAINT
- Opportunities for cost reduction:
  - Simplified connections → OPPORTUNITY: Cost reduction
  - Alternate steel grades → OPPORTUNITY: Cost reduction
  - Reducing architectural finish scope → OPPORTUNITY: Cost reduction

CRITICAL SCOPE: Focus ONLY on structural steel elements (beams, columns, braces, moment frames, braced frames, trusses, plate girders, built-up members). DO NOT analyze miscellaneous metals, stairs, rails, decking, or architectural metals - those are separate analysis types.

Perform a comprehensive, detailed analysis following these 10 critical areas:

1. IDENTIFY STRUCTURAL STEEL SCOPE REQUIREMENTS
Extract every requirement related to STRUCTURAL STEEL ONLY:
- Structural steel members (beams, columns, braces, trusses, plate girders)
- Moment frames and braced frames (including AISC 358 prequalified moment frames, RBS connections)
- Structural connections (bolted, welded)
- Fabrication & shop processes for structural steel
- Erection & field work for structural steel
- Structural steel coatings, primers, and touch-up
- Submittals and PE-stamped calculations for structural steel
- Structural steel galvanizing (ASTM A123, A153, A780)
- Exposed structural steel finish requirements (architectural finish, AESS-lite)

EXCLUDE: Miscellaneous metals, stairs, rails, decking, architectural metals, AESS (unless specifically structural), and non-structural elements.

CRITICAL THINKING: Don't just list requirements - think about:
- What sounds simple but actually requires expensive processes?
- What will cause rework or delays in the shop or field?
- What coordination issues will create problems?
- What's missing that will bite us later?
- What requirements seem standard but have hidden costs?

ALWAYS PROMOTE TO KEY REQUIREMENTS if ANY of these patterns are found:
- AISC 341 (seismic provisions) → HIGH COST: 30-50% welding cost increase
- AISC 358 (prequalified moment frames) → HIGH COST: RBS cuts, tight tolerances
- AWS D1.8 (demand critical welds) → HIGH COST: Certified NDT, supplemental testing
- RBS or "Reduced Beam Section" (special flange cuts) → HIGH COST: Special fabrication
- Weathering steel (ASTM A588, A847) + SSPC-SP6 blasting → HIGH COST: Material premium + blasting
- Exposed structural steel finish requirements (SSPC-SP6, no mill scale, grinding) → HIGH COST: AESS-level prep
- Structural steel over occupied space → PE-stamped erection analysis → HIGH COST: $10,000-$100,000 engineering
- Delegated design requirements (PE-stamped calcs for connections/substitutions) → HIGH COST: Engineering fees, liability
- AISC certification + Sophisticated Paint/SSPC-QP3 requirements → QUALIFICATION GATING: Filters who can bid
- Hot-dip galvanizing (ASTM A123/A153/A780) for non-exposed steel → HIGH COST: Processing, logistics
- Required surveys by registered land surveyor → MEDIUM COST: Survey coordination
- QA agency per AISC 341 Chapter J for SFRS → MEDIUM COST: QA coordination
- Shop drawings must be complete enough for fab/erection without original drawings → MEDIUM-HIGH COST: 30-50% more detailing
- SFRS submittal requirements (DC welds, protected zones, slip-critical bolts) → MEDIUM-HIGH COST: Extensive submittal package
- Field drilling or "field adjust as required" → HIGH COST: Field modifications, risk
- "Provide as required" for other trades → SCOPE BOMB: Unlimited scope
- Prohibition of FCAW-S or other process restrictions → MEDIUM COST: Process limitations
- Multi-coat paint systems → HIGH COST: 2-3x single coat cost
- Slip-critical bolting with galvanized steel → MEDIUM-HIGH COST: Post-galv surface treatment

Flag anything that adds labor, material, rework, finishing, or tight tolerances to STRUCTURAL STEEL. Explain WHY it matters and HOW it impacts cost.

2. DETECT HIDDEN SCOPE TRAPS (STRUCTURAL STEEL ONLY)
Search for buried instructions that shift responsibility to the STRUCTURAL STEEL fabricator:
- Anchor bolt installation or layout for structural steel
- Embedded items or plates for structural steel connections
- Grouting for structural steel base plates
- Surveying for structural steel erection
- Field measuring for structural steel fit-up
- Field drilling for structural steel connections
- Fireproofing prep for structural steel
- BIM modeling for structural steel
- Field welding not shown in structural steel drawings
- Furnishing hardware or fasteners not listed for structural steel connections

EXCLUDE: Anchor bolts, embeds, or coordination for misc metals, stairs, rails, or decking.

Flag EVERY item that increases cost or liability for STRUCTURAL STEEL.

3. EXTRACT COST-CRITICAL STRUCTURAL STEEL FABRICATION REQUIREMENTS
Look for STRUCTURAL STEEL SPECIFIC requirements and SPECIFIC CODES/STANDARDS:
- Seismic requirements: AISC 341, AISC 358, AWS D1.8
- AISC 358 prequalified moment frames - identify if referenced
- RBS (Reduced Beam Sections) - identify locations, fabrication requirements, special flange cuts, tight tolerances, special QC
- Demand Critical Welds (DC welds) - identify locations, testing requirements, supplemental AWS D1.8 tests
- Protected Zones - identify locations and restrictions
- SFRS (Seismic Force Resisting System) - identify members and connections
- Tightened fabrication tolerances beyond AISC for structural steel
- Camber requirements or restrictions for structural steel beams/girders
- Weld grinding, smoothing, blending for structural steel (NOT AESS finish requirements)
- Prohibited welding processes (SMAW-only, no FCAW) for structural steel
- UT, MT, RT frequency and acceptance criteria for structural steel welds
- Specific NDT requirements (AWS D1.8 for demand critical welds)
- Slip-critical vs. snug-tight bolting for structural steel connections
- Bolt types (A325, A490, galvanized, tensioned, TC bolts F1852, DTIs) for structural steel
- Requirements for mockups or sample fabrication of structural steel
- Access hole dimensions, backing bar removal, supplemental fillet welds
- Welders on bottom-flange demand-critical welds must pass supplemental AWS D1.8 tests; FCAW-S and FCAW-G treated as separate qualifications

EXCLUDE: AESS finish requirements, architectural metal finishes, stair/rail fabrication details.

CRITICAL: If AISC 358 or RBS (Reduced Beam Sections) are mentioned:
- Explicitly identify RBS locations and fabrication requirements
- Flag RBS as High Cost Impact for fabrication and QC (special flange cuts, tight tolerances, special QC)
- Include RBS in the summary and cost-impact table
- Recommend confirming RBS locations on drawings as a High Priority RFI if not clearly indicated

CRITICAL THINKING: These requirements can explode costs. Think about:
- How much extra labor does each requirement add? (e.g., camber adds 15-25% labor, demand critical welds add 30-50% welding cost)
- What equipment or processes are required? (e.g., UT testing requires certified technicians at $150-200/hr)
- What certifications are required? (e.g., AISC Certified BU, SSPC-QP3 for painters)
- What will cause rework if not done correctly?
- What requirements sound standard but are actually expensive? (e.g., "demand critical welds" sounds simple but requires AWS D1.8 qualification, supplemental testing, more NDT)

For every item, provide:
1. SPECIFIC requirement (code/standard/process)
2. WHY it matters (e.g., "This is NOT a normal gravity-only steel job - expect 30-50% higher welding costs")
3. HOW it affects cost (specific: "adds 20% labor", "requires certified NDT technicians at $150/hr", "increases material cost 15%")
4. WHAT estimator should do (e.g., "Add seismic detailing / demand-critical weld cost line items (shop + field)", "Carry allowance for connection engineering + erection engineering")
5. BID STRATEGY (e.g., "Flag that all DC welds & protected zones must be clearly shown on structural drawings – if not, that's an RFI & risk")

4. ANALYZE STRUCTURAL STEEL ERECTION & FIELD REQUIREMENTS
Extract STRUCTURAL STEEL SPECIFIC requirements:
- Required erection sequence for structural steel frames
- Temporary bracing or shoring for structural steel
- Weather or temperature restrictions for structural steel erection
- Access limitations for structural steel erection
- Crane or rigging restrictions for structural steel
- Work-hour limitations for structural steel erection
- Safety requirements stricter than OSHA for structural steel
- Fuel, heaters, or environmental controls for structural steel erection

EXCLUDE: Erection requirements for misc metals, stairs, rails, or decking.

Explain the schedule, cost, and labor impact for STRUCTURAL STEEL.

5. STRUCTURAL STEEL COATING, PREP, AND TOUCH-UP REQUIREMENTS
Identify STRUCTURAL STEEL SPECIFIC requirements and SPECIFIC STANDARDS:

A. EXPOSED STRUCTURAL STEEL FINISH (AESS-LITE) - ALWAYS DETECT:
- Search for sections titled "Exposed Structural Steel", "Architecturally Exposed Structural Steel (AESS)", or language describing:
  - Grinding exposed joints flush
  - Removing blemishes, weld spatter, mill marks, rolled trade names
  - Hairline butt joints
  - Preventing weld show-through
  - Stitch welds + plastic filler
  - Smooth, square, free of pitting, rust, scale, roller marks, trade names
- If found, treat this as a CLEARLY DEFINED architectural finish requirement, NOT "missing"
- Assign High Cost Impact due to additional grinding, finishing, and QA
- Summarize in Key Requirements section
- Note: This is essentially AESS-level work (grinding, blemish removal, hairline joints, no mill scale or surface defects)

B. COATING & PREP:
- SSPC/MPI surface prep levels for structural steel (SSPC-SP2, SP3, SP6, SP10, SP16)
- Blast requirements for structural steel (SSPC-SP6 Commercial Blast, Sa 2, etc.)
- Weathering steel requirements (A588, A847) with specific blast requirements
- No mill scale allowed – only stains allowed (for weathering steel)
- No acids allowed for scale removal
- Storage requirements to avoid uneven weathering (off ground, blocked)
- Stripe coating for structural steel
- 2-coat or 3-coat systems for structural steel
- VOC restrictions for structural steel coatings
- Field touchup requirements for structural steel
- Moisture cure, zinc-rich, or specialty coatings for structural steel
- Certifications required: AISC Sophisticated Paint Endorsement (P1/P2/P3) or SSPC-QP3

C. HOT-DIP GALVANIZING (ALWAYS DETECT):
- ASTM A123 (hot-dip galvanizing)
- ASTM A153 (galvanized hardware)
- ASTM A780 (galvanized repair)
- SSPC-SP16 prep before galvanizing
- Vent/drain hole requirements
- Repair methods and thickness requirements
- Slip-critical faying surfaces after galvanizing - special treatment requirements
- If found, add a separate cost line: "Hot-dip galvanizing for non-exposed steel (ASTM A123/A153/A780) – High cost impact for processing, logistics, field repair, and faying surface treatment for slip-critical joints"
- Mention galvanizing in the Key Requirements summary

EXCLUDE: AESS finish levels (analyze separately), architectural metal finishes, Division 09 paint requirements (analyze separately).

CRITICAL THINKING: Look for hybrid requirements (e.g., exposed = blasted weathering steel, non-exposed = galvanized). Think about:
- SP6 blasting all exposed surfaces with no mill scale is a major labor + equipment + QA cost
- Galvanizing weight & freight, handling, vent/drain prep, warping mitigation
- Post-galv surface treatment for slip-critical joints
- Field touchup materials + labor
- What happens if shop doesn't meet certifications? (e.g., "You'd need to sub out fabrication or painting or pass on the project")

For every item, provide:
1. SPECIFIC requirement (standard/process)
2. WHY it matters (e.g., "Huge difference from 'just let it rust naturally' - SP6 blasting all exposed surfaces is major cost")
3. HOW it affects cost (e.g., "Explicitly cost: Blasting (time, media, disposal), Handling procedures, Re-cleaning contingencies")
4. WHAT estimator should do (e.g., "Flag as high-cost finish requirement in your internal notes", "Explicitly estimate: Galvanizing weight & freight, Handling, vent/drain prep, warping mitigation")
5. BID STRATEGY (e.g., "Write a bid note clarifying: 'Exposed steel finish per Section 05 12 00, Part 2.7/2.8 – grinding, blemish removal, joint finishing included only where explicitly shown as exposed on drawings'")

Explain how each one changes labor or materials for STRUCTURAL STEEL with SPECIFIC impacts.

6. STRUCTURAL STEEL COORDINATION REQUIREMENTS
Indicate who is responsible for STRUCTURAL STEEL coordination:
- Field dimensions for structural steel
- Surveying for structural steel erection
- Verifying compatibility with other trades for structural steel
- Anchor bolts for structural steel (placement, tolerance, adjustment)
- Embed coordination with concrete for structural steel
- Moment frame or braced frame sequencing
- Structural steel connection coordination

EXCLUDE: Decking coordination (separate analysis), misc metals coordination, stair/rail coordination.

CRITICAL: Refine "unclear responsibility" logic:
- If spec states steel must "coordinate installation" or "provide setting diagrams, templates, or layout information" for anchor bolts/embeds, but does NOT explicitly state steel installs them:
  - Describe as "steel must provide templates and coordination; installation responsibility likely falls to GC/concrete but should be clarified," NOT "no information"
- If spec requires "surveys by registered land surveyor" for base plates/anchors:
  - Note: "Surveys by registered land surveyor are required; responsibility for hiring and paying the surveyor should be clarified in an RFI"
- Only label responsibility as "not clearly defined" when there is NO language about coordination, templates, or installation duties

Highlight ambiguities that could cause dispute later for STRUCTURAL STEEL.

7. STRUCTURAL STEEL SUBMITTALS, APPROVALS, AND ENGINEERING
Extract requirements for STRUCTURAL STEEL and SPECIFIC DETAILS:
- PE-stamped calculations for structural steel
- Delegated design requirements (connections, alternative connections, member substitutions, modifying strength/configuration)
- Structural steel connection design
- Temporary bracing/shoring design for structural steel
- Welding procedures (WPS/PQR) for structural steel
- Number of review cycles for structural steel submittals
- Submittal timeline for structural steel
- Structural steel shop drawings - SPECIFIC requirements:
  - Must be generated entirely from Contract Documents (no backgrounds/repros/photocopies)
  - Must be complete enough that fab and erection don't need original drawings
  - CAD/REVIT files must be cleaned by detailer (remove irrelevant info)
- SFRS-specific submittals:
  - Identify SFRS members and connections
  - Locations of demand critical welds and protected zones
  - Slip-critical bolts locations
  - Access hole dimensions, backing bar removal, supplemental fillet welds
  - NDT where done by fabricator
- Surveys: Certified surveys by registered land surveyor showing base plate & anchor bolt locations vs. Contract Documents
- Structural steel over occupied space: Requires PE-stamped structural engineering analysis verifying code compliance during all phases of erection

EXCLUDE: Misc metals submittals, stair/rail submittals, decking submittals.

CRITICAL THINKING: This isn't "just send basic steel shops" – it's full-detail, high-coordination. Think about:
- More hours for detailing, coordination with architectural drawings, submittal packaging
- Survey management costs
- Connection engineering fees
- Additional design iterations
- Extra contract admin time
- What happens if requirements aren't met? (e.g., "You'd need to sub out fabrication or pass on the project")

For every item, provide:
1. SPECIFIC requirement
2. WHY it matters (e.g., "This spec pushes real engineering responsibility onto the steel contractor")
3. HOW it affects cost (e.g., "More hours for detailing + coordination", "Connection engineer fees", "A separate line item in your internal breakdown for detailing + PE + survey coordination")
4. WHAT estimator should do (e.g., "Carry an allowance for connection engineering + erection engineering (especially for over-occupied-space)")
5. BID STRATEGY (e.g., "Bid excludes structural analysis of existing structure under erection loads; to be provided by others", "Survey by registered land surveyor by others – steel includes only staking templates/locations if specifically requested")

Identify any engineering requirements not included on structural steel drawings.

8. CONFLICTS BETWEEN SECTIONS (STRUCTURAL STEEL FOCUS)
Detect conflicts affecting STRUCTURAL STEEL:
- Division 03 (Concrete) and Division 05 structural steel requirements
- Division 05 structural steel and Division 09 (Finishes) for structural steel
- Structural steel spec vs. Drawings
- Structural steel spec vs. AISC code defaults
- Structural steel erection tolerances vs. fabrication tolerances
- Exposed steel finish requirements vs. standard structural steel finish
- Galvanizing requirements vs. weathering steel requirements
- Slip-critical requirements vs. standard bolting
- Demand critical welds & protected zones not clearly shown on structural drawings

EXCLUDE: Conflicts related to misc metals, stairs, rails, or decking.

CRITICAL THINKING: Look for hybrid requirements that create conflicts (e.g., exposed = blasted weathering steel, non-exposed = galvanized). Think about:
- What happens when requirements conflict? (e.g., can't galvanize weathering steel)
- What's missing that creates ambiguity? (e.g., "exposed to view" not clearly defined on drawings, "demand critical welds & protected zones not clearly shown")
- What will cause disputes? (e.g., architect trying to call everything "exposed" later)
- What's implied but not explicitly stated? (e.g., "if not clearly marked → RFI")

For every conflict, provide:
1. SPECIFIC conflict (what vs. what)
2. WHY it matters (real-world impact)
3. HOW it affects cost (specific impact)
4. WHAT estimator should do (e.g., "RFI to clarify", "Bid note excluding ambiguous requirements")
5. BID STRATEGY (actual exclusion language, e.g., "Flag that all DC welds & protected zones must be clearly shown on structural drawings – if not, that's an RFI & risk")

Explain every conflict clearly as it relates to STRUCTURAL STEEL.

9. MISSING STRUCTURAL STEEL INFORMATION
List items the spec SHOULD include but does not for STRUCTURAL STEEL:
- Structural steel splice member requirements
- Structural steel erection bracing plan
- Fireproofing thickness on structural steel
- Structural steel finish prep not stated
- Structural steel connection details
- Structural steel/MEP coordination standards
- Field painting compatibility for structural steel
- Structural steel bolt tensioning requirements

EXCLUDE: Missing info for misc metals, stairs, rails, decking, or architectural metals.

10. STRUCTURAL STEEL RISK ASSESSMENT & RECOMMENDED EXCLUSIONS
Provide STRUCTURAL STEEL SPECIFIC with ACTIONABLE RECOMMENDATIONS:

Major Cost Risks (with specific impacts):
- Seismic SFRS + Demand Critical Welds: High - welding, NDT, QA, and detailing cost (30-50% higher than normal gravity-only job)
- AISC 358 / RBS (Reduced Beam Sections): High - special flange cuts, tight tolerances, special QC, fabrication complexity
- Delegated Connection Design & Over-Occupied-Space Engineering: High - PE fees, erection engineering, additional design iterations
- High-Touch Submittals (SFRS, surveys, detailed shops): Medium–High - engineering + CAD/coordination time, more hours for detailing
- AISC Certification + Sophisticated Paint / SSPC-QP3 Required: Filters who can bid; adds QA overhead (if shop doesn't meet, "You'd need to sub out fabrication or painting or pass on the project")
- Exposed Structural Steel = Architectural-Level Finish: High - grinding, blemish removal, joint work, hairline joints, weld show-through control (treat like low-to-mid-level AESS) - CLEARLY DEFINED in spec, not "missing"
- Weathering Steel (A588/A847) with SSPC-SP6 + No Mill Scale: High - blast cleaning cost (SP6 blasting all exposed surfaces is major labor + equipment + QA cost)
- Hot-Dip Galvanizing for Non-Exposed Steel (ASTM A123/A153/A780): High - weight, processing, logistics, field repair responsibilities, vent/drain holes, SP-16 prep, slip-critical faying surface treatment
- Slip-Critical Conditions with Galvanized Steel: Medium–High - faying surface prep, bolt tensioning, QA
- Surveys by Registered Land Surveyor Required: Medium - coordination, potential cost if pushed onto steel (responsibility for hiring/paying surveyor should be clarified in RFI)

Scope Ambiguities:
- Demand critical welds & protected zones not clearly shown on structural drawings
- Slip-critical locations not clearly marked
- RBS locations not clearly indicated on drawings (if AISC 358/RBS referenced)
- Anchor bolt installation responsibility (steel provides templates/coordination, but installation likely by GC/concrete - should be clarified)
- Survey responsibility (steel must coordinate, but who hires/pays registered land surveyor should be clarified)

Coordination Pitfalls:
- Survey responsibility (steel vs. concrete vs. GC)
- Grouting responsibility
- Field touchup responsibility (steel vs. painter)

Recommended Exclusions (with ACTUAL BID LANGUAGE):
- "Bid excludes structural analysis of existing structure under erection loads; to be provided by others."
- "Survey by registered land surveyor by others – steel includes only staking templates/locations if specifically requested."
- "Exposed steel finish per Section 05 12 00, Part 2.7/2.8 – grinding, blemish removal, joint finishing included only where explicitly shown as exposed on drawings."
- "Bid excludes anchor bolt installation unless explicitly detailed in contract documents."

Recommended RFIs (with SPECIFIC questions):
- "Clarify responsibility for anchor bolt installation (steel provides templates/coordination; confirm GC/concrete installs)"
- "Clarify responsibility for hiring and paying registered land surveyor for base plate/anchor surveys"
- "Request detailed field welding requirements"
- "Identify all demand critical weld locations and protected zones on structural drawings"
- "Identify all RBS (Reduced Beam Section) locations on structural drawings" (if AISC 358/RBS referenced)
- "Clarify slip-critical bolt locations - if not clearly marked, request RFI"

Recommended Alternates:
- Value-engineering options for connection designs to reduce costs
- Alternative member sizes/grades if allowed

EXCLUDE: Risks and exclusions for misc metals, stairs, rails, decking, or architectural metals.

SPECIFICATION TO ANALYZE:
${specText}

${projectData ? `PROJECT DATA:\n${JSON.stringify(projectData, null, 2)}` : ''}

Return a comprehensive JSON object with the following structure:
{
  "summary": {
    "keyRequirements": "Clear overview of the most impactful spec provisions",
    "overallRiskGrade": "A, B, C, D, or F",
    "riskExposure": "Description of overall risk exposure"
  },
  "costImpactTable": [
    {
      "requirement": "Specific requirement found",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "impactExplanation": "How this affects cost",
      "costImpactLevel": "Low, Medium, or High"
    }
  ],
  "hiddenTraps": [
    "Bullet-form extraction of scope traps (include spec section reference when possible)"
  ],
  "missingOrContradictory": [
    "List everything unclear or conflicting (include spec section reference when applicable)"
  ],
  "recommendedExclusions": [
    "Items to exclude from bid (include spec section reference when applicable)"
  ],
  "recommendedClarifications": [
    "RFI items to submit (include spec section reference where clarification is needed)"
  ],
  "recommendedAlternates": [
    "Value-engineering options"
  ],
  "complianceItems": [
    {
      "item": "Requirement description",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "scope|fabrication|erection|coating|coordination|submittals|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "specSection": "Section reference where clarification is needed (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "priority": "High|Medium|Low"
    }
  ]
}

THINK LIKE AN EXPERT ESTIMATOR:
- SYSTEMATICALLY SCAN THE SPEC using the COMPREHENSIVE FLAGGING CHECKLIST above (17 categories)
- Don't just list requirements - explain WHY they matter and HOW they impact cost with SPECIFIC details
- Look for SPECIFIC codes, standards, and technical requirements from the checklist (AISC 341, AISC 358, AWS D1.8, SSPC-SP6, ASTM A123, ASTM A780, etc.)
- Identify SPECIFIC technical processes from the checklist (demand critical welds, protected zones, SFRS, slip-critical bolts, DTIs, RBS, etc.)
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field", "provide as required")
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes
- Identify conflicts between sections that create ambiguity (and change orders)
- Identify missing information that will require RFIs and delay the project
- Think about what inexperienced estimators would miss - that's where the value is
- Provide ACTIONABLE recommendations: What line items to add, what allowances to carry, what exclusions to write
- Provide ACTUAL BID LANGUAGE for exclusions and clarifications
- Explain REAL-WORLD IMPLICATIONS: What happens if requirements aren't met? (e.g., "You'd need to sub out fabrication or painting or pass on the project")
- Identify what's NOT normal (e.g., "This is NOT a normal gravity-only steel job")
- FLAG ALL SCOPE SHIFT LANGUAGE from category 14 of the checklist
- IDENTIFY ALL CERTIFICATION REQUIREMENTS from category 3 of the checklist (these are dealbreakers)
- MAP COST IMPACTS using the cost indicators in the checklist (HIGH COST, MEDIUM COST, SCOPE BOMB, etc.)

MANDATORY SCANNING PROCESS:
1. Read through the entire spec systematically
2. For each section of the spec, check against the COMPREHENSIVE FLAGGING CHECKLIST
3. Flag EVERY item from the checklist that appears in the spec
4. Assign cost impact levels based on the checklist indicators
5. Identify scope risks, qualification gating, and hidden traps
6. Map findings to appropriate sections (Key Requirements, Cost Impact Table, Hidden Traps, RFIs, Exclusions)

For each finding, structure your response as:
1. SPECIFIC requirement (code/standard/process) - e.g., "AISC 341", "AWS D1.8", "Demand Critical Welds", "SSPC-SP6", "RBS flange cuts"
2. WHY it matters (real-world impact, e.g., "This is NOT a normal gravity-only steel job - expect 30-50% higher welding costs")
3. HOW it affects cost (specific: percentages, labor hours, dollar impacts, e.g., "adds 20% labor", "requires certified NDT technicians at $150/hr", "HIGH COST: Special flange cuts, tight tolerances")
4. WHAT the estimator should do (e.g., "Add seismic detailing / demand-critical weld cost line items (shop + field)", "Carry allowance for connection engineering + erection engineering", "Flag as qualification gating - shop must be AISC Certified BU")
5. BID STRATEGY (actual exclusion language, bid notes, clarifications, e.g., "Flag that all DC welds & protected zones must be clearly shown on structural drawings – if not, that's an RFI & risk", "Exclude: 'Provide as required' items for other trades")

Be thorough, specific, and actionable. Focus on items that impact cost, schedule, or liability. Your analysis should help an estimator avoid costly mistakes and protect profit margins. Think like you're protecting a business from losing money.

IMPORTANT: You MUST populate the "complianceItems" array with at least 20-25 items. Each item should represent a specific requirement, risk, or finding from the COMPREHENSIVE FLAGGING CHECKLIST that could impact cost or create problems. Include SPECIFIC technical details (codes, standards, processes) and ACTIONABLE recommendations. Think deeply - don't just skim the surface. Each compliance item should include the SPECIFIC code/standard/process, WHY it matters, and WHAT the estimator should do about it.`;

    // Miscellaneous Metals Analysis Prompt
    const miscPrompt = `You are an expert MISCELLANEOUS METALS estimator analyzing Division 05 (Miscellaneous Metals) specifications.

CRITICAL SCOPE: Focus ONLY on miscellaneous metals (lintels, frames, supports, shelf angles, bollards, embeds, posts, misc steel for MEP supports, ladders, roof access systems, canopies, bent plates, loose lintels, debris guards, safety rails, non-structural frames). DO NOT analyze structural steel (beams, columns, braces, frames, trusses) - that is a separate analysis type.

Perform a comprehensive, detailed analysis following these 9 critical areas:

1. MISCELLANEOUS METALS REQUIREMENTS ONLY
Extract and evaluate MISCELLANEOUS METALS ONLY:
- Metal fabrications: lintels, frames, supports, shelf angles, bollards, embeds, posts
- Misc steel for mechanical/electrical supports
- Ladder requirements
- Roof access systems
- Canopy steel
- Bent plates
- Loose lintels
- Debris guards / safety rails
- Non-structural frames or anchors

EXCLUDE: Structural steel members (beams, columns, braces, moment frames, braced frames, trusses, plate girders).

Analyze:
- Tightened fabrication tolerances for misc metals
- Required coatings (galvanized, powder coat, prime only) for misc metals
- Load requirements not shown in drawings for misc metals
- Field verification or measuring requirements for misc metals
- Who provides anchorages and fasteners for misc metals
- Installation by GC vs fabricator for misc metals

For every item, state the potential cost, coordination, and risk impact for MISCELLANEOUS METALS.

2. STAIRS, RAILS, & GUARDRAILS (MISCELLANEOUS METALS)
Extract ALL requirements for STAIRS, RAILS, & GUARDRAILS (these are misc metals, NOT structural steel):

Stairs:
- Stringer type (plate, channel, tube)
- Required dimensions or load ratings
- Tolerance requirements beyond AISC
- Field connection style (bolted, welded, hidden)
- Landing framing requirements
- Treads: Checker plate, bar grating, concrete-filled, formed pans
- Nosing or abrasive strip requirements
- ADA compliance

Handrails & Guardrails:
- Pipe/tube sizes
- Bending, miters, radius rails
- Weld grinding or seamless finish requirements
- ADA hand clearance, extensions, returns
- Stainless steel requirements
- Field welding or concealed fastener requirements
- Pickets: spacing, bar sizes, pattern restrictions
- Glass rail support details

Stairs/rails are HUGE labor traps; flag everything that increases finish or installation complexity.

3. ARCHITECTURAL METALS
Extract any mention of:
- AESS-level requirements (even if not labeled AESS)
- Architectural gates, canopies, feature stairs
- Exposed tubing or plate requiring seamless appearance
- Polished stainless
- Brushed finishes
- Painted finishes requiring:
  - sanding
  - priming
  - filling
  - smooth grinding

If the spec implies a "furniture-grade" finish, say so explicitly — it's a major cost increase.

4. DECKING REQUIREMENTS (MISCELLANEOUS METALS)
Extract and analyze DECKING requirements (decking is misc metals, NOT structural steel):
- Deck type: roof, floor, composite, form deck
- Gauge, finish, coating (galvanized, shop prime, uncoated)
- Side-lap fastening method (button punch, screws, welds, etc.)
- Perimeter closures
- Edge form requirements
- Shear studs:
  - who installs them
  - the count
  - spacing tolerance
  - welding requirements
- Damage repair requirements
- DIAPHRAGM requirements

Flag if:
- deck is to be left exposed
- deck requires fire rating treatment
- deck coating must be done before studs
- deck rib orientation is restricted

Decking specs often hide labor traps — pull them out clearly.

5. CONNECTION DESIGN REQUIREMENTS
Extract all mentions of connection responsibility:
- Fabricator-designed connections
- Engineer-of-record connection requirements
- Delegate engineer requirements
- Submittal requirements for calculations
- Required PE stamping (state or project-specific)
- Required incorporation of seismic/wind load requirements
- Rigid, moment, braced frame connection details
- Shear tab sizing requirements
- Bolt tensioning requirements
- Slip-critical vs snug-tight
- Weld procedure/qualification requirements
- Demand-critical welds
- Doubler plates or continuity plates

This is where lawsuit-level liability occurs. Flag anything unclear, missing, contradictory, or cost-impactful.

6. FIELD MEASURING & VERIFICATION
Extract ANY reference to:
- "Contractor shall field verify all dimensions"
- "Field measure prior to fabrication"
- "Installer responsible for ensuring fit"
- "Adjust as required for field conditions"
- "Provide templates for other trades"

These shift risk onto the fabricator; AI must highlight it.

7. SPECIAL MATERIALS
Search for:
- Stainless steel
- Aluminum
- Weathering steel
- Architectural bronze
- Perforated metals
- Expanded metals
- Wrought iron
- Custom alloys

Explain:
- finishing requirements
- welding restrictions
- galvanic corrosion considerations
- grinding/polishing labor impacts

8. CONFLICTS, MISSING INFO, & RISK ITEMS
Identify any conflicts between:
- Misc metals and structural steel
- Stairs and architectural drawings
- Decking and concrete specs
- Connection design and AISC norms
- Coating requirements between Div 05 & Div 09

Then list anything missing or unclear that requires RFI/clarification.

9. OUTPUT FORMAT
Respond with:
(A) Summary of Critical Findings - Plain language.
(B) Cost-Impact Table - Item, Requirement, Impact, Cost level (Low/Med/High)
(C) Hidden Scope Traps - List all.
(D) Missing/Conflicting Information
(E) Recommended Exclusions & Clarifications - Protect the fabricator.
(F) Final Risk Grade (A–F) - Overall exposure.

SPECIFICATION TO ANALYZE:
${specText}

${projectData ? `PROJECT DATA:\n${JSON.stringify(projectData, null, 2)}` : ''}

Return a comprehensive JSON object with the following structure:
{
  "summary": {
    "keyRequirements": "Clear overview of the most impactful spec provisions (Summary of Critical Findings)",
    "overallRiskGrade": "A, B, C, D, or F",
    "riskExposure": "Description of overall risk exposure"
  },
  "costImpactTable": [
    {
      "requirement": "Specific requirement found",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "impactExplanation": "How this affects cost, coordination, and risk",
      "costImpactLevel": "Low, Medium, or High"
    }
  ],
  "hiddenTraps": [
    "Bullet-form extraction of scope traps"
  ],
  "missingOrContradictory": [
    "List everything unclear or conflicting"
  ],
  "recommendedExclusions": [
    "Items to exclude from bid to protect the fabricator"
  ],
  "recommendedClarifications": [
    "RFI items to submit"
  ],
  "recommendedAlternates": [
    "Value-engineering options"
  ],
  "complianceItems": [
    {
      "item": "Requirement description",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "misc-metals|stairs-rails|architectural|decking|connections|field-verification|special-materials|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "specSection": "Section reference where clarification is needed (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "priority": "High|Medium|Low"
    }
  ]
}

THINK LIKE AN EXPERT ESTIMATOR:
- Stairs and rails are HUGE labor traps - analyze every detail that increases finish or installation complexity
- Decking specs hide labor traps - pull them out clearly
- Connection design liability can create lawsuits - flag everything unclear
- Field verification shifts risk - identify every instance
- Don't just list requirements - explain WHY they matter and HOW they impact cost
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field")
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes

Be thorough, specific, and actionable. Focus on items that impact cost, schedule, or liability. Your analysis should help an estimator avoid costly mistakes and protect profit margins.

IMPORTANT: You MUST populate the "complianceItems" array with at least 10-15 items. Each item should represent a specific requirement, risk, or finding that could impact cost or create problems. Think deeply - don't just skim the surface.`;

    // Division 09 Finishes Analysis Prompt
    const finishesPrompt = `You are an expert steel coating and finishing estimator analyzing Division 09 (Finishes) specifications. This division often silently overrides Division 05 coating requirements and creates hidden costs. Perform a comprehensive, detailed analysis following these 10 critical areas:

1. IDENTIFY ALL STEEL-RELATED COATING REQUIREMENTS
Extract every instance of:
- Paint systems on steel
- Primer requirements
- Touchup requirements
- Galvanized repair requirements (ASTM A780)
- Finish coat requirements
- Fireproofing-compatible coatings
- AESS paint systems
- Moisture-cure urethanes
- Epoxies
- Polyurethanes
- Zinc-rich primers (organic/inorganic)
- Multi-coat systems
- Powder-coating references
- VOC restrictions
- Environmental restrictions (temperature / humidity limits)

Explain labor impact for:
- surface prep
- dry time
- handling impact
- cure time before erection
- weather restrictions if field-applied

2. DETECT CONFLICTS BETWEEN DIVISION 05 AND DIVISION 09
Div 09 often overrides Div 05 silently.

Flag conflicts involving:
- prep level (SSPC-SP2 vs SP6 vs SP10)
- primer thickness (mils)
- finish system (single-coat vs 2/3 coat)
- color/appearance requirements
- AESS finish requirements
- shop vs field responsibility
- touchup vs full field painting
- compatibility notes ("primers incompatible with finish coat")

Explain which division takes precedence and how it impacts cost.

3. EXTRACT MULTI-COAT SYSTEM REQUIREMENTS
Identify:
- Primer type
- Intermediate coat type
- Finish coat type
- Total dry-film thickness (DFT) required
- Special testing requirements:
  - holiday testing
  - adhesion testing
  - thickness gauges (magnetic or ultrasonic)
  - color samples
- Cure time between coats

Flag ANY requirements that significantly increase cost.

4. SURFACE PREPARATION REQUIREMENTS
Extract and evaluate:
- SSPC prep levels
- Solvent cleaning requirements
- Blasting requirements (SP6, SP10)
- Hand-tool vs power-tool cleaning
- Required mil profile levels
- Requirements for removing:
  - rust
  - scale
  - wet storage stains
  - mill scale
  - oil contamination
  - weld spatter

Explain labor and equipment impact.

5. ENVIRONMENTAL & APPLICATION RESTRICTIONS
Extract ANY constraints such as:
- minimum temperature for painting
- maximum humidity
- surface temperature requirements
- dew-point requirements
- indoor booth-only restrictions
- ventilation requirements
- field work not allowed in rain or wind

Explain delays or sequencing impacts.

6. AESS COATING REQUIREMENTS
If AESS is included in the project:
- Identify AESS category (1–5)
- Extract finish-level requirements
- Note any:
  - visible grinding
  - smoothed welds
  - filled imperfections
  - high-performance finish coats
  - special color-matched finishes

Explain that AESS painting exponentially increases labor.

7. GALVANIZING & POWDER COAT REFERENCES
Extract requirements for:
- ASTM A123 galvanizing
- Powder coat type, mil thickness, color requirements
- Field touchup of galvanizing (ASTM A780)
- Duplex systems (galvanizing + paint)
- Compatibility testing for duplex coatings

These often create hidden problems and extra cost.

8. TOUCHUP & DAMAGE REPAIR REQUIREMENTS
Extract and analyze requirements for:
- field-applied touchup kits
- matching color and sheen
- field sanding
- re-priming
- compatibility between dissimilar coatings
- repair after bolting, welding, or cutting
- galvanizing repair rules
- repainting entire members after erection damage

This is where GC's often attempt to push unrealistic requirements onto steel.

9. COATING RESPONSIBILITY DIVISION
Identify:
- what the fabricator paints
- what the erector paints
- what the GC expects the steel contractor to paint
- what OTHER trades affect
- if touchup belongs to GC, painter, or steel

Flag ambiguities because they become change-order gold mines.

10. OUTPUT FORMAT
Respond with:
(A) Summary of Critical Findings - Plain-language summary of major painting/finishing burdens.
(B) Cost & Labor Impact Table - Item, Requirement, Impact explanation, Cost impact (Low/Med/High)
(C) Hidden Coating Traps - List scope risks and Div 05 vs Div 09 conflicts.
(D) Missing or Contradictory Information - List ambiguities requiring RFI.
(E) Recommended Exclusions & Clarifications - Protect the fabricator/erector from hidden coatings scope.
(F) Final Risk Assessment (A–F) - Overall exposure.

SPECIFICATION TO ANALYZE:
${specText}

${projectData ? `PROJECT DATA:\n${JSON.stringify(projectData, null, 2)}` : ''}

Return a comprehensive JSON object with the following structure:
{
  "summary": {
    "keyRequirements": "Clear overview of the most impactful coating/finishing provisions (Summary of Critical Findings)",
    "overallRiskGrade": "A, B, C, D, or F",
    "riskExposure": "Description of overall risk exposure"
  },
  "costImpactTable": [
    {
      "requirement": "Specific requirement found",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "impactExplanation": "How this affects cost, labor, and schedule",
      "costImpactLevel": "Low, Medium, or High"
    }
  ],
  "hiddenTraps": [
    "Bullet-form extraction of coating scope traps and Div 05 vs Div 09 conflicts"
  ],
  "missingOrContradictory": [
    "List everything unclear or conflicting"
  ],
  "recommendedExclusions": [
    "Items to exclude from bid to protect the fabricator/erector"
  ],
  "recommendedClarifications": [
    "RFI items to submit"
  ],
  "recommendedAlternates": [
    "Value-engineering options"
  ],
  "complianceItems": [
    {
      "item": "Requirement description",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "coating-system|multi-coat|surface-prep|environmental|aess|galvanizing|touchup|responsibility|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "specSection": "Section reference where clarification is needed (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "priority": "High|Medium|Low"
    }
  ]
}

THINK LIKE AN EXPERT ESTIMATOR:
- Div 05 vs Div 09 conflicts are change-order gold mines - identify every one
- Multi-coat systems sound simple but cost 3-5x single coat - explain the real cost impact
- Environmental restrictions delay work and cost money - think about sequencing
- Responsibility ambiguities create disputes - flag every one
- Don't just list requirements - explain WHY they matter and HOW they impact cost
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field")
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes

Be thorough, specific, and actionable. Focus on items that impact cost, schedule, or liability. Your analysis should help an estimator avoid costly mistakes and protect profit margins.

IMPORTANT: You MUST populate the "complianceItems" array with at least 10-15 items. Each item should represent a specific requirement, risk, or finding that could impact cost or create problems. Think deeply - don't just skim the surface.`;

    // AESS & NOMA Analysis Prompt
    const aessPrompt = `You are an expert AESS (Architecturally Exposed Structural Steel) and NOMA (Non-Ornamental Misc Metals) estimator analyzing construction specifications. AESS can exponentially increase costs, and requirements are often hidden across multiple divisions. Perform a comprehensive, detailed analysis following these 8 critical areas:

1. DETECT ALL AESS MENTIONS — EVEN ONE LINE
AESS is often hidden in:
- Division 05
- Division 09
- Architectural drawings
- General notes
- Renderings
- Structural notes ("these beams will be exposed")
- Schedules

Extract and identify:
- AESS category (1–5)
- Any hybrid categories (common on modern projects)
- Finish-level requirements ("smooth," "uniform appearance," "flush joints")
- Requirements not explicitly labeled as AESS but describing AESS-level finishes

If the spec describes AESS but does not name it, state:
"This is functionally AESS but mislabeled — major cost impact."

2. EXTRACT AESS CATEGORY REQUIREMENTS
Identify category-specific requirements:

AESS 1 – Basic:
- Visual uniformity
- Visible welds acceptable

AESS 2 – Feature Elements:
- Uniform weld appearance
- No welding spatter
- Grind flush where exposed

AESS 3 – Feature Grade:
- Welds ground smooth
- Hidden splices
- Smooth transitions
- TLC-level shop prep

AESS 4 – Showcase:
- Museum-grade
- Filled seams
- Rounded edges
- Perfect surfaces
- Full-grind, multi-coat finish

AESS 5 – Custom:
- Architect-specified, unlimited cost
- Match to sample mockup
- Hand-built quality levels

Flag which items apply and assess cost level for each.

3. IDENTIFY AESS PAINTING/COATING IMPACTS
AESS finish impacts:
- Primer type
- Surface profile
- Weld grinding
- Smoothing, filling, caulking
- Multiple coats (primer, intermediate, finish)
- Touchup procedures

Extract:
- DFT (dry film thickness)
- Color, sheen, gloss requirements
- VOC restrictions
- Whether samples/mockups are required
- Whether approval is architect, engineer, or owner

4. DETECT FABRICATION REQUIREMENTS HIDDEN IN AESS NOTES
Extract any requirement involving:
- Weld continuity
- Grinding flush
- Sanding, polishing, smoothing
- Hidden fasteners
- Concealed connections
- Tightened alignment tolerances
- Weld distortion control
- Non-standard material selection

Explain how each affects:
- labor
- cost
- QA/QC
- coating prep
- handling and shipping risk

5. IDENTIFY AESS ERECTION REQUIREMENTS
Extract:
- No visible bolts
- Concealed splice plates
- Field welds ground flush
- Seam alignment requirements
- Tolerance adjustments
- Visible field connections
- Field coating for show surfaces
- Handling restrictions ("no chain marks," "use cloth slings")

Explain coordination and erection labor impacts.

6. NOMA REQUIREMENTS (NON-ORNAMENTAL MISC METALS)
NOMA isn't a universal standard, so AI must interpret based on context.

Extract items related to:
- exposed stair stringers
- exposed ladder rails
- visible platforms
- visible guardrails
- exposed tube frames
- exterior steel elements that are not AESS but still architecturally sensitive

Flag if finish-level expectations exceed normal misc steel.

Examples:
- "uniform appearance"
- "no visible welds"
- "smooth surfaces"
- "clean corners"
- "tight fit and alignment"
- "prefinished surfaces"

Your AI must determine if NOMA → essentially low-level AESS.

7. DETECT AESS/NOMA CONFLICTS
Identify contradictions between:
- Div 05 fabrication
- Div 09 finishes
- AESS notes in drawings
- General conditions
- Connection design requirements
- Structural notes vs architectural notes

Explain which one should take precedence.

8. OUTPUT FORMAT
Output must include:
(A) AESS/NOMA Summary - Show all AESS areas and categories found.
(B) Finish-Level Table - Element, Required finish/appearance, Category, Cost impact
(C) Hidden Finish Traps - List all.
(D) Welding & Grinding Requirements Summary
(E) Coating Requirements Summary
(F) Erection & Handling Requirements Summary
(G) Conflicts & Missing Information
(H) Recommended Exclusions - Protect the estimator.
(I) Final Risk Grade (A–F) - Overall exposure.

SPECIFICATION TO ANALYZE:
${specText}

${projectData ? `PROJECT DATA:\n${JSON.stringify(projectData, null, 2)}` : ''}

Return a comprehensive JSON object with the following structure:
{
  "summary": {
    "keyRequirements": "AESS/NOMA Summary - Show all AESS areas and categories found",
    "overallRiskGrade": "A, B, C, D, or F",
    "riskExposure": "Description of overall risk exposure"
  },
  "finishLevelTable": [
    {
      "element": "Specific steel element (e.g., 'Main lobby beams', 'Stair stringers')",
      "requiredFinish": "Required finish/appearance description",
      "category": "AESS 1-5, NOMA, or Hybrid",
      "costImpact": "Low, Medium, or High"
    }
  ],
  "hiddenTraps": [
    "Bullet-form extraction of hidden finish traps and mislabeled AESS"
  ],
  "weldingGrindingRequirements": [
    "Summary of welding and grinding requirements"
  ],
  "coatingRequirements": [
    "Summary of coating requirements specific to AESS/NOMA"
  ],
  "erectionHandlingRequirements": [
    "Summary of erection and handling requirements"
  ],
  "missingOrContradictory": [
    "List everything unclear or conflicting"
  ],
  "recommendedExclusions": [
    "Items to exclude from bid to protect the estimator"
  ],
  "recommendedClarifications": [
    "RFI items to submit"
  ],
  "recommendedAlternates": [
    "Value-engineering options"
  ],
  "complianceItems": [
    {
      "item": "Requirement description",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "aess-category|noma|fabrication|welding|grinding|coating|erection|handling|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "specSection": "Section reference where clarification is needed (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "priority": "High|Medium|Low"
    }
  ]
}

Be thorough, specific, and actionable. Pay special attention to:
- Mislabeled AESS (functionally AESS but not named)
- Hidden AESS requirements across multiple divisions
- NOMA elements that require AESS-level finishes
- Fabrication requirements (welding, grinding, smoothing) that exponentially increase labor
- Erection and handling restrictions
- Conflicts between divisions that create ambiguity

THINK LIKE AN EXPERT ESTIMATOR:
- AESS can increase costs 3-10x - but WHERE and WHY? Explain the real cost drivers
- Mislabeled AESS is where fabricators get "bit" - find every instance
- Hidden AESS requirements across divisions create change orders - identify them
- NOMA elements requiring AESS-level finishes are traps - flag them
- Don't just list requirements - explain WHY they matter and HOW they impact cost
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field")
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes

AESS can increase costs by 3-10x normal steel. Flag every instance clearly and explain the real cost impact.

IMPORTANT: You MUST populate the "complianceItems" array with at least 10-15 items. Each item should represent a specific requirement, risk, or finding that could impact cost or create problems. Think deeply - don't just skim the surface.`;

    // Division 01 (General Requirements) Analysis Prompt
    const div01Prompt = `You are an expert construction estimator analyzing Division 01 (General Requirements) specifications. Division 01 often contains hidden costs, delegated design responsibilities, and coordination requirements that shift risk to the steel contractor. Perform a comprehensive, detailed analysis following these 7 critical areas:

1. IDENTIFY ALL SUBMITTAL REQUIREMENTS
Extract and analyze:
- Number of review cycles allowed
- Required submittal formats
- Required PE stamps
- Delegated design responsibilities
- Material samples or mockups
- Shop drawing content requirements
- Required coordination drawings
- BIM model requirements
- Required QA/QC documentation
- Required as-builts

Explain the labor and engineering impact of each.

2. DETECT DELEGATED DESIGN LANGUAGE
Flag ANY wording that shifts engineering responsibility to the fabricator:
- "Contractor shall design…"
- "Provide engineered connections…"
- "Provide stamped calculations…"
- "Provide shop-engineered supports…"
- "Design delegated to contractor…"

These are major cost items — AI must highlight them clearly.

3. IDENTIFY SCHEDULE & SEQUENCING RESTRICTIONS
Extract all references to:
- required milestones
- early steel packages
- long-lead notifications
- restricted work hours
- sequencing mandates
- site access limitations
- owner occupancy restrictions
- weather/temperature limitations
- required coordination with other trades
- required fit-up to non-steel components

Explain impacts on crane time, erection, or shop sequencing.

4. COORDINATION RESPONSIBILITIES
Extract language shifting coordination duties to steel contractor:
- field verification
- inter-trade alignment
- compatibility checks with MEP
- verifying dimensions before fabrication
- providing templates for other trades
- supplying layout, embed coordination, or field survey support
- coordinating attachments to concrete, wood, or CMU

Explain scope risk and recommend what should be excluded or clarified.

5. QA/QC AND INSPECTION REQUIREMENTS
Extract:
- 3rd-party inspection rules
- CWI presence
- Special inspections
- Hold points
- Testing requirements (UT/MT/RT, anchor bolt pull tests, etc.)
- Pre-installation conferences
- Pre-fabrication conferences

Highlight which ones increase cost or timeline.

6. TEMPORARY WORKS & SAFETY
Extract any requirements for:
- bracing
- shoring
- temporary supports
- safety barricades
- fall protection responsibility
- fire watch requirements
- site heating or lighting
- crane mats or ground protections

Explain who is responsible and what cost/risk is associated.

7. PAYMENT, WARRANTY, AND CLOSEOUT REQUIREMENTS
Extract:
- retained percentages
- extended warranties
- cleaning and touchup requirements
- turnover documents
- operation manuals
- project commissioning impacts

8. OUTPUT FORMAT
Respond with:
(A) Summary of Div 01 Impacts - Plain-language summary of major impacts.
(B) Cost & Schedule Impact Table - Item, Requirement, Impact explanation, Cost/Schedule impact (Low/Med/High)
(C) Hidden Traps - List all scope risks and delegated design items.
(D) Coordination & Responsibility Shifts - Detailed breakdown of coordination requirements and responsibility shifts.
(E) Missing or Conflicting Information - List ambiguities requiring RFI.
(F) Recommended Exclusions & Clarifications - Protect the contractor from hidden scope.
(G) Final Risk Grade (A–F) - Overall exposure.

SPECIFICATION TO ANALYZE:
${specText}

${projectData ? `PROJECT DATA:\n${JSON.stringify(projectData, null, 2)}` : ''}

Return a comprehensive JSON object with the following structure:
{
  "summary": {
    "keyRequirements": "Summary of Div 01 Impacts - Plain-language summary of major impacts",
    "overallRiskGrade": "A, B, C, D, or F",
    "riskExposure": "Description of overall risk exposure"
  },
  "costImpactTable": [
    {
      "requirement": "Specific requirement found",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "impactExplanation": "How this affects cost, schedule, and risk",
      "costImpactLevel": "Low, Medium, or High"
    }
  ],
  "hiddenTraps": [
    "Bullet-form extraction of scope risks, delegated design items, and hidden traps"
  ],
  "coordinationResponsibilityShifts": [
    "Detailed breakdown of coordination requirements and responsibility shifts"
  ],
  "missingOrContradictory": [
    "List everything unclear or conflicting"
  ],
  "recommendedExclusions": [
    "Items to exclude from bid to protect the contractor"
  ],
  "recommendedClarifications": [
    "RFI items to submit"
  ],
  "recommendedAlternates": [
    "Value-engineering options"
  ],
  "complianceItems": [
    {
      "item": "Requirement description",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "submittals|delegated-design|schedule|coordination|qa-qc|temporary-works|payment-warranty|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "specSection": "Section reference where clarification is needed (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "priority": "High|Medium|Low"
    }
  ]
}

Be thorough, specific, and actionable. Pay special attention to:
- Delegated design language that shifts engineering responsibility (major cost driver)
- Submittal requirements that increase engineering and administrative costs
- Schedule and sequencing restrictions that impact crane time and erection efficiency
- Coordination responsibilities that shift risk to the steel contractor
- QA/QC and inspection requirements that add cost and timeline
- Temporary works and safety requirements that may not be in the steel contractor's scope
- Payment terms, warranties, and closeout requirements that affect cash flow and risk

THINK LIKE AN EXPERT ESTIMATOR:
- Delegated design shifts engineering responsibility (and liability) - explain the real cost impact
- Submittal requirements increase engineering costs - think about review cycles and delays
- Schedule restrictions impact crane time - explain the sequencing and cost impact
- Coordination responsibilities shift risk - identify every instance
- Don't just list requirements - explain WHY they matter and HOW they impact cost
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field")
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes

Division 01 can contain hidden costs that significantly impact project profitability. Flag every instance clearly and explain the real cost impact.

IMPORTANT: You MUST populate the "complianceItems" array with at least 10-15 items. Each item should represent a specific requirement, risk, or finding that could impact cost or create problems. Think deeply - don't just skim the surface.`;

    // Division 03 (Concrete) Analysis Prompt
    const div03Prompt = `You are an expert construction estimator analyzing Division 03 (Concrete) specifications as they relate to steel fabrication and erection. Division 03 often contains requirements that shift anchor bolt, embed, and coordination responsibilities to the steel contractor. Perform a comprehensive, detailed analysis following these 8 critical areas:

1. IDENTIFY ANCHOR BOLT RESPONSIBILITIES
Extract all language involving:
- placement
- setting
- leveling
- alignment
- survey
- adjustment
- templates

Flag who is responsible:
- GC?
- Concrete?
- Steel fabricator?
- Steel erector?

If the spec is ambiguous, say so explicitly.

2. ANCHOR BOLT TOLERANCES
Extract:
- horizontal tolerances
- vertical tolerances
- projection tolerances
- embedment depth requirements
- leveling plate requirements
- hole/slot tolerances

Compare to AISC tolerances and flag conflicts.

3. EMBEDDED ITEMS / PLATES / ANGLES / SLEEVES
Extract requirements for:
- who furnishes
- who installs
- required coordination
- sleeve locations
- edge distances
- coordination with rebar
- adjustment tolerances

This is often where GCs try to push coordination liability onto steel.

4. GROUTING REQUIREMENTS
Extract:
- type of grout
- who furnishes
- who installs
- required curing times
- tolerance adjustments
- required non-shrink properties
- temperature/moisture restrictions

Flag if the spec expects steel to grout without compensation.

5. CONCRETE STRENGTH REQUIREMENTS AFFECTING STEEL
Extract:
- required cure times before steel may be erected
- required compressive strength prior to loading
- special mix requirements that limit early erection
- fly ash, SCC, or hot/cold weather mix notes that delay schedule

Explain how cure delays affect crane time or sequencing.

6. COORDINATION WITH OTHER TRADES
Extract any mention of:
- MEP embeds
- edge forms
- recesses needed for steel plates
- blockouts
- stair pockets
- slab depressions
- coordination for deck bearing surfaces

Identify anything requiring steel contractor coordination.

7. FIELD FIX REQUIREMENTS
Extract language implying:
- "adjust as required"
- "field drill"
- "slot holes as necessary"
- "fit in field"
- "coordinate with as-built conditions"

These are cost/time traps; AI must flag them.

8. CONCRETE FINISHES THAT AFFECT STEEL
Extract:
- slab flatness requirements for column lines
- elevation tolerances
- chamfering or edge modifications
- grinding/patching requirements
- moisture barriers interfering with plates or embeds

9. OUTPUT FORMAT
Respond with:
(A) Summary of Div 03 Issues - Plain-language summary of major impacts.
(B) Anchor Bolt & Embed Responsibility Table - Item, Requirement, Responsible Party, Cost impact
(C) Hidden Traps (high liability) - List all scope risks and field fix requirements.
(D) Tolerance Conflicts - Compare spec tolerances to AISC standards and flag conflicts.
(E) Coordination Requirements - Detailed breakdown of coordination requirements.
(F) Recommended Exclusions - Protect the contractor from hidden scope.
(G) RFI Recommendations - Items requiring clarification.
(H) Final Risk Assessment (A–F) - Overall exposure.

SPECIFICATION TO ANALYZE:
${specText}

${projectData ? `PROJECT DATA:\n${JSON.stringify(projectData, null, 2)}` : ''}

Return a comprehensive JSON object with the following structure:
{
  "summary": {
    "keyRequirements": "Summary of Div 03 Issues - Plain-language summary of major impacts",
    "overallRiskGrade": "A, B, C, D, or F",
    "riskExposure": "Description of overall risk exposure"
  },
  "anchorBoltResponsibilityTable": [
    {
      "item": "Specific item (e.g., 'Anchor bolt placement', 'Leveling plates')",
      "requirement": "Requirement description",
      "responsibleParty": "GC, Concrete, Steel Fabricator, Steel Erector, or Ambiguous",
      "costImpact": "Low, Medium, or High"
    }
  ],
  "toleranceConflicts": [
    "List of tolerance conflicts between spec and AISC standards"
  ],
  "hiddenTraps": [
    "Bullet-form extraction of scope risks, field fix requirements, and high liability items"
  ],
  "coordinationRequirements": [
    "Detailed breakdown of coordination requirements with concrete and other trades"
  ],
  "missingOrContradictory": [
    "List everything unclear or conflicting"
  ],
  "recommendedExclusions": [
    "Items to exclude from bid to protect the contractor"
  ],
  "recommendedClarifications": [
    "RFI items to submit"
  ],
  "recommendedAlternates": [
    "Value-engineering options"
  ],
  "complianceItems": [
    {
      "item": "Requirement description",
      "specSection": "Section reference (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "anchor-bolts|embeds|grouting|concrete-strength|coordination|field-fix|finishes|tolerances|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "specSection": "Section reference where clarification is needed (e.g., 'Part 2.7', 'Section 1.5.B.9')",
      "priority": "High|Medium|Low"
    }
  ]
}

Be thorough, specific, and actionable. Pay special attention to:
- Ambiguous anchor bolt responsibilities that shift risk to steel contractor
- Tolerance conflicts with AISC standards that create erection problems
- Embedded items coordination that GCs try to push onto steel
- Grouting requirements expected without compensation
- Concrete strength/cure requirements that delay erection and impact crane time
- Field fix language ("adjust as required", "field drill") that creates cost/time traps
- Coordination requirements with MEP, rebar, and other trades that increase liability

THINK LIKE AN EXPERT ESTIMATOR:
- Ambiguous anchor bolt responsibilities create disputes - explain the real cost impact
- Tolerance conflicts with AISC create erection problems - think about rework and delays
- Embedded items coordination shifts risk - identify every instance
- Grouting requirements expected without compensation are traps - flag them
- Concrete strength delays impact crane time - explain the sequencing and cost impact
- Field fix language creates cost/time traps - identify every instance
- Don't just list requirements - explain WHY they matter and HOW they impact cost
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field")
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes

Division 03 can contain hidden costs and liability shifts that significantly impact project profitability. Flag every instance clearly and explain the real cost impact.

IMPORTANT: You MUST populate the "complianceItems" array with at least 10-15 items. Each item should represent a specific requirement, risk, or finding that could impact cost or create problems. Think deeply - don't just skim the surface.`;

    // Select prompt based on analysis type
    let prompt: string;
    if (type === "misc") {
      prompt = miscPrompt;
    } else if (type === "finishes") {
      prompt = finishesPrompt;
    } else if (type === "aess") {
      prompt = aessPrompt;
    } else if (type === "div01") {
      prompt = div01Prompt;
    } else if (type === "div03") {
      prompt = div03Prompt;
    } else {
      prompt = structuralPrompt;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for more detailed analysis
      messages: [
        {
          role: "system",
          content:
            type === "misc"
              ? "You are a SENIOR MISCELLANEOUS METALS ESTIMATOR with 25+ years of experience. You think like a business owner protecting profit margins. You've seen how stairs, rails, and misc metals can destroy profit margins with hidden labor traps. Your analysis helps estimators avoid costly mistakes that less experienced estimators would miss. Don't just check boxes - think critically about cost drivers, hidden traps, and real-world implications."
              : type === "finishes"
              ? "You are a SENIOR COATING & FINISHES ESTIMATOR with 25+ years of experience. You think like a business owner protecting profit margins. You've seen how Division 09 can silently override Division 05 and destroy profit margins with hidden coating costs. Your analysis helps estimators avoid costly mistakes that less experienced estimators would miss. Don't just check boxes - think critically about cost drivers, hidden traps, and real-world implications."
              : type === "aess"
              ? "You are a SENIOR AESS & NOMA ESTIMATOR with 25+ years of experience. You think like a business owner protecting profit margins. You've seen how AESS can increase costs 3-10x and destroy profit margins. Your analysis helps estimators avoid costly mistakes that less experienced estimators would miss. Don't just check boxes - think critically about cost drivers, hidden traps, and real-world implications."
              : type === "div01"
              ? "You are a SENIOR CONSTRUCTION ESTIMATOR with 25+ years of experience. You think like a business owner protecting profit margins. You've seen how Division 01 can shift risk and destroy profit margins with hidden traps. Your analysis helps estimators avoid costly mistakes that less experienced estimators would miss. Don't just check boxes - think critically about cost drivers, hidden traps, and real-world implications."
              : type === "div03"
              ? "You are a SENIOR CONSTRUCTION ESTIMATOR with 25+ years of experience. You think like a business owner protecting profit margins. You've seen how Division 03 can shift anchor bolt, embed, and coordination responsibilities to steel contractors, destroying profit margins. Your analysis helps estimators avoid costly mistakes that less experienced estimators would miss. Don't just check boxes - think critically about cost drivers, hidden traps, and real-world implications."
              : "You are a SENIOR STRUCTURAL STEEL ESTIMATOR with 25+ years of experience. You think like a business owner protecting profit margins. You've seen projects go over budget, fabricators lose money, and contractors get burned by hidden traps. Your analysis helps estimators avoid costly mistakes that less experienced estimators would miss. Don't just check boxes - think critically about cost drivers, hidden traps, and real-world implications.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent, detailed analysis
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const tokens = completion.usage?.total_tokens || 0;
    const cost = calculateGPT4Cost(tokens, "gpt-4o");

    // Ensure complianceItems exists - if AI didn't generate it, create from other fields
    if (!result.complianceItems || result.complianceItems.length === 0) {
      result.complianceItems = [];
      
      // Generate from costImpactTable
      if (result.costImpactTable && Array.isArray(result.costImpactTable)) {
        result.complianceItems.push(...result.costImpactTable.map((item: any) => ({
          item: item.requirement || "Cost Impact Item",
          status: item.costImpactLevel === "High" ? "fail" : item.costImpactLevel === "Medium" ? "warning" : "pass",
          message: item.impactExplanation || "",
          category: "cost-impact"
        })));
      }
      
      // Generate from hiddenTraps
      if (result.hiddenTraps && Array.isArray(result.hiddenTraps)) {
        result.complianceItems.push(...result.hiddenTraps.map((trap: string) => ({
          item: "Hidden Scope Trap",
          status: "fail" as const,
          message: trap,
          category: "scope-trap"
        })));
      }
      
      // Generate from missingOrContradictory
      if (result.missingOrContradictory && Array.isArray(result.missingOrContradictory)) {
        result.complianceItems.push(...result.missingOrContradictory.map((item: string) => ({
          item: "Missing or Contradictory Information",
          status: "warning" as const,
          message: item,
          category: "missing-info"
        })));
      }
    }

    // Save analysis results to Firestore if projectId and companyId are provided
    if (companyId && projectId) {
      try {
        const { setDocument } = await import("@/lib/firebase/firestore");
        const { isFirebaseConfigured } = await import("@/lib/firebase/config");
        
        if (isFirebaseConfigured()) {
          const specReviewPath = `companies/${companyId}/projects/${projectId}/specReviews/${type}`;
          
          await setDocument(specReviewPath, {
            analysisType: type,
            result: result,
            specText: specText.substring(0, 1000), // Store first 1000 chars for reference
            analyzedAt: new Date().toISOString(),
            tokens,
            cost,
            version: 1,
          });

          // Also log usage
          const { logAIUsage } = await import("@/lib/openai/usageTracker");
          await logAIUsage(companyId, projectId, {
            type: "spec-review",
            analysisType: type,
            tokens,
            cost,
            input: specText.substring(0, 500), // Store first 500 chars
            output: JSON.stringify(result).substring(0, 1000), // Store first 1000 chars
          });
        }
      } catch (error) {
        console.error("Failed to save spec review to Firestore:", error);
        // Don't fail the request if saving fails
      }
    }

    return NextResponse.json({
      ...result,
      tokens,
      cost,
    });
  } catch (error: any) {
    console.error("Spec review error:", error);
    return NextResponse.json(
      { error: error.message || "Spec review failed" },
      { status: 500 }
    );
  }
}

