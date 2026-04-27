// src/lib/firebaseConfig.js
// ─────────────────────────────────────────────────────────────
// SETUP STEPS (takes ~5 minutes):
//
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" → name it "goreadnini" → disable Google Analytics → Create
// 3. In the project dashboard → click "</>" (Web app) → name it "goreadnini" → Register app
// 4. Copy the firebaseConfig object values shown into your .env (see below)
// 5. In the left sidebar → Build → Firestore Database → Create database
//    → Start in "production mode" → choose a region close to Nigeria (europe-west1 or us-central1)
// 6. After Firestore creates → go to Rules tab → paste this and Publish:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /libraries/{deviceId}/{document=**} {
//          allow read, write: if true;  // single-user app, no auth needed
//        }
//      }
//    }
//
// 7. Add these to your Vercel environment variables:
//    VITE_FIREBASE_API_KEY
//    VITE_FIREBASE_AUTH_DOMAIN
//    VITE_FIREBASE_PROJECT_ID
//    VITE_FIREBASE_APP_ID
//
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId
)

export const db = isConfigured
  ? getFirestore(initializeApp(firebaseConfig))
  : null

export { isConfigured }
