# Testing Guide - Quant Steel Estimating App

## Quick Start (Minimal Setup for UI Testing)

You can run the app with minimal configuration to test the UI, even without Firebase/OpenAI fully configured.

### Step 1: Install Dependencies (if not already done)

```bash
npm install
```

### Step 2: Create Environment Variables File

Create a `.env.local` file in the root directory:

```bash
# Copy the example template
cp .env.local.example .env.local
```

Or create `.env.local` manually with at least these placeholder values for UI testing:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=test_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=test.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=test-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=test-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
OPENAI_API_KEY=sk-test-key
```

**Note:** These are placeholder values. The UI will load, but Firebase operations will fail. For full functionality, you'll need real Firebase credentials.

### Step 3: Start the Development Server

```bash
npm run dev
```

### Step 4: Open in Browser

Navigate to: **http://localhost:3000**

You should see:
- Home page with "Quant Estimating AI" title
- Basic UI elements loading

### Step 5: Test the UI (Navigate to Dashboard)

Since authentication isn't fully implemented, you can directly access dashboard routes:

- **Settings**: http://localhost:3000/settings
- **Project Details** (example): http://localhost:3000/projects/test-project
- **Estimating**: http://localhost:3000/projects/test-project/estimating
- **Spec Review**: http://localhost:3000/spec-review
- **Proposal**: http://localhost:3000/proposal
- **Reports**: http://localhost:3000/reports

## Full Setup (For Complete Functionality)

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Firestore Database** (Start in test mode for development)
4. Enable **Authentication** → Sign-in method → Email/Password
5. Get your Firebase config:
   - Go to Project Settings → General
   - Scroll to "Your apps" → Web app
   - Copy the config values

6. Update `.env.local` with real values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

7. Deploy Firestore security rules:

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

### 2. OpenAI Setup

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to `.env.local`:

```env
OPENAI_API_KEY=sk-your-actual-openai-key
```

### 3. Restart Development Server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Testing Each Feature

### 1. Settings Page
- Navigate to: `/settings`
- Fill in company defaults form
- Click "Save Settings"
- Check browser console for any errors

### 2. Project Details
- Navigate to: `/projects/test-project`
- Fill in project information
- Click "Save Project Details"
- Check console for Firestore operations

### 3. Estimating Grid
- Navigate to: `/projects/test-project/estimating`
- Click "Add Line" button
- Edit line items in the grid
- Check KPI summary updates
- Verify real-time Firestore sync (if configured)

### 4. Voice Transcription
- Navigate to: `/projects/test-project/estimating`
- Click "Start Recording" in Voice HUD
- Allow microphone permissions
- Speak some text
- Click "Stop Recording"
- Wait for transcription (requires OpenAI API key)

### 5. AI Spec Review
- Navigate to: `/spec-review`
- Paste specification text in textarea
- Click "Analyze Specifications"
- Wait for AI analysis (requires OpenAI API key)
- Review compliance status and RFI suggestions

### 6. Proposal Generator
- Navigate to: `/proposal`
- Enter project summary
- Click "Generate Proposal"
- Wait for AI generation (requires OpenAI API key)
- Review generated proposal

### 7. Reports
- Navigate to: `/reports`
- View summary cards
- Check AI usage statistics
- Test export buttons (placeholders)

## Troubleshooting

### Issue: "Firebase not initialized" errors
- **Solution**: Make sure `.env.local` has all Firebase config values

### Issue: API routes return 500 errors
- **Solution**: Check that `OPENAI_API_KEY` is set in `.env.local`
- Check server console for detailed error messages

### Issue: Cannot access microphone
- **Solution**: 
  - Allow browser permissions when prompted
  - Use HTTPS or localhost (required for microphone access)
  - Check browser console for permission errors

### Issue: Firestore permission denied
- **Solution**: 
  - Deploy security rules: `firebase deploy --only firestore:rules`
  - Or use Firestore test mode for development

### Issue: Port 3000 already in use
- **Solution**: 
  - Stop other Next.js servers
  - Or use: `npm run dev -- -p 3001`

## Browser Console Commands

Open browser DevTools (F12) and check:
- **Console tab**: For JavaScript errors
- **Network tab**: For API request failures
- **Application tab**: For Firebase connection status

## Expected Behavior

✅ **Working (with placeholders):**
- UI loads and renders correctly
- Navigation works
- Forms display properly
- Buttons are clickable

⚠️ **Requires Firebase:**
- Data persistence
- Real-time updates
- Authentication

⚠️ **Requires OpenAI:**
- Voice transcription
- Spec review analysis
- Proposal generation

## Next Steps After Testing

1. **Fix any UI issues** you discover
2. **Set up real Firebase project** for data persistence
3. **Add OpenAI API key** for AI features
4. **Implement authentication** for production use
5. **Add remaining features** (CSV export, PDF export, audit trail)

## Quick Test Checklist

- [ ] UI loads without errors
- [ ] Navigation sidebar works
- [ ] Settings page displays
- [ ] Project details form works
- [ ] Estimating grid displays
- [ ] KPI summary shows (with mock data)
- [ ] Voice HUD component renders
- [ ] Spec review page loads
- [ ] Proposal generator page loads
- [ ] Reports page displays
- [ ] No console errors (check browser DevTools)

Happy testing! 🚀

