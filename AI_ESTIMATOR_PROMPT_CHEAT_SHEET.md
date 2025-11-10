# AI Estimator Prompt Cheat Sheet
## Professional Guide for Steel Fabrication Estimating

**Written by:** Senior Estimator & AI Developer  
**Purpose:** Master the AI voice assistant for fast, accurate steel estimating  
**Last Updated:** Version 0.1.3

---

## 🎯 Quick Start: The Two Formats

The AI understands commands in **TWO formats**. Use **NUMBER FORMAT** for fastest, most reliable results.

### ⭐ Format 1: Number Format (PREFERRED - Fastest & Most Reliable)

```
[NUMBER]. [VALUE]
```

**Why it's better:** Direct mapping to fields, no ambiguity, fastest processing.

**Examples:**
- `"1. column"` → Item Description = "Column"
- `"8. W12x24"` → Size = "W12x24" (for Rolled Material)
- `"10. 5"` → Quantity = 5
- `"20. 2 hours"` → Welding Labor = 2 hours

### Format 2: Field Name Format (Also Supported)

```
[FIELD NAME], [VALUE]
```

**Examples:**
- `"item, column"` → Item Description = "Column"
- `"spec, W12x24"` → Size = "W12x24"
- `"quantity, 5"` → Quantity = 5

---

## 📋 Complete Field Number Map (Estimation Workflow Order)

### 1. IDENTIFICATION (Numbers 1-6)

| # | Field Name | Display Name | Value Examples | What It Does |
|---|------------|--------------|----------------|--------------|
| **1** | Drawing # | Drawing Number | `"1. D-101"`, `"1. S-205"` | Sets drawing reference |
| **2** | Detail # | Detail Number | `"2. D1"`, `"2. D2"` | Sets detail reference |
| **3** | Item Description | Item | `"3. column"`, `"3. beam"`, `"3. base plate"` | Sets item description |
| **4** | Category | Category | `"4. columns"`, `"4. beams"`, `"4. misc metals"`, `"4. plates"` | Sets category |
| **5** | Sub-Category | Sub-Category | `"5. base plate"`, `"5. gusset"`, `"5. stiffener"` | Sets sub-category |
| **6** | Material Type | Material Type | `"6. rolled"`, `"6. plate"` | Sets material type (Rolled/Plate) |

**Estimating Workflow:** Start here. Identify what you're estimating before material details.

---

### 2. MATERIAL - Rolled Members (Numbers 7-12)

**Use these when Material Type = "Rolled" (W, HSS, C, L, T shapes)**

| # | Field Name | Display Name | Value Examples | What It Does |
|---|------------|--------------|----------------|--------------|
| **7** | Shape Type | Type/Shape | `"7. wide flange"`, `"7. W"`, `"7. HSS"`, `"7. channel"` | Sets shape type (W, HSS, C, L, T) |
| **8** | Size | Spec/Size | `"8. W12x24"`, `"8. HSS 6x6x1/4"`, `"8. C12x20.7"` | Sets size designation |
| **9** | Grade | Grade | `"9. A992"`, `"9. A572 Gr50"`, `"9. A36"` | Sets material grade |
| **10** | Quantity | Qty | `"10. 5"`, `"10. 3"`, `"10. 10"` | Sets quantity |
| **11** | Length (ft) | Length (ft) | `"11. 20 feet"`, `"11. 15 ft"`, `"11. 25'"` | Sets length in feet |
| **12** | Length (in) | Length (in) | `"12. 6 inches"`, `"12. 3 in"`, `"12. 6""` | Sets additional inches |

**Steel Notation Tips:**
- `"W12x24"` = `"W12 by 24"` (AI understands both)
- `"HSS 6x6x1/4"` = `"HSS 6 by 6 by quarter"` (AI understands both)
- `"quarter"` = `"1/4"` (AI converts automatically)
- `"half"` = `"1/2"` (AI converts automatically)

---

### 2. MATERIAL - Plate Members (Numbers 7-12)

**Use these when Material Type = "Plate"**

| # | Field Name | Display Name | Value Examples | What It Does |
|---|------------|--------------|----------------|--------------|
| **7** | Thickness | Thickness | `"7. 1/2 inch"`, `"7. 0.5"`, `"7. quarter inch"` | Sets plate thickness (inches) |
| **8** | Width | Width | `"8. 12 inches"`, `"8. 48"`, `"8. 24 in"` | Sets plate width (inches) |
| **9** | Plate Length | Length | `"9. 24 inches"`, `"9. 96"`, `"9. 48 in"` | Sets plate length (inches) |
| **10** | Plate Quantity | Qty | `"10. 4"`, `"10. 2"`, `"10. 10"` | Sets plate quantity |
| **11** | Plate Grade | Grade | `"11. A36"`, `"11. A572 Gr50"` | Sets plate grade |
| **12** | One Side Coat | One Side Coat | `"12. yes"`, `"12. no"` | Sets one-side coating flag |

---

### 3. COATING (Number 13)

| # | Field Name | Display Name | Value Examples | What It Does |
|---|------------|--------------|----------------|--------------|
| **13** | Coating System | Coating | `"13. paint"`, `"13. powder"`, `"13. galv"`, `"13. none"` | Sets coating system |

---

### 4. LABOR (Numbers 14-24)

**All labor fields are in HOURS. AI converts minutes automatically.**

| # | Field Name | Display Name | Value Examples | What It Does |
|---|------------|--------------|----------------|--------------|
| **14** | Unload | Unload | `"14. 0.5 hours"`, `"14. 30 minutes"` | Sets unloading labor |
| **15** | Cut | Cut | `"15. 1 hour"`, `"15. 2 hrs"` | Sets cutting labor |
| **16** | Cope | Cope | `"16. 0.25 hours"`, `"16. 15 min"` | Sets coping labor |
| **17** | Process | Process | `"17. 1.5 hours"` | Sets plate processing labor |
| **18** | Drill/Punch | Drill/Punch | `"18. 0.5 hours"` | Sets drilling/punching labor |
| **19** | Fit | Fit | `"19. 2 hours"` | Sets fitting labor |
| **20** | Weld | Weld | `"20. 2 hours"`, `"20. 1.5 hrs"` | Sets welding labor |
| **21** | Prep/Clean | Prep/Clean | `"21. 0.5 hours"` | Sets prep and cleaning labor |
| **22** | Paint | Paint | `"22. 1 hour"` | Sets painting labor |
| **23** | Handle/Move | Handle/Move | `"23. 0.25 hours"`, `"23. 15 minutes"` | Sets handling/moving labor |
| **24** | Load/Ship | Load/Ship | `"24. 0.5 hours"` | Sets loading/shipping labor |

**Time Conversion (AI handles automatically):**
- `"2 hours"` = 2.0 hours
- `"90 minutes"` = 1.5 hours
- `"30 minutes"` = 0.5 hours
- `"15 min"` = 0.25 hours
- `"1 hour 30 minutes"` = 1.5 hours
- `"1 hr 15 min"` = 1.25 hours

---

### 5. ADMIN & NOTES (Numbers 25-28)

| # | Field Name | Display Name | Value Examples | What It Does |
|---|------------|--------------|----------------|--------------|
| **25** | Notes | Notes | `"25. install after concrete"` | Sets notes |
| **26** | Hashtags | Hashtags | `"26. phase1 critical"` | Sets hashtags/tags |
| **27** | Status | Status | `"27. pending"`, `"27. approved"` | Sets status |
| **28** | Use Stock Rounding | Use Stock Rounding | `"28. yes"`, `"28. no"` | Sets stock rounding flag |

---

## 🔄 Complete Workflow: Step-by-Step

### Step 1: Create Blank Line

```
You: "add new line"
AI: "✅ Created new blank line L1. You can now speak the data for this line."
```

**Why:** Always create a blank line first. This ensures proper line ID sequencing (L1, L2, L3, etc.).

---

### Step 2: Add Data (Number Format - Fastest)

```
You: "3. column"
AI: "I've added to line L1: • Item: Column. Say 'enter' when ready to save this data."

You: "4. columns"
AI: "I've added to line L1: • Category: Columns. Say 'enter' when ready to save this data."

You: "6. rolled"
AI: "I've added to line L1: • Material Type: Rolled. Say 'enter' when ready to save this data."

You: "7. wide flange"
AI: "I've added to line L1: • Shape: Wide Flange. Say 'enter' when ready to save this data."

You: "8. W12x24"
AI: "I've added to line L1: • Size: W12x24. Say 'enter' when ready to save this data."

You: "10. 5"
AI: "I've added to line L1: • Quantity: 5. Say 'enter' when ready to save this data."

You: "11. 20 feet"
AI: "I've added to line L1: • Length: 20 ft. Say 'enter' when ready to save this data."

You: "9. A992"
AI: "I've added to line L1: • Grade: A992. Say 'enter' when ready to save this data."

You: "20. 2 hours"
AI: "I've added to line L1: • Welding: 2 hours. Say 'enter' when ready to save this data."
```

**Key Points:**
- Speak one field at a time (or multiple in one command)
- AI accumulates data as you speak
- You can add fields in any order
- AI understands steel notation (`"W12x24"` = `"W12 by 24"`)

---

### Step 3: Enter Data (Confirmation)

```
You: "enter"
AI: "I will be entering the following data:
• Item: Column
• Category: Columns
• Material Type: Rolled
• Shape: Wide Flange
• Size: W12x24
• Quantity: 5
• Length: 20 ft
• Grade: A992
• Welding: 2 hours
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L1! Say 'add new line' to create another line."
```

**Confirmation Options:**
- `"yes"` ✅
- `"proceed"` ✅
- `"continue"` ✅
- `"enter data"` ✅
- `"go ahead"` ✅

**To Amend Before Entering:**
- `"change quantity to 6"` → AI updates quantity
- `"add grade A572"` → AI adds grade
- `"remove welding"` → AI removes welding labor
- Then say `"enter"` again to see updated summary

---

## 🎬 Real-World Example Sessions

### Example 1: Rolled Column (Number Format - Fastest)

```
You: "add new line"
AI: "✅ Created new blank line L1."

You: "3. column, 4. columns, 6. rolled, 7. wide flange, 8. W12x24, 10. 5, 11. 20 feet, 9. A992, 20. 2 hours"
AI: "I've added to line L1:
• Item: Column
• Category: Columns
• Material Type: Rolled
• Shape: Wide Flange
• Size: W12x24
• Quantity: 5
• Length: 20 ft
• Grade: A992
• Welding: 2 hours
Say 'enter' when ready to save this data."

You: "enter"
AI: "I will be entering the following data: [summary]
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L1!"
```

---

### Example 2: HSS Member (Field Name Format)

```
You: "add new line"
AI: "✅ Created new blank line L2."

You: "item, HSS member"
AI: "I've added to line L2: • Item: HSS member."

You: "category, misc metals"
AI: "I've added to line L2: • Category: Misc Metals."

You: "type, HSS"
AI: "I've added to line L2: • Shape: HSS."

You: "spec, HSS 6x6x1/4"
AI: "I've added to line L2: • Size: HSS 6x6x1/4."

You: "quantity, 10"
AI: "I've added to line L2: • Quantity: 10."

You: "length, 30 feet"
AI: "I've added to line L2: • Length: 30 ft."

You: "enter"
AI: "I will be entering the following data: [summary]
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L2!"
```

---

### Example 3: Plate Material

```
You: "add new line"
AI: "✅ Created new blank line L3."

You: "3. base plate, 4. plates, 6. plate, 7. half inch, 8. 12 inches, 9. 24 inches, 10. 4, 11. A36"
AI: "I've added to line L3:
• Item: Base Plate
• Category: Plates
• Material Type: Plate
• Thickness: 0.5"
• Width: 12"
• Length: 24"
• Quantity: 4
• Grade: A36
Say 'enter' when ready to save this data."

You: "enter"
AI: "I will be entering the following data: [summary]
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L3!"
```

---

### Example 4: Complete Line with Labor

```
You: "add new line"
AI: "✅ Created new blank line L4."

You: "3. beam, 4. beams, 6. rolled, 7. W, 8. W14x22, 10. 3, 11. 25 feet, 9. A992, 14. 30 minutes, 15. 1 hour, 20. 2 hours, 23. 15 minutes"
AI: "I've added to line L4:
• Item: Beam
• Category: Beams
• Material Type: Rolled
• Shape: W
• Size: W14x22
• Quantity: 3
• Length: 25 ft
• Grade: A992
• Unload: 0.5 hours
• Cut: 1 hour
• Weld: 2 hours
• Handle/Move: 0.25 hours
Say 'enter' when ready to save this data."

You: "enter"
AI: "I will be entering the following data: [summary]
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L4!"
```

---

## 🔧 Advanced Commands

### Update Existing Line

```
You: "update line 3, change quantity to 6"
AI: "I will update line L3: • Quantity: 6
Do you want me to proceed?"

You: "yes"
AI: "✅ Updated line L3 successfully!"
```

**Update Examples:**
- `"update line 3, change quantity to 6"`
- `"change L2 to 25 feet"`
- `"make line 5 grade A572"`
- `"update line 4, change the size to W14x22"`
- `"update line 1, add 2 hours welding"`

---

### Delete Line

```
You: "delete line 3"
AI: "I will delete line L3. Are you sure?"

You: "yes"
AI: "✅ Deleted line L3 successfully!"
```

**Delete Examples:**
- `"delete line 3"`
- `"remove L5"`
- `"get rid of line number 2"`
- `"delete the column on line 4"`

---

### Copy/Duplicate Line

```
You: "copy line 1"
AI: "I will copy line L1 to L1-L10 (next available location).
Do you want me to proceed?"

You: "yes"
AI: "✅ Copied line L1 to L1-L10 successfully!"
```

**Copy Examples:**
- `"copy line 1"` → Creates L1-L10 (or next available)
- `"duplicate L3"` → Creates L3-L11 (or next available)
- `"copy line 1 to line 10"` → Creates L1-L10
- `"clone line 5"` → Creates L5-L12 (or next available)

**Line ID Format for Copies:**
- `"L1-L10"` means copy of L1 at location L10
- When sorted, all copies of L1 will group together (L1, L1-L10, L1-L15, etc.)

---

### Query Information

```
You: "what's on line 2?"
AI: "Line L2 contains:
• Item: HSS Member
• Category: Misc Metals
• Size: HSS 6x6x1/4
• Quantity: 10
• Length: 30 ft"

You: "show me all columns"
AI: "I found 3 columns:
• L1: Column, W12x24, 5 pieces, 20 ft
• L3: Column, W14x22, 3 pieces, 25 ft
• L5: Column, W10x15, 2 pieces, 15 ft"

You: "what's the total weight?"
AI: "The total weight is 12,450 lbs."

You: "list all beams"
AI: "I found 2 beams:
• L2: Beam, W14x22, 3 pieces, 25 ft
• L4: Beam, W12x24, 2 pieces, 20 ft"
```

**Query Examples:**
- `"what's on line 2?"`
- `"show me all columns"`
- `"what's the total weight?"`
- `"list all beams"`
- `"how many pieces of W12x24?"`
- `"what's the total cost?"`

---

## 💡 Pro Tips for Estimators

### 1. Use Number Format for Speed
- **Fastest:** `"3. column, 8. W12x24, 10. 5"`
- **Slower:** `"item, column, spec, W12x24, quantity, 5"`

### 2. Speak Multiple Fields at Once
- **Good:** `"3. column, 8. W12x24, 10. 5, 11. 20 feet"`
- **Also Good:** `"3. column"` then `"8. W12x24"` then `"10. 5"` (one at a time)

### 3. AI Understands Steel Notation
- `"W12x24"` = `"W12 by 24"` ✅
- `"HSS 6x6x1/4"` = `"HSS 6 by 6 by quarter"` ✅
- `"quarter"` = `"1/4"` ✅
- `"half"` = `"1/2"` ✅

### 4. Data Can Be Spoken in Any Order
- **Works:** `"3. column, 8. W12x24, 10. 5"`
- **Also Works:** `"10. 5, 3. column, 8. W12x24"`
- AI extracts all information regardless of order

### 5. Always Confirm Before Entering
- Say `"enter"` to see summary
- Review the data
- Say `"yes"` to confirm
- Or amend with `"change quantity to 6"` then `"enter"` again

### 6. Use Natural Language for Queries
- `"what's on line 2?"` ✅
- `"show me all columns"` ✅
- `"what's the total weight?"` ✅

### 7. Amend Data Before Entering
- `"change quantity to 6"` → Updates quantity
- `"add grade A572"` → Adds grade
- `"remove welding"` → Removes welding labor
- Then say `"enter"` again to see updated summary

---

## ❌ Common Mistakes to Avoid

### 1. Not Creating Blank Line First
- ❌ `"3. column, 8. W12x24"` (without "add new line")
- ✅ `"add new line"` then `"3. column, 8. W12x24"`

### 2. Forgetting to Say "Enter"
- ❌ Adding data but never saying `"enter"`
- ✅ Say `"enter"` to see summary and confirm

### 3. Not Confirming with "Yes"
- ❌ Saying `"enter"` but not confirming
- ✅ Say `"yes"` after `"enter"` to actually save

### 4. Confusing Field Names
- ❌ `"item, columns"` (thinking "item" means "category")
- ✅ `"3. column"` (Item Description) or `"4. columns"` (Category)

**Remember:** `"3"` or `"item"` = Item Description field, `"4"` or `"category"` = Category field

### 5. Not Specifying Line ID for Updates/Deletes
- ❌ `"update quantity to 6"` (which line?)
- ✅ `"update line 3, change quantity to 6"`

---

## ✅ Best Practices Checklist

- [ ] Always start with `"add new line"` to create blank line
- [ ] Use number format (`"3. column"`) for fastest results
- [ ] Speak one field at a time, or multiple in one command
- [ ] Say `"enter"` when ready to see summary
- [ ] Review the summary before confirming
- [ ] Say `"yes"` to confirm and save data
- [ ] Use natural language for queries (`"what's on line 2?"`)
- [ ] Specify line ID for updates/deletes (`"update line 3"`)
- [ ] Amend data before entering if needed (`"change quantity to 6"`)

---

## 🎓 Training Mode (Optional)

If the AI has trouble understanding your accent or speech patterns, use Training Mode:

1. Click the **Training** button in the AI chat
2. Say each phrase exactly as prompted
3. AI will learn your speech patterns
4. Training data is saved per user

**Training Phrases:**
- "Add new line"
- "Enter"
- "Yes"
- "W12x24"
- "HSS 6x6x1/4"
- And more...

---

## 📞 Need Help?

- **AI Not Understanding?** Try number format (`"3. column"` instead of `"item, column"`)
- **Wrong Data Entered?** Say `"update line [X], change [field] to [value]"`
- **Want to Delete?** Say `"delete line [X]"`
- **Need to Query?** Ask naturally: `"what's on line 2?"`

---

## 🔄 Workflow Summary

```
1. "add new line"                    → Creates blank line L1
2. "3. column, 8. W12x24, 10. 5"      → Adds data (accumulates)
3. "enter"                           → Shows summary
4. "yes"                             → Confirms and saves
5. "add new line"                    → Creates blank line L2
   (repeat steps 2-4)
```

---

**Version:** 0.1.3  
**Last Updated:** 2024  
**For:** Quant Steel Fabrication Estimating System

