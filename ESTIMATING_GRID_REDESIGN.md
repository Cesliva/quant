# Estimating Grid Redesign - Implementation Status

## Completed Components

### 1. AISC Shapes Utility (`lib/utils/aiscShapes.ts`)
- ✅ Loads AISC JSON database
- ✅ Filters shapes by type
- ✅ Gets weight per foot and surface area per foot
- ✅ Provides valid grades by shape type

### 2. Plate Helper Utility (`lib/utils/plateHelper.ts`)
- ✅ Calculates plate area (sf)
- ✅ Calculates edge perimeter (ft)
- ✅ Calculates surface area for coating (sf)
- ✅ Calculates total weight (lb)
- ✅ Handles one-side vs two-side coating

### 3. Expanded EstimatingLine Interface
- ✅ All identification fields (Line ID, Drawing #, Detail #, Item, Category, Sub-category)
- ✅ Material type selector (Rolled vs Plate)
- ✅ Rolled member fields (Shape Type, Size, Grade, Length, Weight, SA)
- ✅ Plate fields (Thickness, Width, Length, Area, Perimeter, SA, Weight)
- ✅ All labor fields (11 labor categories)
- ✅ All cost fields (Material, Labor, Coating rates and costs)
- ✅ Admin fields (Notes, Hashtags, Status, Stock Rounding toggle)

### 4. Calculation Logic
- ✅ Auto-calculates read-only fields when editing
- ✅ Rolled member calculations (weight, surface area from AISC)
- ✅ Plate calculations (area, perimeter, surface area, weight)
- ✅ Total labor calculation
- ✅ Cost calculations (material, labor, coating, total)
- ✅ Totals row calculations

## In Progress

### Full Table Implementation
The table structure with all columns, grouped headers, and visibility rules is being implemented. The grid will include:

1. **Grouped Headers**:
   - Identification (neutral tint)
   - Material - Rolled (blue tint, shown when type="Rolled")
   - Material - Plate (blue tint, shown when type="Plate")
   - Labor (green tint)
   - Cost (amber tint)
   - Admin (neutral tint)

2. **Sticky Columns**:
   - Line ID (sticky left)
   - Item/Description (sticky left)
   - Actions (sticky right)

3. **Visibility Rules**:
   - Show Rolled fields only when materialType = "Rolled"
   - Show Plate fields only when materialType = "Plate"
   - Hide opposite fields based on type

4. **Read-only Fields**:
   - All calculated fields (weight, SA, costs) are read-only
   - Clearly styled with gray background

5. **Dropdowns**:
   - Shape Type → filters Size/Designation dropdown
   - Category and Sub-category dropdowns
   - Coating System dropdown
   - Grade dropdown (filtered by shape type)

6. **Totals Row**:
   - Shows sums for all numeric columns
   - Excludes voided rows
   - Sticky at bottom

## Next Steps

1. Complete full table HTML structure with all columns
2. Implement inline editing with proper input types
3. Add sticky header and column CSS
4. Implement horizontal scroll with virtualization
5. Add stock rounding toggle badge
6. Style grouped headers with tinting
7. Test all calculations and visibility rules

## File Structure

```
components/estimating/
  ├── EstimatingGrid.tsx (main component - in progress)
  ├── aisc_shapes_database_filtered.json (AISC data)
lib/utils/
  ├── aiscShapes.ts (✅ Complete)
  └── plateHelper.ts (✅ Complete)
```

