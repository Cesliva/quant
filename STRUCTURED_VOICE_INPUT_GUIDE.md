# Structured Voice Input Guide

## Overview
The voice input system now uses a **structured format** that requires you to speak field names before values. This prevents random data from being entered and gives you full control over what gets added to each line.

## How It Works

1. **Start with Context**: Say "Material" or "Labor" to set the context
2. **Speak Field Names**: Say the column/field name, then the value
3. **Accumulate Data**: The system builds up the line item as you speak
4. **Say "Enter"**: When ready, say "Enter" to process and create the line

## Examples

### Material Entry
```
"Material, Category, Columns, Shape, W, Size, W10X15, Quantity, 5, Length, 15 feet, Enter"
```

This will create a line with:
- Category: Columns
- Shape: W
- Size: W10X15
- Quantity: 5
- Length: 15 feet

### Labor Entry
```
"Labor, Welding, 1 hour 15 minutes, Handling, 15 minutes, Enter"
```

This will create a line with:
- laborWeld: 1.25 hours
- laborHandleMove: 0.25 hours

### Mixed Entry (Material then Labor)
```
"Material, Category, Beams, Shape, W, Size, W12X26, Quantity, 3, Length, 20 feet, Labor, Welding, 2 hours, Enter"
```

## Field Names You Can Say

### Material Fields
- **Category** → Sets the category (Columns, Beams, Misc Metals, Plates)
- **Subcategory** or **Sub Category** → Sets subcategory
- **Shape** → Sets shape type (W, HSS, C, L, T)
- **Size** → Sets size designation (e.g., W10X15)
- **Grade** → Sets material grade (e.g., A992)
- **Quantity** or **Qty** → Sets quantity
- **Length** or **Feet** → Sets length in feet
- **Inches** → Sets length in inches
- **Thickness** or **Thick** → Sets plate thickness
- **Width** → Sets plate width
- **Plate Length** → Sets plate length
- **Plate Quantity** or **Plate Qty** → Sets plate quantity
- **Plate Grade** → Sets plate grade
- **Coating** → Sets coating system (Paint, Powder, Galv, None)
- **Item** or **Description** → Sets item description
- **Drawing** or **Drawing Number** → Sets drawing number
- **Detail** or **Detail Number** → Sets detail number

### Labor Fields
- **Unload** or **Unloading** → Sets unloading hours
- **Cut** or **Cutting** → Sets cutting hours
- **Cope** or **Coping** → Sets coping hours
- **Process** or **Process Plate** → Sets process plate hours
- **Drill** or **Punch** or **Drill Punch** → Sets drill/punch hours
- **Fit** or **Fitting** → Sets fitting hours
- **Weld** or **Welding** → Sets welding hours
- **Prep** or **Clean** or **Prep Clean** → Sets prep/clean hours
- **Paint** or **Painting** → Sets painting hours
- **Handle** or **Move** or **Handling** or **Handle Move** → Sets handling hours
- **Load** or **Ship** or **Load Ship** → Sets load/ship hours

## Time Formats for Labor

You can say labor hours in multiple formats:
- "1 hour 15 minutes" → 1.25 hours
- "2 hours" → 2.0 hours
- "30 minutes" → 0.5 hours
- "1.5 hours" → 1.5 hours

## Tips

1. **Visual Feedback**: Watch the "Accumulated" section in the voice HUD to see what data is being built up
2. **Context Switching**: You can switch between "Material" and "Labor" in the same entry
3. **Field Order**: You can say fields in any order
4. **Multiple Values**: You can update the same field multiple times (last value wins)
5. **Enter Command**: Always say "Enter" when you're done with a line

## Troubleshooting

- **Data not appearing?** Make sure you said "Enter" at the end
- **Wrong field?** Check that you said the field name clearly before the value
- **Context lost?** Say "Material" or "Labor" again to reset the context

