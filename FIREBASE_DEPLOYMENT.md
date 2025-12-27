# Deployment Guide: Firebase Hosting

## Prerequisites

1. Firebase account (free)
2. Firebase CLI installed: `npm install -g firebase-tools`
3. Build the app first: `npm run build`

## Initial Setup (One-time)

```bash
# 1. Login to Firebase
firebase login

# 2. Initialize Firebase Hosting
firebase init hosting

# When prompted:
# - Select existing project or create new one
# - Public directory: dist
# - Single-page app: Yes
# - GitHub Actions: No (optional)
# - Overwrite index.html: No

# This creates:
# - firebase.json (hosting configuration)
# - .firebaserc (project settings)
```

## Build and Deploy

```bash
# 1. Build production bundle
npm run build

# 2. Preview locally (optional)
firebase serve

# 3. Deploy to Firebase
firebase deploy --only hosting

# You'll get URLs:
# - https://PROJECT-ID.web.app
# - https://PROJECT-ID.firebaseapp.com
```

## Deploy Updates

After making changes:

```bash
npm run build
firebase deploy --only hosting
```

## Environment Variables

For Firebase Hosting, vite will use variables from `.env`:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PROJECT_ID  
- VITE_SUPABASE_PUBLISHABLE_KEY

## Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow DNS setup instructions

## Important Notes

- Firebase Hosting uses ROOT path (no /Quick-Ride-/)
- Update vite.config.ts to use root base path for Firebase
- Backend still needs separate deployment (Render/Railway)
- Free tier: 10GB storage, 360MB/day transfer
