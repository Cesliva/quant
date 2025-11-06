# Real Data Testing Guide

## Setup Complete ✅

The application has been updated to use real Firebase and OpenAI data. All `USE_SAMPLE_DATA` flags have been set to `false`.

## Environment File Security

Your `.env.local` file is properly secured:
- ✅ Listed in `.gitignore` (won't be committed to git)
- ✅ Contains sensitive credentials (Firebase config + OpenAI API key)

**Important:** Never commit `.env.local` to version control. It's already in `.gitignore`, but double-check before pushing.

## Files Updated

The following files have been updated to use real data:

1. ✅ `app/(dashboard)/reports/page.tsx` - `USE_SAMPLE_DATA = false`
2. ✅ `app/(dashboard)/estimating/page.tsx` - `USE_SAMPLE_DATA = false` + Firebase loading added
3. ✅ `app/(dashboard)/projects/[id]/estimating/page.tsx` - `USE_SAMPLE_DATA = false`

## Next Steps: Testing with Real Data

### 1. Restart Development Server

After updating environment variables, always restart the dev server:

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

### 2. Initialize Firestore Data Structure

Before testing, create the initial Firestore structure:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to Firestore Database
3. Create collection: `companies`
4. Create document with ID: `default`
5. Add initial data:
   ```json
   {
     "name": "Your Company Name",
     "members": {}
   }
   ```

### 3. Create a Test Project

1. In Firestore, create collection: `companies/default/projects`
2. Create a test project document (e.g., ID: `test-project-1`)
3. Add basic fields:
   ```json
   {
     "projectName": "Test Project",
     "projectNumber": "TEST-001",
     "status": "active",
     "createdAt": "2024-01-01T00:00:00Z"
   }
   ```

### 4. Test Each Feature

#### A. Settings Page
- Navigate to: `http://localhost:3000/settings`
- Fill in company information
- Click "Save All Settings"
- **Verify:** Check Firestore Console → `companies/default/settings` for saved data

#### B. Project Details
- Navigate to: `http://localhost:3000/projects/test-project-1`
- Edit project details
- Click "Save Project"
- **Verify:** Check Firestore Console → `companies/default/projects/test-project-1` for updates

#### C. Estimating Grid
- Navigate to: `http://localhost:3000/estimating?projectId=test-project-1`
- Click "Add Line" button
- Fill in estimating line data
- Save the line
- **Verify:** Check Firestore Console → `companies/default/projects/test-project-1/lines` for new line item
- Edit and delete lines to test CRUD operations

#### D. Voice Transcription
- On estimating page, toggle off "Manual Entry"
- Click "Start Recording"
- Allow microphone permissions
- Speak: "Add 5 W12x26 beams, 20 feet long, A992 grade"
- Click "Stop Recording"
- **Verify:** 
  - Transcription appears in console
  - Check Firestore → `companies/default/projects/test-project-1/aiLogs` for usage log
  - Check OpenAI dashboard for API usage

#### E. Spec Review
- Navigate to: `http://localhost:3000/spec-review`
- Paste specification text
- Click "Analyze Specifications"
- **Verify:**
  - Analysis results display
  - AI usage logged in Firestore
  - OpenAI API call successful (check console)

#### F. Proposal Generation
- Navigate to: `http://localhost:3000/proposal`
- Enter project summary
- Click "Generate Proposal"
- **Verify:**
  - Proposal text displays
  - AI usage logged in Firestore
  - OpenAI API call successful

#### G. Reports
- Navigate to: `http://localhost:3000/reports?projectId=test-project-1`
- **Verify:**
  - Summary cards show correct totals from Firestore data
  - Material breakdown displays
  - Cost analysis shows correct values
  - Line item report shows all lines
  - AI usage dashboard shows logged calls

## Troubleshooting

### Issue: "Firebase not configured" warning
**Solution:**
- Verify `.env.local` has all Firebase variables with real values (no placeholders)
- Check that values don't contain "test_key", "your_", or "placeholder"
- Restart dev server after changing `.env.local`

### Issue: Firestore permission denied
**Solution:**
- Ensure Firestore is in "test mode" for development
- Or deploy security rules: `firebase deploy --only firestore:rules`
- Check that `companyId` matches your Firestore structure

### Issue: No data appears
**Solution:**
- Check browser console for errors
- Verify Firestore structure matches expected paths
- Ensure project ID exists in Firestore
- Check that `companyId = "default"` matches your Firestore document ID

### Issue: OpenAI API errors
**Solution:**
- Verify API key is correct in `.env.local`
- Check API key starts with "sk-"
- Ensure payment method is added to OpenAI account
- Check OpenAI dashboard for API usage and errors

### Issue: Voice transcription fails
**Solution:**
- Check browser console for errors
- Verify microphone permissions granted
- Ensure using HTTPS or localhost (required for mic access)
- Check OpenAI API key is valid

## Verification Checklist

- [ ] Dev server restarted after `.env.local` changes
- [ ] Firebase Console shows Firestore database created
- [ ] `companies/default` document exists in Firestore
- [ ] Test project created in `companies/default/projects`
- [ ] Browser console shows no "Firebase not configured" warnings
- [ ] Settings page saves data to Firestore
- [ ] Project details page saves data to Firestore
- [ ] Estimating grid loads and saves lines to Firestore
- [ ] Voice transcription works and logs to Firestore
- [ ] Spec review works and logs to Firestore
- [ ] Proposal generation works and logs to Firestore
- [ ] Reports page displays data from Firestore

## Expected Firestore Structure

```
companies/
  └── default/
      ├── (company document)
      ├── settings/
      │   └── (settings document)
      └── projects/
          └── {projectId}/
              ├── (project document)
              ├── lines/
              │   └── {lineId}/
              │       └── (line document)
              └── aiLogs/
                  └── {logId}/
                      └── (AI usage log)
```

## Next Steps After Testing

1. **Create Real Projects:** Add actual project data through the UI
2. **Configure Company Settings:** Set up labor rates, material costs, etc.
3. **Test Voice Input:** Use real voice commands to add estimating lines
4. **Generate Reports:** Create reports from real project data
5. **Deploy Security Rules:** For production, deploy proper Firestore security rules

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Firestore Console for data structure
3. Verify environment variables are correct
4. Ensure Firebase and OpenAI services are accessible

Happy testing! 🚀

