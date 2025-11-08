# Natural Language Examples - AI Agent

## ✅ Out-of-Order Data Support

The AI agent can handle data spoken in **ANY ORDER**. It extracts all information and maps it to the correct fields.

### Examples

#### Same Command, Different Order
```
✅ "Add a column, 5 pieces, W12x24, 20 feet"
✅ "Add W12x24 column, 20 feet, 5 pieces"
✅ "Column, 20 feet, W12x24, 5 pieces"
✅ "5 pieces, column, W12x24, 20 feet"
```
**Result:** All create the same line with:
- itemDescription: "Column"
- shapeType: "W"
- sizeDesignation: "W12X24"
- qty: 5
- lengthFt: 20

#### Complex Out-of-Order
```
✅ "Welding 2 hours, column W12x24, 5 pieces, 20 feet, grade A992"
✅ "Column, W12x24, 5 pieces, grade A992, 20 feet, welding 2 hours"
✅ "W12x24, 5 pieces, column, grade A992, 20 feet, 2 hours welding"
```
**Result:** All extract correctly:
- itemDescription: "Column"
- shapeType: "W"
- sizeDesignation: "W12X24"
- qty: 5
- lengthFt: 20
- grade: "A992"
- laborWeld: 2

#### Multiple Labor Fields Out-of-Order
```
✅ "Add beam, W14x30, 3 pieces, 25 feet, welding 2 hours, fitting 1.5 hours, cutting 0.5 hours"
✅ "Beam W14x30, 3 pieces, 25 feet, cutting 0.5 hours, fitting 1.5 hours, welding 2 hours"
✅ "Welding 2 hours, fitting 1.5 hours, cutting 0.5 hours, beam W14x30, 3 pieces, 25 feet"
```
**Result:** All extract correctly:
- itemDescription: "Beam"
- shapeType: "W"
- sizeDesignation: "W14X30"
- qty: 3
- lengthFt: 25
- laborWeld: 2
- laborFit: 1.5
- laborCut: 0.5

## ✅ Delete Commands - Natural Language

The AI understands many ways to express delete commands:

### Direct Delete
```
✅ "Delete line 3"
✅ "Remove L5"
✅ "Get rid of line number 2"
✅ "Delete the column on line 4"
✅ "Remove item 3"
✅ "Delete line number 5"
✅ "Remove line 3"
✅ "Delete L4"
```

### With Context
```
✅ "Delete the beam on line 3"
✅ "Remove the column at line 5"
✅ "Get rid of line 3, it's wrong"
✅ "Delete line 4, that's the one I want to remove"
```

### Line ID Variations
The AI understands these all mean the same line:
- "line 3" → L3
- "L3" → L3
- "line number 3" → L3
- "number 3" → L3
- "item 3" → L3
- "line id 3" → L3

## ✅ Time/Labor Parsing

The AI converts various time formats to hours:

### Hours
```
✅ "2 hours" → 2
✅ "2 hrs" → 2
✅ "1.5 hours" → 1.5
✅ "1.5 hrs" → 1.5
```

### Minutes (Auto-Converted)
```
✅ "90 minutes" → 1.5
✅ "30 minutes" → 0.5
✅ "15 min" → 0.25
✅ "45 min" → 0.75
```

### Combined
```
✅ "1 hour 30 minutes" → 1.5
✅ "1 hr 15 min" → 1.25
✅ "2 hours 45 minutes" → 2.75
```

### Labor Examples
```
✅ "welding 2 hours" → laborWeld: 2
✅ "2 hours of welding" → laborWeld: 2
✅ "weld time 2 hours" → laborWeld: 2
✅ "2 hrs welding" → laborWeld: 2
✅ "welding for 90 minutes" → laborWeld: 1.5
```

## ✅ Length Parsing

### Feet
```
✅ "20 feet" → lengthFt: 20
✅ "20 ft" → lengthFt: 20
✅ "20'" → lengthFt: 20
```

### Inches
```
✅ "6 inches" → lengthIn: 6
✅ "6 in" → lengthIn: 6
✅ "6\"" → lengthIn: 6
```

### Combined
```
✅ "20 feet 6 inches" → lengthFt: 20, lengthIn: 6
✅ "20' 6\"" → lengthFt: 20, lengthIn: 6
✅ "20 ft 6 in" → lengthFt: 20, lengthIn: 6
```

## ✅ Update Commands - Out-of-Order

Updates also work with out-of-order data:

```
✅ "Update line 3, change to 6 pieces, add 2 hours welding"
✅ "Update line 3, add 2 hours welding, change to 6 pieces"
✅ "Line 3, change quantity to 6, welding 2 hours"
✅ "Update L3, 6 pieces, 2 hours welding"
```

## ✅ Complex Examples

### Full Line with Everything
```
"Add a column, W12x24, 5 pieces, 20 feet, grade A992, drawing D-101, detail D1, 
welding 2 hours, fitting 1.5 hours, cutting 0.5 hours, prep and clean 0.25 hours, 
notes: critical path item, hashtags: #phase1 #critical"
```

**Works even if spoken as:**
```
"Column, 5 pieces, W12x24, 20 feet, grade A992, drawing D-101, detail D1, 
2 hours welding, 1.5 hours fitting, 0.5 hours cutting, 0.25 hours prep and clean, 
notes: critical path item, hashtags: #phase1 #critical"
```

### Plate with Out-of-Order Data
```
✅ "Add a plate, 1/2 inch thick, 12 inches wide, 24 inches long, 4 pieces"
✅ "Plate, 4 pieces, 1/2 inch thick, 12 inches wide, 24 inches long"
✅ "1/2 inch plate, 12 by 24, 4 pieces"
```

## ✅ Tips for Best Results

1. **Speak naturally** - Don't worry about order
2. **Be specific** - Include all details you want
3. **Use natural phrases** - "2 hours of welding" works great
4. **Mix it up** - The AI handles variations

## ✅ What the AI Does

1. **Extracts ALL information** from your command
2. **Maps to correct fields** regardless of order
3. **Converts units** (minutes → hours, etc.)
4. **Handles variations** in phrasing
5. **Confirms actions** with clear messages

The AI is designed to be **flexible and forgiving** - speak naturally and it will understand!

