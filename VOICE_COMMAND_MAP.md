# Voice Command Map - Structured Format Guide

## 🎯 How to Speak Commands

The AI understands commands in **TWO formats**. The **LETTER FORMAT** is fastest and most reliable!

### Format 1: Letter Format (PREFERRED ⭐)
```
[LETTER]. [VALUE]
```

**Examples:**
- `a. column` → Puts "Column" in the Item field (a = Item)
- `b. beams` → Puts "Beams" in the Category field (b = Category)
- `h. W12x24` → Puts "W12x24" in the Size field (h = Size)
- `l. 5` → Puts 5 in the Quantity field (l = Quantity)

### Format 2: Field Name Format (Also Supported)
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

| Letter | Field Name | Value Examples | What It Does |
|--------|------------|---------------|--------------|
| **a** | `item` | `column`, `beam`, `base plate` | Sets the item description |
| **b** | `category` | `columns`, `beams`, `misc metals`, `plates` | Sets the category |
| **c** | `sub category` | `base plate`, `gusset`, `stiffener` | Sets the sub-category |
| **d** | `drawing` | `D-101`, `S-205` | Sets the drawing number |
| **e** | `detail` | `D1`, `D2` | Sets the detail number |
| **f** | `type` | `rolled`, `plate` | Sets the material type |

### Material Fields (Rolled Members)

| Letter | Field Name | Value Examples | What It Does |
|--------|------------|---------------|--------------|
| **g** | `type` or `shape` | `wide flange`, `W`, `HSS`, `channel` | Sets the shape type |
| **h** | `spec` or `size` | `W12x24`, `HSS 6x6x1/4` | Sets the size designation |
| **i** | `grade` | `A992`, `A572 Gr50`, `A36` | Sets the material grade |
| **j** | `length` or `feet` | `20 feet`, `15 ft`, `25'` | Sets length in feet |
| **k** | `inches` | `6 inches`, `3 in`, `6"` | Sets length in inches |
| **l** | `quantity` or `qty` | `5`, `3`, `10` | Sets the quantity |

### Material Fields (Plates)

| Letter | Field Name | Value Examples | What It Does |
|--------|------------|---------------|--------------|
| **m** | `thickness` or `thick` | `1/2 inch`, `0.5`, `quarter inch` | Sets plate thickness |
| **n** | `width` | `12 inches`, `48`, `24 in` | Sets plate width |
| **o** | `plate length` | `24 inches`, `96`, `48 in` | Sets plate length |
| **p** | `plate quantity` | `4`, `2`, `10` | Sets plate quantity |
| **q** | `plate grade` | `A36`, `A572 Gr50` | Sets plate grade |

### Labor Fields (All in Hours)

| Letter | Field Name | Value Examples | What It Does |
|--------|------------|---------------|--------------|
| **s** | `unload` | `0.5 hours`, `30 minutes` | Sets unloading labor |
| **t** | `cut` | `1 hour`, `2 hrs` | Sets cutting labor |
| **u** | `cope` | `0.25 hours`, `15 min` | Sets coping labor |
| **v** | `process` | `1.5 hours` | Sets plate processing labor |
| **w** | `drill` or `punch` | `0.5 hours` | Sets drilling/punching labor |
| **x** | `fit` | `2 hours` | Sets fitting labor |
| **y** | `weld` or `welding` | `2 hours`, `1.5 hrs` | Sets welding labor |
| **z** | `prep` or `clean` | `0.5 hours` | Sets prep and cleaning labor |

### Coating

| Letter | Field Name | Value Examples | What It Does |
|--------|------------|---------------|--------------|
| **r** | `coating` | `paint`, `powder`, `galv`, `none` | Sets the coating system |

## 🎬 Complete Example Session (Letter Format - Fastest!)

```
You: "add new line"
AI: "✅ Created new blank line L1. You can now speak the data for this line."

You: "a. column"
AI: "I've added to line L1: • Item: Column. Say 'enter' when ready to save this data."

You: "b. columns"
AI: "I've added to line L1: • Category: Columns. Say 'enter' when ready to save this data."

You: "g. wide flange"
AI: "I've added to line L1: • Shape: Wide Flange. Say 'enter' when ready to save this data."

You: "h. W12x24"
AI: "I've added to line L1: • Size: W12x24. Say 'enter' when ready to save this data."

You: "l. 5"
AI: "I've added to line L1: • Quantity: 5. Say 'enter' when ready to save this data."

You: "j. 20 feet"
AI: "I've added to line L1: • Length: 20 ft. Say 'enter' when ready to save this data."

You: "i. A992"
AI: "I've added to line L1: • Grade: A992. Say 'enter' when ready to save this data."

You: "y. 2 hours"
AI: "I've added to line L1: • Welding: 2 hours. Say 'enter' when ready to save this data."

You: "enter"
AI: "I will be entering the following data:
• Item: Column
• Category: Columns
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

## ⌨️ Keyboard Shortcuts (Manual Entry Mode)

When in **Manual Entry Mode**, you can use keyboard shortcuts to quickly navigate fields:

1. **Type a letter** (a-z) - This "remembers" the letter for 1 second
2. **Press Enter** - Focuses the field corresponding to that letter
3. **Start typing** - The field is now focused and ready for input

**Example:**
- Type `a` then `Enter` → Focuses the Item field
- Type `h` then `Enter` → Focuses the Size field
- Type `l` then `Enter` → Focuses the Quantity field

This is **much faster** than using the mouse!

## 💡 Tips

1. **Always start with "add new line"** - This creates a blank line first
2. **Use letter format for speed** - `a. column` is faster than `item, column`
3. **Say one field at a time** - You can add multiple fields, just say them one by one
4. **Say "enter" when done** - This shows you a summary and asks for confirmation
5. **Say "yes" to confirm** - This actually saves the data to the database
6. **Use keyboard shortcuts** - Type letter + Enter to jump to fields in manual mode

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

