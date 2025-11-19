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

    const { specText, projectData, analysisType = "structural" } = await request.json();
    
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

CRITICAL SCOPE: Focus ONLY on structural steel elements (beams, columns, braces, moment frames, braced frames, trusses, plate girders, built-up members). DO NOT analyze miscellaneous metals, stairs, rails, decking, or architectural metals - those are separate analysis types.

Perform a comprehensive, detailed analysis following these 10 critical areas:

1. IDENTIFY STRUCTURAL STEEL SCOPE REQUIREMENTS
Extract every requirement related to STRUCTURAL STEEL ONLY:
- Structural steel members (beams, columns, braces, trusses, plate girders)
- Moment frames and braced frames
- Structural connections (bolted, welded)
- Fabrication & shop processes for structural steel
- Erection & field work for structural steel
- Structural steel coatings, primers, and touch-up
- Submittals and PE-stamped calculations for structural steel
- Structural steel galvanizing (if specified)

EXCLUDE: Miscellaneous metals, stairs, rails, decking, architectural metals, AESS (unless specifically structural), and non-structural elements.

CRITICAL THINKING: Don't just list requirements - think about:
- What sounds simple but actually requires expensive processes?
- What will cause rework or delays in the shop or field?
- What coordination issues will create problems?
- What's missing that will bite us later?
- What requirements seem standard but have hidden costs?

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
Look for STRUCTURAL STEEL SPECIFIC requirements:
- Tightened fabrication tolerances beyond AISC for structural steel
- Camber requirements or restrictions for structural steel beams/girders
- Weld grinding, smoothing, blending for structural steel (NOT AESS finish requirements)
- Prohibited welding processes (SMAW-only, no FCAW) for structural steel
- UT, MT, RT frequency and acceptance criteria for structural steel welds
- Slip-critical vs. snug-tight bolting for structural steel connections
- Bolt types (A325, A490, galvanized, tensioned, etc.) for structural steel
- Requirements for mockups or sample fabrication of structural steel

EXCLUDE: AESS finish requirements, architectural metal finishes, stair/rail fabrication details.

For every item, explain how it affects STRUCTURAL STEEL cost.

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
Identify STRUCTURAL STEEL SPECIFIC requirements:
- SSPC/MPI surface prep levels for structural steel
- Blast requirements for structural steel
- Stripe coating for structural steel
- 2-coat or 3-coat systems for structural steel
- VOC restrictions for structural steel coatings
- Field touchup requirements for structural steel
- Galvanized repair requirements (ASTM A780) for structural steel
- Moisture cure, zinc-rich, or specialty coatings for structural steel

EXCLUDE: AESS finish levels (analyze separately), architectural metal finishes, Division 09 paint requirements (analyze separately).

Explain how each one changes labor or materials for STRUCTURAL STEEL.

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

Highlight ambiguities that could cause dispute later for STRUCTURAL STEEL.

7. STRUCTURAL STEEL SUBMITTALS, APPROVALS, AND ENGINEERING
Extract requirements for STRUCTURAL STEEL:
- PE-stamped calculations for structural steel
- Structural steel connection design
- Temporary bracing/shoring design for structural steel
- Welding procedures (WPS/PQR) for structural steel
- Number of review cycles for structural steel submittals
- Submittal timeline for structural steel
- Structural steel shop drawings

EXCLUDE: Misc metals submittals, stair/rail submittals, decking submittals.

Identify any engineering requirements not included on structural steel drawings.

8. CONFLICTS BETWEEN SECTIONS (STRUCTURAL STEEL FOCUS)
Detect conflicts affecting STRUCTURAL STEEL:
- Division 03 (Concrete) and Division 05 structural steel requirements
- Division 05 structural steel and Division 09 (Finishes) for structural steel
- Structural steel spec vs. Drawings
- Structural steel spec vs. AISC code defaults
- Structural steel erection tolerances vs. fabrication tolerances

EXCLUDE: Conflicts related to misc metals, stairs, rails, or decking.

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
Provide STRUCTURAL STEEL SPECIFIC:
- Major cost risks for structural steel
- Scope ambiguities for structural steel
- Coordination pitfalls for structural steel
- High-effort or high-risk structural steel items
- Recommended exclusions to protect the structural steel contractor
- Recommended clarifications to submit in RFI form for structural steel
- Recommended alternates or value-engineering options for structural steel

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
      "impactExplanation": "How this affects cost",
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
    "Items to exclude from bid"
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
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "scope|fabrication|erection|coating|coordination|submittals|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
      "priority": "High|Medium|Low"
    }
  ]
}

THINK LIKE AN EXPERT ESTIMATOR:
- Don't just list requirements - explain WHY they matter and HOW they impact cost
- Look for the subtle language that shifts risk ("as required", "coordinate with", "verify in field")
- Identify requirements that sound simple but require expensive processes
- Think about sequencing - what has to happen first, what blocks other work?
- Consider what happens when things go wrong - rework, delays, disputes
- Look for conflicts between sections that create ambiguity (and change orders)
- Identify missing information that will require RFIs and delay the project
- Think about what inexperienced estimators would miss - that's where the value is

Be thorough, specific, and actionable. Focus on items that impact cost, schedule, or liability. Your analysis should help an estimator avoid costly mistakes and protect profit margins.

IMPORTANT: You MUST populate the "complianceItems" array with at least 10-15 items. Each item should represent a specific requirement, risk, or finding that could impact cost or create problems. Think deeply - don't just skim the surface.`;

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
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "misc-metals|stairs-rails|architectural|decking|connections|field-verification|special-materials|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
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
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "coating-system|multi-coat|surface-prep|environmental|aess|galvanizing|touchup|responsibility|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
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
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "aess-category|noma|fabrication|welding|grinding|coating|erection|handling|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
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
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "submittals|delegated-design|schedule|coordination|qa-qc|temporary-works|payment-warranty|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
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
      "status": "pass|warning|fail",
      "message": "Detailed explanation",
      "category": "anchor-bolts|embeds|grouting|concrete-strength|coordination|field-fix|finishes|tolerances|conflicts|missing|risk"
    }
  ],
  "rfiSuggestions": [
    {
      "title": "RFI title",
      "description": "Detailed RFI description",
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

    // TODO: Log usage (need companyId and projectId from request)
    // await logAIUsage(companyId, projectId, {
    //   type: "spec-review",
    //   tokens,
    //   cost,
    //   input: specText,
    //   output: JSON.stringify(result),
    // });

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

