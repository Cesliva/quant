import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { calculateGPT4Cost } from "@/lib/openai/usageTracker";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface EstimatingLine {
  lineId?: string;
  itemDescription?: string;
  category?: string;
  subCategory?: string;
  materialType?: "Rolled" | "Plate";
  shapeType?: string;
  sizeDesignation?: string;
  grade?: string;
  qty?: number;
  lengthFt?: number;
  lengthIn?: number;
  thickness?: number;
  width?: number;
  plateLength?: number;
  plateQty?: number;
  plateGrade?: string;
  coatingSystem?: string;
  laborUnload?: number;
  laborCut?: number;
  laborCope?: number;
  laborProcessPlate?: number;
  laborDrillPunch?: number;
  laborFit?: number;
  laborWeld?: number;
  laborPrepClean?: number;
  laborPaint?: number;
  laborHandleMove?: number;
  laborLoadShip?: number;
  drawingNumber?: string;
  detailNumber?: string;
  notes?: string;
}

interface VoiceAgentResponse {
  action: "create" | "update" | "delete" | "query" | "copy" | "conversation" | "unknown";
  lineId?: string;
  data?: Partial<EstimatingLine>;
  message: string;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Voice agent API called ===");
    console.log("OpenAI initialized:", !!openai);
    console.log("API key exists:", !!process.env.OPENAI_API_KEY);
    
    if (!openai) {
      console.error("OpenAI not initialized - API key missing");
      const errorMsg = process.env.OPENAI_API_KEY 
        ? "OpenAI API key is set but OpenAI client failed to initialize"
        : "OpenAI API key not configured in environment variables";
      return NextResponse.json(
        { 
          error: errorMsg,
          message: errorMsg,
          action: "unknown",
          confidence: 0
        },
        { status: 500 }
      );
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError: any) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { 
          error: "Invalid request body",
          message: parseError.message,
          action: "unknown",
          confidence: 0
        },
        { status: 400 }
      );
    }

    const { 
      userMessage, 
      existingLines = [], 
      conversationHistory = [],
      trainingContext = "" // Speech training context
    } = requestBody;

    console.log("Received request:", { 
      userMessage, 
      existingLinesCount: existingLines?.length || 0,
      conversationHistoryLength: conversationHistory?.length || 0
    });

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { 
          error: "User message is required and must be a string",
          message: "User message is required and must be a string",
          action: "unknown",
          confidence: 0
        },
        { status: 400 }
      );
    }

    // Build context about existing lines
    const linesContext = existingLines?.length > 0
      ? `\n\nExisting lines:\n${existingLines.map((line: any) => 
          `- ${line.lineId || 'N/A'}: ${line.itemDescription || 'No description'} | ${line.sizeDesignation || 'No size'} | Qty: ${line.qty || 0}`
        ).join('\n')}`
      : "\n\nNo existing lines yet.";

    const systemPrompt = `You are Quant, a friendly and conversational AI assistant for a steel fabrication estimating system. You interact like ChatGPT - naturally, engagingly, and conversationally.

${trainingContext}${trainingContext ? "\n" : ""} 

🎯 WORKFLOW UNDERSTANDING (CRITICAL):
1. User says "add new line" → You create a BLANK line immediately (L1, L2, L3, etc.)
2. User then speaks data in "field name, value" format → You accumulate this data
3. User says "enter" → You show confirmation and wait for "yes"
4. User says "yes" → You execute the action and save data to database
5. After saving, the line is NO LONGER BLANK - it has data in it

When user confirms with "yes", the data HAS BEEN ENTERED. Do NOT ask if they want to fill in details - the data is already there.

⚠️ CRITICAL PARSING RULE - READ THIS FIRST ⚠️
When users speak in "field name, value" format (especially with commas), ALWAYS interpret it as:
- FIRST WORD/PHRASE = FIELD NAME (column header)
- SECOND WORD/PHRASE = VALUE to put in that field

Examples:
- "item, column" → itemDescription="Column" (NOT category="Columns")
- "item column" → itemDescription="Column" (NOT category="Columns")
- "category, beams" → category="Beams"
- "type, wide flange" → shapeType="W"
- "spec, W12x24" → sizeDesignation="W12x24"
- "quantity, 5" → qty=5

When you see "item, column" or "item column", the user is saying:
"Put the value 'column' into the field named 'item'"

DO NOT interpret "item, column" as asking "what type of item is it?" or "what category?"
DO NOT confuse "item" (field name) with "category" (different field)
"item" always refers to the itemDescription field, and "column" is the VALUE for that field.

CONVERSATIONAL STYLE:
- Be natural and conversational, like chatting with a friend
- Ask clarifying questions when needed
- Engage in back-and-forth dialogue
- Show personality and be friendly
- Don't be robotic - be human-like
- Have extended conversations before executing actions if needed
- Respond to questions, comments, and casual conversation
- Make the estimator feel comfortable and heard

IMPORTANT CONVERSATION FLOW:
1. Engage naturally - respond to questions, comments, and conversation
2. Ask clarifying questions when information is unclear
3. Have a dialogue - don't just execute commands immediately
4. When ready to execute, confirm: "Would you like me to enter this data?"
5. Be friendly and conversational, like talking to a colleague

Your job is to understand natural language commands and use the provided functions to perform actions on estimating lines.

UNDERSTANDING THE GRID STRUCTURE:
You are working with a data grid/spreadsheet where:
- Each ROW is an estimating line (L1, L2, L3, etc.)
- Each COLUMN is a field/attribute (Item, Category, Type, Spec, Grade, Qty, Length, etc.)

FIELD NAME, VALUE PATTERN (MOST COMMON):
Users frequently speak in "field name, value" pairs. When you see this pattern, ALWAYS parse it as:
- FIRST WORD = FIELD NAME (the column header)
- SECOND WORD(S) = VALUE (what to put in that field)

Examples with commas (explicit separator):
- "item, column" → itemDescription="Column" ⚠️ NOT category="Columns"
- "category, beams" → category="Beams"
- "type, wide flange" → shapeType="W"
- "spec, W12x24" → sizeDesignation="W12x24"
- "quantity, 5" → qty=5

Examples without commas (space-separated):
- "item column" → itemDescription="Column" ⚠️ NOT category="Columns"
- "category beams" → category="Beams"
- "type wide flange" → shapeType="W"
- "spec W12x24" → sizeDesignation="W12x24"
- "quantity 5" → qty=5

RULE: The first word/phrase is the COLUMN HEADER/FIELD NAME, and everything after it is the VALUE to put in that field.

When the user asks you to:
- CREATE: Use create_estimating_line function
- UPDATE: Use update_estimating_line function  
- DELETE: Use delete_estimating_line function
- COPY/DUPLICATE: Use copy_estimating_line function
- QUERY: Use query_estimating_lines function to get information, then respond naturally

IMPORTANT: Users may speak data in any order. Extract all information from their command and map it to the correct fields, regardless of the order spoken. When users say "item column", recognize that "item" is the field name and "column" is the value.

Line ID formats: "L3", "line 3", "line id 3", "line number 3", "number 3", "item 3"

Delete command examples:
- "Delete line 3" → delete_estimating_line(lineId: "L3")
- "Remove L5" → delete_estimating_line(lineId: "L5")
- "Get rid of line number 2" → delete_estimating_line(lineId: "L2")
- "Delete the column on line 4" → delete_estimating_line(lineId: "L4")
- "Remove item 3" → delete_estimating_line(lineId: "L3")

Copy/Duplicate command examples:
- "Copy line 1" → copy_estimating_line(sourceLineId: "L1") - will create L1-L10 (or next available)
- "Duplicate L3" → copy_estimating_line(sourceLineId: "L3")
- "Copy line 1 to line 10" → copy_estimating_line(sourceLineId: "L1", targetLineId: "L10") - creates L1-L10
- "Clone line 5" → copy_estimating_line(sourceLineId: "L5")
- "Copy L2 to L15" → copy_estimating_line(sourceLineId: "L2", targetLineId: "L15") - creates L2-L15

Line ID format for copies: "L1-L10" means copy of L1 at location L10. When sorted, all copies of L1 will group together.

FIELD MAPPINGS (Column Headers → Database Fields):
When users say the column header name followed by a value, map it like this:

- "Item" or "Description" → itemDescription field
  Example: "item column" → itemDescription="Column"
  Example: "item beam" → itemDescription="Beam"
  Example: "description base plate" → itemDescription="Base Plate"

- "Category" → category field (Columns, Beams, Misc Metals, Plates)
  Example: "category columns" → category="Columns"
  Example: "category beams" → category="Beams"

- "Sub-Category" or "Sub Category" → subCategory field
  Example: "sub category base plate" → subCategory="Base Plate"

- "Type" or "Shape" → shapeType field (W, HSS, C, L, T)
  Example: "type wide flange" → shapeType="W"
  Example: "shape HSS" → shapeType="HSS"
  Example: "type W" → shapeType="W"

- "Spec" or "Size" → sizeDesignation field
  Example: "spec W12x24" → sizeDesignation="W12x24"
  Example: "size HSS 6x6x1/4" → sizeDesignation="HSS 6x6x1/4"

- "Grade" → grade field
  Example: "grade A992" → grade="A992"

- "Quantity" or "Qty" → qty field
  Example: "quantity 5" → qty=5
  Example: "qty 3" → qty=3

- "Length" or "Feet" → lengthFt field
  Example: "length 20 feet" → lengthFt=20
  Example: "20 feet" → lengthFt=20

- "Inches" → lengthIn field
  Example: "6 inches" → lengthIn=6

- "Drawing Number" or "Drawing" → drawingNumber field
  Example: "drawing D-101" → drawingNumber="D-101"

- "Detail Number" or "Detail" → detailNumber field
  Example: "detail D1" → detailNumber="D1"

- "Notes" → notes field
  Example: "notes install after concrete" → notes="install after concrete"

- "Hashtags" or "Tags" → hashtags field
  Example: "hashtags phase1 critical" → hashtags="#phase1 #critical"

Labor fields (all in hours):
- Unload: laborUnload
- Cut: laborCut
- Cope: laborCope
- Process Plate: laborProcessPlate
- Drill/Punch: laborDrillPunch
- Fit: laborFit
- Weld: laborWeld
- Prep/Clean: laborPrepClean
- Paint: laborPaint
- Handle/Move: laborHandleMove
- Load/Ship: laborLoadShip

Plate-specific fields (when materialType = "Plate"):
- Thickness: thickness (inches)
- Width: width (inches)
- Plate Length: plateLength (inches)
- Plate Quantity: plateQty
- Plate Grade: plateGrade (A36, A572 Gr50, etc.)
- One Side Coat: oneSideCoat (boolean)

Coating:
- Coating System: coatingSystem (None, Paint, Powder, Galv)

Material Rates (optional overrides):
- Material Rate: materialRate ($/lb)
- Labor Rate: laborRate ($/hr)
- Coating Rate: coatingRate

Material types:
- "Rolled" for shapes like W, HSS, C, L, T
- "Plate" for plate materials

Shape type mappings:
- "Wide Flange", "W shape", "W" → "W"
- "HSS", "Tube", "Hollow Structural Section" → "HSS"
- "Channel", "C shape", "C" → "C"
- "Angle", "L shape", "L" → "L"
- "Tee", "T shape", "T" → "T"

CRITICAL: Data can be spoken in ANY ORDER. Extract ALL information from the user's command and map to correct fields:

Natural language examples:
- "Add a column, 5 pieces, W12x24, 20 feet" → itemDescription="Column", qty=5, sizeDesignation="W12x24", lengthFt=20
- "Welding 2 hours, column W12x24, 5 pieces" → itemDescription="Column", shapeType="W", sizeDesignation="W12X24", qty=5, laborWeld=2
- "Update line 3, change to 6 pieces, add 2 hours welding" → Update L3: qty=6, laborWeld=2
- "W12x24, 5 pieces, column, 20 feet, grade A992, welding 2 hours" → Extract all fields regardless of order

Structured "field name, value" examples (CRITICAL - users often speak this way):
⚠️ WITH COMMAS (most explicit):
- "item, column" → itemDescription="Column" ⚠️ NOT category="Columns"
- "item, beam" → itemDescription="Beam"
- "category, columns" → category="Columns"
- "type, wide flange" → shapeType="W"
- "spec, W12x24" → sizeDesignation="W12x24"
- "quantity, 5" → qty=5
- "length, 20 feet" → lengthFt=20
- "item, column, type, wide flange, spec, W12x24, quantity, 5, length, 20 feet" → All fields extracted correctly

⚠️ WITHOUT COMMAS (space-separated):
- "item column" → itemDescription="Column" ⚠️ NOT category="Columns"
- "item beam" → itemDescription="Beam"
- "category columns" → category="Columns"
- "type wide flange" → shapeType="W"
- "spec W12x24" → sizeDesignation="W12x24"
- "quantity 5" → qty=5
- "length 20 feet" → lengthFt=20

⚠️ CRITICAL REMINDER: When users say "item, column" or "item column", they are NOT asking "what type of item is it?" They are saying: "Put the value 'column' into the field named 'item'". Always interpret the first word as the field name and the following word(s) as the value. "item" is a FIELD NAME, not a question.

Time/labor parsing (convert to hours):
- "2 hours" = 2
- "2 hrs" = 2
- "1.5 hours" = 1.5
- "90 minutes" = 1.5
- "30 minutes" = 0.5
- "15 min" = 0.25
- "1 hour 30 minutes" = 1.5
- "1 hr 15 min" = 1.25

Length parsing:
- "20 feet" = lengthFt: 20
- "20 ft" = lengthFt: 20
- "20'" = lengthFt: 20
- "6 inches" = lengthIn: 6
- "6 in" = lengthIn: 6
- "6\"" = lengthIn: 6
- "20 feet 6 inches" = lengthFt: 20, lengthIn: 6
- "20' 6\"" = lengthFt: 20, lengthIn: 6

CONVERSATIONAL MODE:
- You can have natural conversations - not every message needs to trigger an action
- Ask questions to clarify: "How many pieces do you need?" or "What size should that be?"
- Respond to casual conversation: "How's your day?" → "Great! Ready to help you estimate."
- Engage in dialogue before executing: "Tell me more about that column" or "What grade material?"
- Be helpful and friendly - make the estimator feel comfortable
- When you have enough information, THEN use the functions to execute actions

Always be conversational and natural. Use functions when ready to execute actions, but feel free to have extended dialogue first. Extract ALL information from the user's command, even if spoken out of order.`;

    const userPrompt = `${userMessage}${linesContext}`;

    console.log("Calling OpenAI API...");
    console.log("User prompt length:", userPrompt.length);
    console.log("System prompt length:", systemPrompt.length);
    console.log("User message:", userMessage);
    
    // Define functions/tools for the AI agent
    const tools = [
        {
          type: "function" as const,
          function: {
            name: "create_estimating_line",
            description: "Create a new estimating line item. Use this when the user wants to add a new line.",
            parameters: {
              type: "object",
              properties: {
                lineId: {
                  type: "string",
                  description: "Line ID (e.g., 'L3', 'L4'). If not provided, will be auto-generated."
                },
                itemDescription: {
                  type: "string",
                  description: "Item description field. CRITICAL: When user says 'item, column' or 'item column', this means: put 'Column' in the itemDescription field. The word 'item' is the FIELD NAME, and 'column' is the VALUE. Examples: 'item, column' → itemDescription='Column', 'item, beam' → itemDescription='Beam', 'item, base plate' → itemDescription='Base Plate'. DO NOT confuse this with category field."
                },
                category: {
                  type: "string",
                  enum: ["Columns", "Beams", "Misc Metals", "Plates"],
                  description: "Category of the item"
                },
                subCategory: {
                  type: "string",
                  description: "Sub-category (e.g., 'Base Plate', 'Gusset', 'Stiffener')"
                },
                materialType: {
                  type: "string",
                  enum: ["Rolled", "Plate"],
                  description: "Material type - 'Rolled' for shapes (W, HSS, C, L, T), 'Plate' for plates"
                },
                shapeType: {
                  type: "string",
                  description: "Shape type: W, HSS, C, L, T (only for Rolled materials)"
                },
                sizeDesignation: {
                  type: "string",
                  description: "Size designation (e.g., 'W12X14', 'HSS 6x6x1/4', 'PL 1/2')"
                },
                grade: {
                  type: "string",
                  description: "Material grade (e.g., 'A992', 'A572 Gr50', 'A36')"
                },
                qty: {
                  type: "number",
                  description: "Quantity"
                },
                lengthFt: {
                  type: "number",
                  description: "Length in feet"
                },
                lengthIn: {
                  type: "number",
                  description: "Length in inches (additional to feet)"
                },
                thickness: {
                  type: "number",
                  description: "Thickness in inches (for plates)"
                },
                width: {
                  type: "number",
                  description: "Width in inches (for plates)"
                },
                plateLength: {
                  type: "number",
                  description: "Plate length in inches (for plates)"
                },
                plateQty: {
                  type: "number",
                  description: "Plate quantity (for plates)"
                },
                plateGrade: {
                  type: "string",
                  description: "Plate grade (e.g., 'A36', 'A572 Gr50') - for plates"
                },
                oneSideCoat: {
                  type: "boolean",
                  description: "One side coat only (for plates)"
                },
                // All labor fields
                laborUnload: {
                  type: "number",
                  description: "Unloading labor hours"
                },
                laborCut: {
                  type: "number",
                  description: "Cutting labor hours"
                },
                laborCope: {
                  type: "number",
                  description: "Coping labor hours"
                },
                laborProcessPlate: {
                  type: "number",
                  description: "Plate processing labor hours"
                },
                laborDrillPunch: {
                  type: "number",
                  description: "Drilling/punching labor hours"
                },
                laborFit: {
                  type: "number",
                  description: "Fitting labor hours"
                },
                laborWeld: {
                  type: "number",
                  description: "Welding labor hours"
                },
                laborPrepClean: {
                  type: "number",
                  description: "Prep and cleaning labor hours"
                },
                laborPaint: {
                  type: "number",
                  description: "Painting labor hours"
                },
                laborHandleMove: {
                  type: "number",
                  description: "Handling/moving labor hours"
                },
                laborLoadShip: {
                  type: "number",
                  description: "Loading and shipping labor hours"
                },
                // Identification fields
                drawingNumber: {
                  type: "string",
                  description: "Drawing number (e.g., 'D-101', 'S-205')"
                },
                detailNumber: {
                  type: "string",
                  description: "Detail number (e.g., 'D1', 'D2')"
                },
                notes: {
                  type: "string",
                  description: "Additional notes or comments"
                },
                hashtags: {
                  type: "string",
                  description: "Hashtags for organization (e.g., '#phase1 #critical')"
                },
                // Coating
                coatingSystem: {
                  type: "string",
                  enum: ["None", "Paint", "Powder", "Galv"],
                  description: "Coating system type"
                },
                // Material rates (optional overrides)
                materialRate: {
                  type: "number",
                  description: "Material rate in $/lb (overrides default)"
                },
                laborRate: {
                  type: "number",
                  description: "Labor rate in $/hr (overrides default)"
                },
                coatingRate: {
                  type: "number",
                  description: "Coating rate (overrides default)"
                }
              },
              required: []
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "update_estimating_line",
            description: "Update an existing estimating line. Use this when the user wants to modify a line.",
            parameters: {
              type: "object",
              properties: {
                lineId: {
                  type: "string",
                  description: "Line ID to update (e.g., 'L3', 'L4')"
                },
                itemDescription: { type: "string" },
                category: { type: "string", enum: ["Columns", "Beams", "Misc Metals", "Plates"] },
                subCategory: { type: "string" },
                materialType: { type: "string", enum: ["Rolled", "Plate"] },
                shapeType: { type: "string" },
                sizeDesignation: { type: "string" },
                grade: { type: "string" },
                qty: { type: "number" },
                lengthFt: { type: "number" },
                lengthIn: { type: "number" },
                thickness: { type: "number" },
                width: { type: "number" },
                plateLength: { type: "number" },
                plateQty: { type: "number" },
                plateGrade: { type: "string" },
                oneSideCoat: { type: "boolean" },
                // All labor fields
                laborUnload: { type: "number" },
                laborCut: { type: "number" },
                laborCope: { type: "number" },
                laborProcessPlate: { type: "number" },
                laborDrillPunch: { type: "number" },
                laborFit: { type: "number" },
                laborWeld: { type: "number" },
                laborPrepClean: { type: "number" },
                laborPaint: { type: "number" },
                laborHandleMove: { type: "number" },
                laborLoadShip: { type: "number" },
                // Identification fields
                drawingNumber: { type: "string" },
                detailNumber: { type: "string" },
                notes: { type: "string" },
                hashtags: { type: "string" },
                // Coating
                coatingSystem: { type: "string", enum: ["None", "Paint", "Powder", "Galv"] },
                // Material rates
                materialRate: { type: "number" },
                laborRate: { type: "number" },
                coatingRate: { type: "number" }
              },
              required: ["lineId"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "delete_estimating_line",
            description: "Delete an estimating line. Use this when the user wants to remove, delete, or get rid of a line. Understand variations like 'delete line 3', 'remove L5', 'get rid of line number 2', 'delete the column on line 4', 'remove item 3'. Extract the line ID from phrases like 'line 3', 'L3', 'line number 3', 'number 3', 'item 3' and convert to 'L3' format.",
            parameters: {
              type: "object",
              properties: {
                lineId: {
                  type: "string",
                  description: "Line ID to delete. Extract from phrases like 'line 3', 'L3', 'line number 3', 'number 3', 'item 3'. Always convert to 'L3' format (e.g., 'line 3' → 'L3', 'number 5' → 'L5')."
                }
              },
              required: ["lineId"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "query_estimating_lines",
            description: "Query or search estimating lines. Use this when the user asks about existing lines.",
            parameters: {
              type: "object",
              properties: {
                lineId: {
                  type: "string",
                  description: "Specific line ID to query (e.g., 'L3')"
                },
                category: {
                  type: "string",
                  enum: ["Columns", "Beams", "Misc Metals", "Plates"],
                  description: "Filter by category"
                },
                searchTerm: {
                  type: "string",
                  description: "Search term to find matching lines"
                }
              },
              required: []
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "copy_estimating_line",
            description: "Copy or duplicate an existing estimating line. Use this when the user wants to copy, duplicate, or clone a line. The copied line will have a new line ID in the format 'originalLineId-newLocationId' (e.g., 'L1-L10' means copy of L1 at location L10). If no location is specified, use the next available sequential line ID.",
            parameters: {
              type: "object",
              properties: {
                sourceLineId: {
                  type: "string",
                  description: "Line ID to copy from (e.g., 'L1', 'L3'). Extract from phrases like 'copy line 1', 'duplicate L3', 'clone line 5'."
                },
                targetLineId: {
                  type: "string",
                  description: "Optional: Target location for the copy (e.g., 'L10'). If not provided, will use the next available sequential line ID. The final line ID will be in format 'sourceLineId-targetLineId' (e.g., 'L1-L10')."
                }
              },
              required: ["sourceLineId"]
            }
          }
        }
      ];
    
    let completion;
    try {
      // Truncate conversation history to prevent token limit issues
      // Keep last 20 messages (system + recent history + current = ~22 messages max)
      const MAX_HISTORY_MESSAGES = 20;
      const truncatedHistory = conversationHistory.length > MAX_HISTORY_MESSAGES
        ? conversationHistory.slice(-MAX_HISTORY_MESSAGES)
        : conversationHistory;
      
      const messages = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        ...truncatedHistory.map((msg: any) => ({
          role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: msg.content || "",
        })),
        { role: "user" as const, content: userPrompt },
      ];
      
      // Log token estimate (rough: ~4 chars per token)
      const estimatedTokens = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / 4;
      console.log(`Token estimate: ~${Math.round(estimatedTokens)} tokens (${messages.length} messages)`);
      
      console.log("Sending to OpenAI with function calling:", {
        model: "gpt-4o-mini",
        messageCount: messages.length,
        toolsCount: tools.length,
      });

      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: tools,
        tool_choice: "auto", // Let the model decide when to use tools
        temperature: 0.7, // Higher temperature for more natural, conversational responses
      });
      
      console.log("OpenAI API call successful");
      console.log("Completion:", {
        hasChoices: !!completion.choices,
        choicesLength: completion.choices?.length || 0,
        hasUsage: !!completion.usage,
        hasToolCalls: !!completion.choices[0]?.message?.tool_calls,
      });
      
      if (!completion.choices || completion.choices.length === 0) {
        throw new Error("OpenAI API returned no choices in response");
      }
      
      if (!completion.choices[0].message) {
        throw new Error("OpenAI API returned invalid message structure");
      }

      const message = completion.choices[0].message;
      
      // Check if the AI provided a conversational response (no function call)
      if (!message.tool_calls || message.tool_calls.length === 0) {
        // AI wants to have a conversation - return the text response
        const conversationalResponse = message.content || "I'm here to help! What would you like to do?";
        
        console.log("AI provided conversational response (no function call):", conversationalResponse);
        
        const tokens = completion.usage?.total_tokens || 0;
        const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");
        
        return NextResponse.json({
          action: "conversation",
          message: conversationalResponse,
          confidence: 0.9,
          tokens,
          cost,
        });
      }
      
      // Check if the AI wants to call a function
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`AI wants to call ${message.tool_calls.length} function(s)`);
        
        // Process the first function call (we'll support multiple later if needed)
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function.name;
        let functionArgs: any = {};
        
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (parseError: any) {
          console.error("Failed to parse function arguments:", parseError);
          throw new Error(`Invalid function arguments: ${parseError.message}`);
        }
        
        console.log(`Function call: ${functionName}`, functionArgs);
        
        // Map function calls to actions
        let action: "create" | "update" | "delete" | "copy" | "query" | "unknown" = "unknown";
        let lineId: string | undefined;
        let data: Partial<EstimatingLine> = {};
        let messageText = "";
        
        if (functionName === "create_estimating_line") {
          action = "create";
          
          // If lineId is provided, use it; otherwise generate next sequential ID
          if (functionArgs.lineId) {
            lineId = functionArgs.lineId;
          } else {
            // Use proper line ID manager to ensure sequential format (L1, L2, L3, etc.)
            const { getNextLineId, extractLineNumber } = await import("@/lib/utils/lineIdManager");
            lineId = getNextLineId(existingLines || []);
            
            // Check for duplicates and get next available if needed
            let attempts = 0;
            while ((existingLines || []).some((l: any) => l.lineId === lineId) && attempts < 100) {
              const num = extractLineNumber(lineId);
              lineId = `L${num + 1}`;
              attempts++;
            }
            
            if (attempts >= 100) {
              throw new Error("Could not generate unique line ID after 100 attempts");
            }
          }
          data = { ...functionArgs };
          messageText = `Creating new line${lineId ? ` ${lineId}` : ""}: ${functionArgs.itemDescription || "item"}${functionArgs.sizeDesignation ? ` (${functionArgs.sizeDesignation})` : ""}${functionArgs.qty ? `, Qty: ${functionArgs.qty}` : ""}${functionArgs.lengthFt ? `, Length: ${functionArgs.lengthFt} ft` : ""}`;
        } else if (functionName === "update_estimating_line") {
          action = "update";
          lineId = functionArgs.lineId;
          const { lineId: _, ...updateData } = functionArgs;
          data = updateData;
          messageText = `Updating line ${lineId}${Object.keys(updateData).length > 0 ? `: ${Object.entries(updateData).map(([k, v]) => `${k} = ${v}`).join(", ")}` : ""}`;
        } else if (functionName === "delete_estimating_line") {
          action = "delete";
          lineId = functionArgs.lineId;
          messageText = `Deleting line ${lineId}`;
        } else if (functionName === "query_estimating_lines") {
          action = "query";
          lineId = functionArgs.lineId;
          
          // Find matching lines
          let matchingLines = existingLines || [];
          if (functionArgs.lineId) {
            matchingLines = matchingLines.filter(l => l.lineId === functionArgs.lineId);
          }
          if (functionArgs.category) {
            matchingLines = matchingLines.filter(l => l.category === functionArgs.category);
          }
          if (functionArgs.searchTerm) {
            const search = functionArgs.searchTerm.toLowerCase();
            matchingLines = matchingLines.filter(l => 
              l.itemDescription?.toLowerCase().includes(search) ||
              l.sizeDesignation?.toLowerCase().includes(search) ||
              l.lineId?.toLowerCase().includes(search)
            );
          }
          
          if (matchingLines.length === 0) {
            messageText = "No matching lines found.";
          } else if (matchingLines.length === 1) {
            const line = matchingLines[0];
            messageText = `Line ${line.lineId || 'N/A'}: ${line.itemDescription || 'No description'} | ${line.sizeDesignation || 'No size'} | Qty: ${line.qty || 0}${line.lengthFt ? ` | Length: ${line.lengthFt} ft` : ""}`;
          } else {
            messageText = `Found ${matchingLines.length} line(s):\n${matchingLines.map(l => `- ${l.lineId || 'N/A'}: ${l.itemDescription || 'No description'} | ${l.sizeDesignation || 'No size'} | Qty: ${l.qty || 0}`).join('\n')}`;
          }
        } else if (functionName === "copy_estimating_line") {
          action = "copy";
          const sourceLineId = functionArgs.sourceLineId;
          const targetLineId = functionArgs.targetLineId;
          
          // Find the source line
          const sourceLine = existingLines?.find((l: any) => l.lineId === sourceLineId);
          if (!sourceLine) {
            throw new Error(`Source line ${sourceLineId} not found`);
          }
          
          // Create copy line ID: sourceLineId-targetLineId (e.g., L1-L10)
          // If targetLineId not provided, use next available sequential ID
          let finalLineId: string;
          if (targetLineId) {
            finalLineId = `${sourceLineId}-${targetLineId}`;
          } else {
            // Find next available sequential ID
            const maxNum = Math.max(
              ...(existingLines || []).map((l: any) => {
                const match = l.lineId?.match(/L?(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
              }),
              0
            );
            const nextId = `L${maxNum + 1}`;
            finalLineId = `${sourceLineId}-${nextId}`;
          }
          
          data = {
            ...sourceLine,
            lineId: finalLineId,
          };
          // Remove id field so it creates a new document
          delete (data as any).id;
          
          messageText = `Copying line ${sourceLineId} to ${finalLineId}`;
        } else {
          throw new Error(`Unknown function: ${functionName}`);
        }
        
        // Return the action response
        const tokens = completion.usage?.total_tokens || 0;
        const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");
        
        console.log("Returning function call response:", { action, lineId, messageText });
        
        return NextResponse.json({
          action,
          lineId,
          data,
          message: messageText,
          confidence: 0.95, // Function calls are high confidence
          tokens,
          cost,
        });
      }
      
      // If we get here, something unexpected happened
      // (This shouldn't happen because we check for conversational responses first)
      throw new Error("AI response had neither function calls nor text content");
    } catch (openaiError: any) {
      console.error("=== OpenAI API error ===");
      console.error("Error:", openaiError);
      console.error("Error message:", openaiError.message);
      console.error("Error status:", openaiError.status);
      console.error("Error code:", openaiError.code);
      console.error("Error type:", openaiError.type);
      console.error("Error response:", openaiError.response);
      
      // Check for specific OpenAI error types
      if (openaiError.status === 401) {
        throw new Error("OpenAI API key is invalid or expired. Please check your API key in .env.local");
      } else if (openaiError.status === 429) {
        // Rate limit error - provide more helpful message
        const retryAfter = openaiError.response?.headers?.['retry-after'] || openaiError.response?.headers?.['x-ratelimit-reset-requests'];
        const message = retryAfter 
          ? `OpenAI API rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
          : "OpenAI API rate limit exceeded. You've made too many requests too quickly. Please wait a minute and try again.";
        throw new Error(message);
      } else if (openaiError.status === 500 || openaiError.status === 502 || openaiError.status === 503) {
        throw new Error("OpenAI API server error. Please try again in a moment.");
      } else if (openaiError.code === 'ECONNRESET' || openaiError.code === 'ETIMEDOUT') {
        throw new Error("Network connection error. Please check your internet connection and try again.");
      } else {
        throw new Error(`OpenAI API error: ${openaiError.message || "Unknown error"} (Status: ${openaiError.status || "N/A"})`);
      }
    }
    
    // NOTE: The code below is unreachable because we return early for both
    // conversational responses and function calls. This is dead code and should be removed.
    // Keeping for now in case there are edge cases, but it should never execute.
    console.warn("Reached unreachable code - this should not happen");
    throw new Error("Unexpected code path reached - AI response handling incomplete");
  } catch (error: any) {
    console.error("=== Voice agent error ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.status);
    console.error("Error code:", error.code);
    console.error("Error type:", error.type);
    
    // Return more detailed error information
    const errorMessage = error.message || "Unknown error occurred";
    const errorDetails = error.response?.data || error.stack || "No additional details";
    
    console.error("Returning error response:", { errorMessage, errorDetails });
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Include the actual error message in the response so client can see it
    return NextResponse.json(
      { 
        error: "Failed to process voice command",
        message: errorMessage,
        details: typeof errorDetails === 'string' ? errorDetails.substring(0, 1000) : JSON.stringify(errorDetails).substring(0, 1000),
        action: "unknown",
        confidence: 0,
        serverError: errorMessage // Include the actual error message
      },
      { status: 500 }
    );
  }
}

