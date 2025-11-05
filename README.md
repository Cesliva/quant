# Quant Steel Estimating App

A Next.js + Firebase + OpenAI web application for steel fabrication estimating with AI-powered features.

## Features

- Voice transcription for estimate input (OpenAI Whisper API)
- AI-driven spec compliance review (GPT-4)
- Automated proposal generation from project summaries (GPT-4)
- Dynamic estimating grid with editable materials, plates, labor, and coatings
- Firestore backend with AI cost tracking and project management

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, TailwindCSS
- **Backend**: Firebase (Firestore, Cloud Functions, Storage)
- **AI Integration**: OpenAI GPT-4, Whisper
- **Hosting**: Vercel or Firebase Hosting

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- OpenAI API key

### Setup Steps

1. **Install dependencies:**
```bash
npm install
```

2. **Set up Firebase:**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Firestore Database
   - Enable Authentication (Email/Password)
   - Copy your Firebase config values

3. **Set up environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Firebase configuration values
   - Add your OpenAI API key

4. **Deploy Firestore security rules:**
```bash
firebase deploy --only firestore:rules
```

5. **Install Firebase Functions dependencies (optional, for Cloud Functions):**
```bash
cd functions
npm install
cd ..
```

6. **Run the development server:**
```bash
npm run dev
```

7. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

### Firebase Functions Setup

To use Cloud Functions instead of API routes:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init functions`
4. Deploy: `firebase deploy --only functions`

### Project Structure

```
/app                    # Next.js app directory
  /(dashboard)          # Protected dashboard routes
    /settings           # Company settings
    /projects/[id]      # Project-specific pages
      /estimating       # Estimating grid with voice input
      /spec-review      # AI spec compliance review
      /proposal         # Proposal generator
    /reports            # Reports dashboard
/components
  /ui                   # Reusable UI components
  /estimating           # Estimating-specific components
  /layout               # Layout components
/lib
  /firebase             # Firebase configuration
  /openai               # OpenAI service layer
  /hooks                # Custom React hooks
  /utils                # Utility functions
/functions              # Firebase Cloud Functions
/public                 # Static assets
```

## Development Phases

- **Phase 0**: Core UI (Settings, Project Details, Grid, KPI) ✅
- **Phase 1**: AI Integration (Voice, Spec Review, Proposal) ✅
- **Phase 2**: Reporting & Audit Trail (Reports ✅, Audit Trail pending)
- **Phase 3**: Optimization & Advanced Features (PWA, Multi-user, etc.)

## Current Status

✅ **Completed Features:**
- Next.js 14+ setup with TypeScript and TailwindCSS
- Firebase integration (Firestore, Auth, Storage)
- Dashboard layout with sidebar navigation
- Settings and Project Defaults screens
- Project Details form
- Estimating Grid with real-time Firestore sync
- KPI Summary ribbon
- Voice transcription with Whisper API
- AI Spec Review with GPT-4
- Proposal Generator with GPT-4o-mini
- AI Cost Tracking
- Reports dashboard
- Firebase Cloud Functions setup

🔄 **Pending Features:**
- Audit Trail system
- CSV/PDF export functionality
- File upload and text extraction for spec review
- Voice transcription line parsing
- Enhanced authentication flow
- Multi-user collaboration
- PWA offline support

