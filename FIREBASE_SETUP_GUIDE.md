# Firebase Setup Guide for Quant

This guide will help you set up Firebase so that voice commands can save data to the database.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "Quant Steel Estimating")
4. Click **"Continue"**
5. (Optional) Disable Google Analytics if you don't need it
6. Click **"Create project"**
7. Wait for the project to be created, then click **"Continue"**

## Step 2: Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Select **"Start in test mode"** (we'll update security rules later)
4. Choose a location (select the closest to you)
5. Click **"Enable"**

## Step 3: Enable Authentication (Optional but Recommended)

1. Click **"Authentication"** in the left sidebar
2. Click **"Get started"**
3. Enable **"Email/Password"** provider
4. Click **"Save"**

## Step 4: Get Your Firebase Configuration

1. Click the **gear icon** (⚙️) next to "Project Overview" in the left sidebar
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. If you don't have a web app, click **"</>"** (Web icon) to add one
5. Register your app with a nickname (e.g., "Quant Web App")
6. Copy the configuration values (they look like this):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 5: Create Environment File

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   copy .env.local.example .env.local
   ```

2. Open `.env.local` in a text editor

3. Fill in your Firebase values:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy... (from firebaseConfig.apiKey)
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

4. Add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-... (get from https://platform.openai.com/api-keys)
   ```

## Step 6: Deploy Firestore Security Rules

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase (if not already done):
   ```bash
   firebase init
   ```
   - Select **Firestore** and **Hosting** (if you want)
   - Select your project
   - Use default file names

4. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

   **OR** for development, you can temporarily use open rules by updating `firestore.rules`:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Then deploy: `firebase deploy --only firestore:rules`

## Step 7: Restart Your Development Server

1. Stop your current dev server (Ctrl+C)
2. Start it again:
   ```bash
   npm run dev
   ```

## Step 8: Test Voice Commands

1. Open http://localhost:3000
2. Navigate to the Estimating page
3. Make sure "Voice Input" is enabled
4. Click "Start Recording"
5. Say: **"W12x65 column, 8 pieces, 20 feet"**
6. Click "Stop"
7. Check the browser console (F12) for logs
8. The line should appear in your estimating grid!

## Troubleshooting

### "Firebase is not configured" error
- Make sure `.env.local` exists and has all the required variables
- Restart your dev server after creating/updating `.env.local`
- Check that variable names start with `NEXT_PUBLIC_` for client-side access

### "Permission denied" error
- Make sure Firestore security rules are deployed
- For development, use the open rules shown in Step 6

### Voice commands transcribe but don't create lines
- Check browser console (F12) for error messages
- Verify Firebase is configured (should see no "Firebase not configured" warnings)
- Check that Firestore is enabled in Firebase Console

### Can't find Firebase config values
- Make sure you're looking at the **Web app** config (</> icon), not iOS/Android
- The config is in Project Settings > General > Your apps

## Next Steps

Once Firebase is set up:
- Voice commands will save to Firestore
- Data persists across page refreshes
- You can view data in Firebase Console > Firestore Database
- Multiple users can work on the same project (with proper auth setup)

