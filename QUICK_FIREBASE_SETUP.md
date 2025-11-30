# Quick Firebase Setup Guide

## The Error
You're seeing: "Firebase is not configured. Please set valid Firebase credentials in .env.local"

This means your `.env.local` file either doesn't exist or has placeholder/invalid values.

## Quick Fix (5 minutes)

### Step 1: Create/Update `.env.local`

1. Open `.env.local` in your project root (create it if it doesn't exist)
2. Add these variables with your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
OPENAI_API_KEY=sk-...
```

### Step 2: Get Your Firebase Credentials

If you don't have Firebase set up yet:

1. **Go to [Firebase Console](https://console.firebase.google.com/)**
2. **Create a new project** (or select existing)
   - Click "Add project"
   - Enter project name: "Quant AI" (or your choice)
   - Click "Continue"
   - Disable Google Analytics (optional)
   - Click "Create project"

3. **Enable Firestore Database**
   - Click "Firestore Database" in left sidebar
   - Click "Create database"
   - Select "Start in test mode"
   - Choose location (closest to you)
   - Click "Enable"

4. **Enable Authentication**
   - Click "Authentication" in left sidebar
   - Click "Get started"
   - Click "Email/Password"
   - Enable it
   - Click "Save"

5. **Get Your Config Values**
   - Click the ⚙️ gear icon → "Project settings"
   - Scroll to "Your apps" section
   - If no web app exists, click "</>" (Web icon)
   - Register app with nickname: "Quant Web App"
   - Copy the config values

6. **Update `.env.local`**
   - Replace the placeholder values with your actual Firebase config
   - Make sure all values start with `NEXT_PUBLIC_` (except `OPENAI_API_KEY`)

### Step 3: Restart Development Server

**Important:** After updating `.env.local`, you MUST restart the dev server:

1. Stop the server (Ctrl+C in terminal)
2. Start it again: `npm run dev:3001`

### Step 4: Test

1. Go to `http://localhost:3001/signup`
2. Create your account (you'll automatically be set as admin)
3. Should work now! ✅

## Troubleshooting

### "Still getting Firebase not configured"
- ✅ Check `.env.local` exists in project root (same folder as `package.json`)
- ✅ Verify all `NEXT_PUBLIC_*` variables are set
- ✅ Make sure values don't contain quotes (just the value)
- ✅ Restart the dev server after changes
- ✅ Check for typos in variable names

### "Where is my .env.local file?"
- It's in the root directory: `D:\Quant\.env.local`
- If it doesn't exist, create it
- You can copy from `.env.local.example` if it exists

### "I don't want to set up Firebase right now"
- You can still view the landing page and UI
- But login/signup won't work without Firebase
- For full functionality, Firebase is required

## Need Help?

Check the full guide: `FIREBASE_SETUP_GUIDE.md`

