/**
 * Firebase App Initialization
 *
 * Reads configuration from environment variables (VITE_ prefix required by Vite).
 * Firebase is initialized once here and re-exported — never call initializeApp()
 * anywhere else in the project.
 */

import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA2YMqphSEEu2Z9ksP9hiUrR-wR3BERcac',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'yatra-seva-3eae2.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || 'yatra-seva-3eae2',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'yatra-seva-3eae2.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '485930311133',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || '1:485930311133:web:9da58bf9f095c48609aa34',
};

// Guard: fail loudly in development if env vars are missing
if (import.meta.env.DEV) {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error(
      '[Firebase] Missing environment variables:',
      missing.join(', '),
      '\nCopy .env.example → .env and fill in your Firebase project values.',
    );
  }
}

const app = initializeApp(firebaseConfig);

export default app;
