# Firebase Storage CORS Configuration Guide

## Problem
You're seeing CORS errors when trying to upload files (like avatars) to Firebase Storage:
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

This happens because Firebase Storage buckets don't allow cross-origin requests by default.

## Solution: Configure CORS for Firebase Storage

### Option 1: Using gsutil (Recommended)

1. **Install Google Cloud SDK** (if not already installed):
   - Download from: https://cloud.google.com/sdk/docs/install
   - Or use: `curl https://sdk.cloud.google.com | bash`

2. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   ```

3. **Set your Firebase project**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
   Replace `YOUR_PROJECT_ID` with your Firebase project ID (from `.env.local` as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`)

4. **Apply CORS configuration**:
   ```bash
   gsutil cors set storage-cors.json gs://YOUR_STORAGE_BUCKET
   ```
   Replace `YOUR_STORAGE_BUCKET` with your storage bucket name (from `.env.local` as `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`)

   Example:
   ```bash
   gsutil cors set storage-cors.json gs://quant-80cff.firebasestorage.app
   ```

5. **Verify CORS configuration**:
   ```bash
   gsutil cors get gs://YOUR_STORAGE_BUCKET
   ```

### Option 2: Using Google Cloud Console (Web UI)

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Select your Firebase project

2. **Navigate to Cloud Storage**:
   - Go to "Cloud Storage" > "Buckets" in the left sidebar
   - Or visit: https://console.cloud.google.com/storage/browser

3. **Select your Firebase Storage bucket**:
   - Find your bucket (usually named like `your-project-id.appspot.com` or `your-project-id.firebasestorage.app`)
   - Click on the bucket name

4. **Configure CORS**:
   - Click on the "Configuration" tab
   - Scroll down to "Cross-origin resource sharing (CORS)"
   - Click "Edit CORS configuration"
   - Paste the following JSON:
   ```json
   [
     {
       "origin": ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "https://quantsteel.com", "https://www.quantsteel.com"],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Authorization", "Content-Length", "x-goog-resumable"]
     }
   ]
   ```
   - Click "Save"

### Option 3: Using Firebase CLI (Alternative)

If you have Firebase CLI installed:

1. **Install Firebase CLI** (if not installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Use gsutil through Firebase**:
   ```bash
   firebase projects:list  # List your projects
   gsutil cors set storage-cors.json gs://YOUR_STORAGE_BUCKET
   ```

## Verify It's Working

After configuring CORS:

1. **Restart your development server**:
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

2. **Try uploading an avatar**:
   - Go to Settings > My Profile
   - Try uploading a profile picture
   - Check the browser console - CORS errors should be gone

3. **Check the Network tab**:
   - Open browser DevTools > Network tab
   - Try uploading again
   - Look for requests to `firebasestorage.googleapis.com`
   - They should now succeed (status 200) instead of being blocked

## Troubleshooting

### Still seeing CORS errors?

1. **Check your bucket name**:
   - Make sure you're using the correct bucket name from `.env.local`
   - It should match `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

2. **Verify CORS is set**:
   ```bash
   gsutil cors get gs://YOUR_STORAGE_BUCKET
   ```
   Should show your CORS configuration

3. **Clear browser cache**:
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

4. **Check origin matches**:
   - Make sure your localhost URL matches exactly (including port)
   - If you're using a different port, add it to `storage-cors.json`

5. **Wait a few minutes**:
   - CORS changes can take a few minutes to propagate

### Adding more origins

If you need to add more origins (like staging URLs), edit `storage-cors.json`:

```json
[
  {
    "origin": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "https://quantsteel.com",
      "https://www.quantsteel.com",
      "https://staging.quantsteel.com"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "x-goog-resumable"]
  }
]
```

Then re-apply:
```bash
gsutil cors set storage-cors.json gs://YOUR_STORAGE_BUCKET
```

## Security Note

⚠️ **Important**: The CORS configuration allows requests from localhost and your production domains. This is necessary for development and production, but make sure your Firebase Storage security rules are properly configured to restrict access to authenticated users only.

Check your `firestore.rules` file to ensure Storage rules are secure.

