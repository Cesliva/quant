# Setup Firebase Storage CORS - Exact Commands

## Problem
Firebase Storage is blocking uploads from `http://localhost:3000` due to CORS policy. The Firebase Storage SDK requires CORS to be configured on the bucket.

## Solution: Configure CORS with gsutil

### Prerequisites
1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
2. Authenticate: `gcloud auth login`
3. Set your project: `gcloud config set project quant-80cff`

### Step 1: Create CORS Configuration File

Create a file named `cors.json` in your project root with this content:

```json
[
  {
    "origin": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "https://quantsteel.com",
      "https://www.quantsteel.com"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "x-goog-resumable"]
  }
]
```

### Step 2: Apply CORS Configuration

Run this command (replace with your actual bucket name if different):

```bash
gsutil cors set cors.json gs://quant-80cff.firebasestorage.app
```

### Step 3: Verify CORS is Set

```bash
gsutil cors get gs://quant-80cff.firebasestorage.app
```

You should see the CORS configuration you just set.

### Step 4: Test

1. Wait 1-2 minutes for changes to propagate
2. Hard refresh your browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Try uploading a logo again

## Alternative: Using Google Cloud Console (Web UI)

If you don't have gsutil installed:

1. Go to: https://console.cloud.google.com/storage/browser/quant-80cff.firebasestorage.app?project=quant-80cff
2. Click the **"Configuration"** tab
3. Scroll to **"Cross-origin resource sharing (CORS)"**
4. Click **"Edit CORS configuration"**
5. Paste the JSON from Step 1 above
6. Click **"Save"**

## Troubleshooting

### Still seeing CORS errors?

1. **Verify bucket name**: Check `.env.local` for `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
2. **Wait 2-3 minutes**: CORS changes can take time to propagate
3. **Clear browser cache**: CORS settings are cached aggressively
4. **Check Network tab**: The OPTIONS request should return 200, not be blocked

### Verify CORS is working

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try uploading a logo
4. Look for the **OPTIONS** request to `firebasestorage.googleapis.com`
5. It should return **status 200** (not blocked)
6. The actual upload should also succeed

## Why This Is Required

Firebase Storage SDK uses XMLHttpRequest internally, which requires CORS to be configured on the bucket. This is a one-time setup per bucket.

