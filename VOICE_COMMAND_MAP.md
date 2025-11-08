# Voice Command Map - Structured Format Guide

## 🎯 How to Speak Commands

The AI understands commands in a **structured format** where you say the **field name** followed by the **value**. Think of it like filling out a form: you name the field, then provide the value.

## 📋 Basic Format

```
[FIELD NAME], [VALUE]
```

**Examples:**
- `item, column` → Puts "Column" in the Item field
- `category, beams` → Puts "Beams" in the Category field
- `spec, W12x24` → Puts "W12x24" in the Spec field
- `quantity, 5` → Puts 5 in the Quantity field

## 🔄 Complete Workflow

### Step 1: Create Blank Line
```
You: "add new line"
AI: "✅ Created new blank line L1. You can now speak the data for this line."
```

### Step 2: Add Data (Field Name, Value Format)
```
You: "item, column"
AI: "I've added to line L1: • Item: Column. Say 'enter' when ready to save this data."

You: "spec, W12x24"
AI: "I've added to line L1: • Size: W12x24. Say 'enter' when ready to save this data."

You: "quantity, 5"
AI: "I've added to line L1: • Quantity: 5. Say 'enter' when ready to save this data."
```

### Step 3: Enter Data
```
You: "enter"
AI: "I will be entering the following data:
• Item: Column
• Size: W12x24
• Quantity: 5
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L1! Say 'add new line' to create another line."
```

## 📖 Complete Field Map

### Identification Fields

| Field Name | Value Examples | What It Does |
|------------|---------------|--------------|
| `item` | `column`, `beam`, `base plate` | Sets the item description |
| `category` | `columns`, `beams`, `misc metals`, `plates` | Sets the category |
| `sub category` | `base plate`, `gusset`, `stiffener` | Sets the sub-category |
| `drawing` | `D-101`, `S-205` | Sets the drawing number |
| `detail` | `D1`, `D2` | Sets the detail number |
| `notes` | `install after concrete` | Sets notes |
| `hashtags` | `phase1 critical` | Sets hashtags (becomes #phase1 #critical) |

### Material Fields (Rolled Members)

| Field Name | Value Examples | What It Does |
|------------|---------------|--------------|
| `type` or `shape` | `wide flange`, `W`, `HSS`, `channel` | Sets the shape type |
| `spec` or `size` | `W12x24`, `HSS 6x6x1/4` | Sets the size designation |
| `grade` | `A992`, `A572 Gr50`, `A36` | Sets the material grade |
| `quantity` or `qty` | `5`, `3`, `10` | Sets the quantity |
| `length` or `feet` | `20 feet`, `15 ft`, `25'` | Sets length in feet |
| `inches` | `6 inches`, `3 in`, `6"` | Sets length in inches |

### Material Fields (Plates)

| Field Name | Value Examples | What It Does |
|------------|---------------|--------------|
| `thickness` or `thick` | `1/2 inch`, `0.5`, `quarter inch` | Sets plate thickness |
| `width` | `12 inches`, `48`, `24 in` | Sets plate width |
| `plate length` | `24 inches`, `96`, `48 in` | Sets plate length |
| `plate quantity` | `4`, `2`, `10` | Sets plate quantity |
| `plate grade` | `A36`, `A572 Gr50` | Sets plate grade |

### Labor Fields (All in Hours)

| Field Name | Value Examples | What It Does |
|------------|---------------|--------------|
| `unload` | `0.5 hours`, `30 minutes` | Sets unloading labor |
| `cut` | `1 hour`, `2 hrs` | Sets cutting labor |
| `cope` | `0.25 hours`, `15 min` | Sets coping labor |
| `process` | `1.5 hours` | Sets plate processing labor |
| `drill` or `punch` | `0.5 hours` | Sets drilling/punching labor |
| `fit` | `2 hours` | Sets fitting labor |
| `weld` or `welding` | `2 hours`, `1.5 hrs` | Sets welding labor |
| `prep` or `clean` | `0.5 hours` | Sets prep and cleaning labor |
| `paint` | `1 hour` | Sets painting labor |
| `handle` or `move` | `0.25 hours` | Sets handling/moving labor |
| `load` or `ship` | `0.5 hours` | Sets loading/shipping labor |

### Coating

| Field Name | Value Examples | What It Does |
|------------|---------------|--------------|
| `coating` | `paint`, `powder`, `galv`, `none` | Sets the coating system |

## 🎬 Complete Example Session

```
You: "add new line"
AI: "✅ Created new blank line L1. You can now speak the data for this line."

You: "item, column"
AI: "I've added to line L1: • Item: Column. Say 'enter' when ready to save this data."

You: "category, columns"
AI: "I've added to line L1: • Category: Columns. Say 'enter' when ready to save this data."

You: "type, wide flange"
AI: "I've added to line L1: • Type: Wide Flange. Say 'enter' when ready to save this data."

You: "spec, W12x24"
AI: "I've added to line L1: • Size: W12x24. Say 'enter' when ready to save this data."

You: "quantity, 5"
AI: "I've added to line L1: • Quantity: 5. Say 'enter' when ready to save this data."

You: "length, 20 feet"
AI: "I've added to line L1: • Length: 20 ft. Say 'enter' when ready to save this data."

You: "grade, A992"
AI: "I've added to line L1: • Grade: A992. Say 'enter' when ready to save this data."

You: "weld, 2 hours"
AI: "I've added to line L1: • Welding: 2 hours. Say 'enter' when ready to save this data."

You: "enter"
AI: "I will be entering the following data:
• Item: Column
• Category: Columns
• Type: Wide Flange
• Size: W12x24
• Quantity: 5
• Length: 20 ft
• Grade: A992
• Welding: 2 hours
Do you want me to proceed?"

You: "yes"
AI: "✅ Data entered successfully for line L1! Say 'add new line' to create another line."
```

## 💡 Tips

1. **Always start with "add new line"** - This creates a blank line first
2. **Use commas for clarity** - `item, column` is clearer than `item column`
3. **Say one field at a time** - You can add multiple fields, just say them one by one
4. **Say "enter" when done** - This shows you a summary and asks for confirmation
5. **Say "yes" to confirm** - This actually saves the data to the database

## 🔧 Alternative: Natural Language (Less Reliable)

You can also speak naturally, but the structured format is more reliable:

```
You: "add a column W12x24, 5 pieces, 20 feet"
AI: [May work, but less reliable than structured format]
```

**Recommendation:** Use the structured format (`item, column`) for best results.

## ❌ Common Mistakes

1. **Saying "item column" without comma** - Works, but comma is clearer
2. **Not saying "add new line" first** - Always create blank line first
3. **Forgetting to say "enter"** - Data won't be saved until you say "enter"
4. **Not confirming with "yes"** - Data won't be saved until you confirm

## ✅ Best Practices

1. ✅ `"add new line"` → Creates blank line
2. ✅ `"item, column"` → Adds item description
3. ✅ `"spec, W12x24"` → Adds size
4. ✅ `"quantity, 5"` → Adds quantity
5. ✅ `"enter"` → Shows summary
6. ✅ `"yes"` → Saves data

