# Seed Data for Testing

This document explains how to use the sample data seeding feature to populate your Quant database with realistic test data.

## Overview

The seed data feature creates a comprehensive mid-year scenario for an **$8 million annual revenue steel fabrication shop**. This includes:

- **12 Projects** in various states (won, active, lost)
- **Hundreds of estimating lines** with realistic steel fabrication data
- **Historical data** spanning the past 6 months
- **Realistic project types**: Commercial, Industrial, Infrastructure, Healthcare, Education, etc.

## What Gets Created

### Projects Breakdown

1. **Won Projects (Completed or in production)** - ~$2.5M
   - Downtown Office Complex - Phase 2 ($485K)
   - Industrial Warehouse - Main Structure ($620K)
   - Bridge Rehabilitation - Deck Replacement ($890K)

2. **Active Bids (In estimating or submitted)** - ~$3.5M
   - Tech Campus - Building A ($750K)
   - Manufacturing Facility Expansion ($520K)
   - Multi-Family Residential - Tower 3 ($680K)
   - Hospital Addition - Emergency Wing ($950K)
   - Distribution Center - Phase 1 ($580K)

3. **Won But Not Started** - ~$1.2M
   - Retail Complex - Anchor Store ($420K)
   - School Addition - Gymnasium ($380K)
   - Parking Structure - Level 2-4 ($450K)

4. **Lost Projects (For win/loss analysis)** - ~$800K
   - Office Tower - Core & Shell ($1.2M)
   - Warehouse - Automated Storage ($580K)

### Estimating Lines

Each project includes realistic estimating lines with:
- **Columns**: W-shapes (W12x65, W14x90, W16x100, etc.)
- **Beams**: Various sizes (W16x40, W18x50, W21x62, etc.)
- **Plates**: Base plates, gussets, stiffeners, clips
- **Misc Metals**: HSS, channels, angles, connections

Each line includes:
- Material costs (calculated from weight × rate)
- Labor hours and costs
- Coating systems (Paint, Galvanized, Powder, None)
- Proper weight calculations
- Realistic quantities and dimensions

## How to Use

### Method 1: Via UI (Recommended)

1. Navigate to **Settings → Seed Data** in your dashboard
2. Review what will be created
3. Click **"Generate Sample Data"**
4. Wait for the process to complete (may take 30-60 seconds)
5. You'll see a confirmation with the number of projects and lines created

### Method 2: Via API

```bash
curl -X POST http://localhost:3000/api/seed-data \
  -H "Content-Type: application/json" \
  -d '{"companyId": "YOUR_COMPANY_ID"}'
```

### Method 3: Via Script (Advanced)

If you have Node.js and TypeScript set up:

```bash
# Set your company ID
export COMPANY_ID=your_company_id

# Run the seed script
npx ts-node scripts/seedMidYearData.ts
```

## Data Characteristics

### Material Rates
- Material: $0.85/lb
- Labor: $45.00/hr
- Paint: $2.50/sf
- Galvanizing: $0.55/lb

### Project Timeline
- Projects span the past 6 months
- Realistic bid dates, decision dates, and delivery dates
- Fabrication windows aligned with project schedules

### Realistic Variations
- Project values range from $380K to $1.2M
- Win probabilities vary (40-100%)
- Competition levels: low, medium, high, very-high
- Various locations in the Pacific Northwest

## Use Cases

This seed data is perfect for testing:

1. **Dashboard Analytics**
   - Pipeline value calculations
   - Win rate analysis
   - Cost trend streamgraphs
   - Executive KPIs

2. **Project Management**
   - Project status tracking
   - Estimating workflows
   - Budget vs. actual comparisons

3. **Reporting**
   - PDF exports
   - CSV exports
   - Win/loss reports
   - Cost analysis reports

4. **Features**
   - Spec review
   - AI estimating
   - Cost trend analysis
   - Backlog management

## Notes

- **This creates real data** in your Firestore database
- Projects are created with realistic timestamps
- Estimating lines are properly calculated with costs
- All data follows Quant's data structure and validation rules
- You can delete the seeded projects manually if needed

## Troubleshooting

### "companyId is required" error
- Ensure you're logged in
- Check that your company ID is valid
- Try refreshing the page

### "Failed to seed data" error
- Check your Firebase configuration
- Ensure you have write permissions
- Check the browser console for detailed errors

### Data not appearing
- Refresh your dashboard
- Check that projects aren't filtered out
- Verify your company ID matches

## Customization

To customize the seed data:

1. Edit `app/api/seed-data/route.ts`
2. Modify the `PROJECTS` array
3. Adjust material rates at the top of the file
4. Customize line generators (`createColumnLine`, `createBeamLine`, etc.)

## Support

If you encounter issues or need help customizing the seed data, check:
- Firebase console for data creation
- Browser console for errors
- Network tab for API responses






