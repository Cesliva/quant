# Conversational Workflow - AI Estimating Assistant

## Workflow Overview

The AI assistant now uses a structured conversational workflow that allows estimators to build up data incrementally before entering it.

## Complete Workflow

### 1. Wake Word
```
You: "Hey Quant"
AI: "Hello! Ready to estimate when you are. What would you like to add?"
```

### 2. Add New Line
```
You: "Add new line"
AI: "✅ Created new blank line L1. You can now speak the data for this line."
```
- Creates blank line immediately
- Sets current line ID (L1)
- Ready to accumulate data

### 3. Speak Data (Accumulates in Chat)
```
You: "Column, W12x24, 5 pieces, 20 feet"
AI: "I've added to line L1:

• Item: Column
• Category: Columns
• Size: W12X24
• Quantity: 5
• Length: 20 ft

Say 'enter' when ready to save this data."
```
- Data is tracked in chat box
- NOT entered into database yet
- Can continue adding more data

### 4. Edit Data (Before Entering)
```
You: "Edit"
AI: "What would you like me to edit?"

You: "Edit W12x24 to W12x12"
AI: "I've updated line L1:

• sizeDesignation: W12X12

Say 'enter' when ready to save."
```
- Can edit accumulated data
- Changes shown in chat
- Still not entered until "enter" command

### 5. Enter Command
```
You: "Enter"
AI: "I will be entering the following data:

• Item: Column
• Category: Columns
• Size: W12X12
• Quantity: 5
• Length: 20 ft

⚠️ I noticed: [any warnings].

Do you want me to proceed?"
```
- Shows all accumulated data
- Highlights any issues
- Waits for confirmation

### 6. Confirm Entry
```
You: "Yes" (or "Proceed", "Continue", etc.)
AI: "✅ Data entered successfully! Say 'add new line' to continue."
```
- Data is entered into database
- Accumulated data cleared
- Ready for next line

### 7. Repeat Process
```
You: "Add new line"
AI: "✅ Created new blank line L2. You can now speak the data for this line."

You: "Beam, W14x30, 3 pieces, 25 feet"
AI: "I've added to line L2: [details]... Say 'enter' when ready."

You: "Enter"
AI: "I will be entering... Do you want me to proceed?"

You: "Proceed"
AI: "✅ Data entered successfully!"
```

## Commands Reference

### Primary Commands
- **"Hey Quant"** - Wake up AI
- **"Add new line"** - Create blank line, start accumulating data
- **"Enter"** or **"Enter data"** - Show confirmation, wait for proceed
- **"Edit"** - Ask what to edit
- **"Edit [X] to [Y]"** - Edit specific field (e.g., "Edit W12x24 to W12x12")

### Confirmation Responses
- **"Yes"**, **"Proceed"**, **"Continue"**, **"Go ahead"**, **"Ok"**, **"Sure"**
- **"No"**, **"Wrong"**, **"Change"**, **"Cancel"** - Reject and ask for correction

### Data Entry
- Speak naturally: "Column, W12x24, 5 pieces, 20 feet"
- Data accumulates in chat
- Can speak multiple times to add more fields
- Say "enter" when ready

## Example Complete Session

```
You: "Hey Quant"
AI: "Hello! Ready to estimate when you are. What would you like to add?"

You: "Add new line"
AI: "✅ Created new blank line L1. You can now speak the data for this line."

You: "Column, W12x24, 5 pieces, 20 feet"
AI: "I've added to line L1:
• Item: Column
• Size: W12X24
• Quantity: 5
• Length: 20 ft
Say 'enter' when ready to save this data."

You: "Edit W12x24 to W12x12"
AI: "I've updated line L1:
• sizeDesignation: W12X12
Say 'enter' when ready to save."

You: "Enter"
AI: "I will be entering the following data:
• Item: Column
• Size: W12X12
• Quantity: 5
• Length: 20 ft
Do you want me to proceed?"

You: "Yes"
AI: "✅ Data entered successfully! Say 'add new line' to continue."

You: "Add new line"
AI: "✅ Created new blank line L2. You can now speak the data for this line."

[Process repeats...]
```

## Key Features

1. **Incremental Data Entry** - Build up data piece by piece
2. **Visual Feedback** - See all data in chat before entering
3. **Edit Before Entering** - Correct mistakes before saving
4. **Confirmation Required** - Always confirms before entering
5. **Clear Workflow** - Each step is clear and predictable

## Benefits

- ✅ **No accidental entries** - Data only entered after confirmation
- ✅ **Easy corrections** - Edit before entering
- ✅ **Visual tracking** - See all data in chat
- ✅ **Natural flow** - Speak naturally, build incrementally
- ✅ **Error prevention** - Warnings for missing data

This workflow gives you full control over data entry with a natural, conversational interface!

