import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDh9kohi9pwcYeTC3XJWy438zoZpjiJlc8",
  authDomain: "lifeguide-73ffe.firebaseapp.com",
  projectId: "lifeguide-73ffe",
  storageBucket: "lifeguide-73ffe.firebasestorage.app",
  messagingSenderId: "564908115646",
  appId: "1:564908115646:web:de934720ea6b82c48d40ef",
  measurementId: "G-Y1PH20BZHQ"
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Initialize analytics safely if supported in browser environment
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        getAnalytics(app);
      } catch (err) {
        console.warn('Firebase analytics initialization skipped:', err);
      }
    }
  });
}
