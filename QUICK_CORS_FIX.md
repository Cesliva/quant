# Quick CORS Fix for Avatar Upload

## The Problem
You're seeing CORS errors when uploading avatars. The upload gets stuck because Firebase Storage is blocking requests from `http://localhost:3000`.

## Easiest Fix: Use Google Cloud Console (Web UI)

**This is the fastest way - no command line needed!**

### Step 1: Go to Google Cloud Console
1. Open: https://console.cloud.google.com/
2. Make sure you're logged in with the same Google account used for Firebase
3. Select your Firebase project from the dropdown at the top

### Step 2: Navigate to Storage
1. In the left sidebar, click **"Cloud Storage"** > **"Buckets"**
   - Or go directly to: https://console.cloud.google.com/storage/browser
2. Find your bucket: **`quant-80cff.firebasestorage.app`**
   - (This is the bucket name from your error messages)
3. Click on the bucket name

### Step 3: Configure CORS
1. Click the **"Configuration"** tab at the top
2. Scroll down to **"Cross-origin resource sharing (CORS)"**
3. Click **"Edit CORS configuration"** button
4. **Delete any existing CORS configuration** (if present)
5. Paste this JSON:

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

6. Click **"Save"**

### Step 4: Wait and Test
1. Wait 1-2 minutes for changes to propagate
2. **Hard refresh your browser**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Try uploading an avatar again

## Alternative: Using Command Line (if you have gsutil)

If you have Google Cloud SDK installed:

```bash
# 1. Authenticate
gcloud auth login

# 2. Set your project
gcloud config set project quant-80cff

# 3. Apply CORS
gsutil cors set storage-cors.json gs://quant-80cff.firebasestorage.app

# 4. Verify it worked
gsutil cors get gs://quant-80cff.firebasestorage.app
```

## Still Not Working?

1. **Check the bucket name is correct** - it should be `quant-80cff.firebasestorage.app`
2. **Clear browser cache completely** - CORS settings are cached
3. **Wait 2-3 minutes** - CORS changes can take time to propagate
4. **Check you're using the right origin** - Make sure you're accessing the app at exactly `http://localhost:3000` (not 3001 or another port)

## Verify CORS is Set

After applying CORS, you can verify it's working by:

1. Opening browser DevTools (F12)
2. Going to the Network tab
3. Trying to upload an avatar
4. Looking for the OPTIONS request (preflight) - it should return status 200
5. The actual upload request should also return 200, not be blocked

If you still see CORS errors after following these steps, the bucket name might be different. Check your `.env.local` file for `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` to get the exact bucket name.

