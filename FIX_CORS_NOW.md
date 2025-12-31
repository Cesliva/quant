# 🔴 URGENT: Fix CORS for Logo Upload

## The Problem
Your logo upload is failing because Firebase Storage is blocking requests from `http://localhost:3000` due to CORS (Cross-Origin Resource Sharing) policy.

## Quick Fix (5 minutes) - Use Google Cloud Console

### Step 1: Open Google Cloud Console
1. Go to: **https://console.cloud.google.com/**
2. Make sure you're logged in with the same Google account used for Firebase
3. Select your project: **quant-80cff** (from the dropdown at the top)

### Step 2: Navigate to Storage
1. In the left sidebar, click **"Cloud Storage"** → **"Buckets"**
   - Or go directly: https://console.cloud.google.com/storage/browser?project=quant-80cff
2. Find your bucket: **`quant-80cff.firebasestorage.app`**
3. **Click on the bucket name** to open it

### Step 3: Configure CORS
1. Click the **"Configuration"** tab at the top
2. Scroll down to **"Cross-origin resource sharing (CORS)"** section
3. Click **"Edit CORS configuration"** button
4. **Delete any existing CORS configuration** (if present)
5. **Paste this exact JSON:**

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
1. **Wait 1-2 minutes** for changes to propagate
2. **Hard refresh your browser**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. **Clear browser cache** if needed
4. Try uploading the logo again

## Alternative: Command Line (if you have gsutil)

If you have Google Cloud SDK installed:

```bash
# 1. Authenticate
gcloud auth login

# 2. Set your project
gcloud config set project quant-80cff

# 3. Apply CORS (using the storage-cors.json file in your project)
gsutil cors set storage-cors.json gs://quant-80cff.firebasestorage.app

# 4. Verify it worked
gsutil cors get gs://quant-80cff.firebasestorage.app
```

## Verify It's Fixed

After applying CORS:
1. Open browser DevTools (F12)
2. Go to the **Network** tab
3. Try uploading a logo
4. Look for requests to `firebasestorage.googleapis.com`
5. The **OPTIONS** request (preflight) should return **status 200** (not blocked)
6. The actual upload should also succeed

## Still Not Working?

1. **Double-check the bucket name** - Should be `quant-80cff.firebasestorage.app`
2. **Wait 2-3 minutes** - CORS changes can take time to propagate
3. **Clear browser cache completely** - CORS settings are cached aggressively
4. **Check your origin** - Make sure you're accessing the app at exactly `http://localhost:3000` (not a different port)
5. **Check the Network tab** - Look for the OPTIONS request failing (status 0 or CORS error)

## Why This Happens

Firebase Storage buckets don't allow cross-origin requests by default for security. You need to explicitly allow your development and production domains. This is a one-time setup that needs to be done in Google Cloud Console.

