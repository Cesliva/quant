# Streamgraph Implementation Documentation

## Schema Discovery

### Firestore Paths
- **Estimating Lines:** `companies/{companyId}/projects/{projectId}/lines`
- **Projects:** `companies/{companyId}/projects`
- **Approved Budgets:** Stored in project document as `approvedBudget` field

### Data Structure

**EstimatingLine Interface:**
```typescript
{
  id?: string;
  lineId: string;
  category: string;              // Columns, Beams, Misc Metals, Plates, etc.
  subCategory: string;           // Base Plate, Gusset, Stiffener, Clip, etc.
  materialType: "Material" | "Plate";
  totalCost?: number;            // Read-only calculated
  totalWeight?: number;          // Read-only (for Material type)
  plateTotalWeight?: number;     // Read-only (for Plate type)
  totalLabor?: number;           // Read-only
  status?: "Active" | "Void";
  // ... other fields
}
```

**Timeline Dimension:**
- **Time-based:** Uses `updatedAt` or `createdAt` timestamps (grouped by month)
- **Version-based:** Uses `approvedBudget.version` and `approvedBudget.approvedAt`
- **Project-based:** Aggregates across all projects

**Baseline:**
- If approved budgets exist: First approved budget version
- Otherwise: First timeline point (first month or first project)

## Implementation Files

### 1. Adapter Layer (`lib/utils/estimateToStreamgraph.ts`)
- **Purpose:** Transform Quant's EstimatingLine schema to chart-ready format
- **Key Functions:**
  - `transformToChartPoints()`: Converts lines to ChartPoint array
  - `aggregateToSeries()`: Groups points into series for visualization
  - Supports multiple metrics: totalCost, costPerTon, laborHoursPerTon, pctOfTotal, varianceVsBaseline

### 2. Streamgraph Component (`components/dashboard/CostTrendStreamgraph.tsx`)
- **Features:**
  - Interactive streamgraph visualization (SVG-based)
  - Metric selector (5 different metrics)
  - Timeline mode selector (time/version/project)
  - Category/subcategory toggle
  - Legend with show/hide controls
  - Click-to-filter support
  - Responsive design

### 3. Insights Panel (`components/dashboard/CostTrendInsights.tsx`)
- **Local Analytics:**
  - **Top Movers:** Largest positive/negative variance by category
  - **Volatility Scores:** Standard deviation / mean per category
  - **Anomaly Detection:** Sudden jumps beyond threshold (Z-score based)
  - **Category Drivers:** Subcategories explaining most movement
- **AI Hook:** `generateNarrativeInsights()` function stub for future AI integration

### 4. Wrapper Component (`components/dashboard/CostTrendAnalysis.tsx`)
- **Purpose:** Aggregates data from all active projects
- **Features:**
  - Loads lines from all active projects
  - Subscribes to real-time updates
  - Combines streamgraph and insights in responsive layout

## Integration

### Dashboard Integration
Added to `app/(dashboard)/dashboard/page.tsx`:
- Positioned above "Backlog at a Glance" section
- Displays company-wide cost trends across all active projects

## Usage

### Viewing Cost Trends
1. Navigate to Company Dashboard
2. Scroll to "Cost Trend Analysis" section
3. Select metric (Total Cost, Cost per Ton, etc.)
4. Choose timeline mode (Time-based, Version-based, or Project-based)
5. Toggle category/subcategory view
6. Click legend items to show/hide categories
7. Click on chart bands to filter (if filter handler provided)

### Insights
- **Top Movers:** Shows categories with largest changes
- **Volatility:** Identifies most variable categories
- **Anomalies:** Flags unexpected changes
- **Drivers:** Explains which subcategories drive category movements

## Future Enhancements

### AI Integration
The `generateNarrativeInsights()` function in `CostTrendInsights.tsx` is ready for AI integration:
- Currently returns deterministic summary
- Can be hooked into Quant's existing AI service
- Should receive: points, metric, topMovers, volatility, anomalies
- Should return: narrative text explaining trends

### Click-to-Filter
The `onCategoryClick` callback is wired but needs implementation:
- Currently logs category/subcategory selection
- Can be connected to existing filtering mechanisms
- Should filter estimate tables/grids by selected category

### Performance Optimizations
- Memoization already implemented for transforms
- Consider virtualization for large datasets
- May need pagination for insights if data grows

## Notes

- **No Schema Guessing:** All field names match Quant's actual schema
- **Baseline Handling:** Uses first approved budget OR first data point
- **No Breaking Changes:** All new components, no modifications to existing code
- **Minimal Dependencies:** Uses SVG for visualization (no charting library required)

