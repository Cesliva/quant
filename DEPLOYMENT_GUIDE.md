# Deployment Guide for Quant AI

## Overview

Quant AI is a Next.js application that can be deployed to various platforms. This guide covers deployment options and setup.

## Recommended: Vercel (Best for Next.js)

Vercel is the recommended platform for Next.js applications as it provides:
- Automatic deployments
- Serverless functions
- Edge network
- Zero configuration

### Steps:

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your repository
   - Add environment variables:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
     - `OPENAI_API_KEY`
   - Click "Deploy"

3. **Configure Custom Domain** (Optional)
   - In Vercel dashboard, go to Settings > Domains
   - Add your custom domain
   - Follow DNS configuration instructions

## Alternative: Firebase Hosting (Static Export)

For Firebase Hosting, you need to use static export:

### Steps:

1. **Update next.config.js**
   ```javascript
   const nextConfig = {
     output: 'export',
     images: {
       unoptimized: true,
     },
     // ... rest of config
   };
   ```

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Deploy to Firebase**
   ```bash
   firebase deploy --only hosting
   ```

**Note:** Static export has limitations:
- No API routes (use Firebase Functions instead)
- No server-side rendering
- No dynamic routes at build time

## Alternative: Netlify

1. **Push to GitHub** (same as Vercel)

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up/login
   - Click "New site from Git"
   - Connect GitHub repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `.next`
   - Add environment variables (same as Vercel)
   - Click "Deploy site"

## Environment Variables

Make sure to set these in your hosting platform:

### Required:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `OPENAI_API_KEY`

### Optional:
- `NEXT_PUBLIC_APP_URL` - Your app's URL (for email links, etc.)

## Firebase Setup

1. **Enable Authentication**
   - Go to Firebase Console > Authentication
   - Enable "Email/Password" provider

2. **Deploy Firestore Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Set up Firestore Indexes** (if needed)
   ```bash
   firebase deploy --only firestore:indexes
   ```

## Post-Deployment Checklist

- [ ] Test user signup flow
- [ ] Test user login flow
- [ ] Verify Firebase Authentication is working
- [ ] Test creating a project
- [ ] Verify Firestore data is saving correctly
- [ ] Test AI features (spec review, proposal generation)
- [ ] Check that environment variables are set correctly
- [ ] Verify custom domain (if applicable)
- [ ] Test on mobile devices
- [ ] Set up error monitoring (Sentry, etc.)

## Troubleshooting

### "Firebase is not configured" error
- Check that all `NEXT_PUBLIC_*` environment variables are set
- Restart your deployment after adding variables

### Authentication not working
- Verify Email/Password provider is enabled in Firebase Console
- Check that `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` matches your Firebase project

### API routes not working (Firebase Hosting static export)
- Use Firebase Functions for API routes instead
- Or switch to Vercel/Netlify for full Next.js support

## Support

For issues or questions, check:
- Next.js documentation: https://nextjs.org/docs
- Firebase documentation: https://firebase.google.com/docs
- Vercel documentation: https://vercel.com/docs

