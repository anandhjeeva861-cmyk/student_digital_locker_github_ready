import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const fallbackFirebaseConfig = {
  apiKey: "REDACTED_FIREBASE_API_KEY",
  authDomain: "student-digi-locker-2-3293a.firebaseapp.com",
  projectId: "student-digi-locker-2-3293a",
  messagingSenderId: "202705864241",
  appId: "1:202705864241:web:0d27a0084d8f491efbf710",
  measurementId: "G-3Y5T34K732"
};

const shouldUseBuiltInConfig = globalThis.location?.hostname?.endsWith(".github.io");
const configModule = shouldUseBuiltInConfig
  ? null
  : await import("./firebase-config.js").catch((error) => {
    console.info("Using built-in Firebase web config because js/firebase-config.js is not deployed.", error);
    return null;
  });

const firebaseConfig = configModule?.firebaseConfig || fallbackFirebaseConfig;

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "messagingSenderId",
  "appId"
];

const missingConfig = requiredConfigKeys.filter((key) => {
  const value = firebaseConfig?.[key];
  return !value || String(value).startsWith("YOUR_FIREBASE_");
});

if (missingConfig.length) {
  throw new Error(`Missing Firebase browser configuration: ${missingConfig.join(", ")}.`);
}

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const authReady = setPersistence(auth, browserLocalPersistence);

export const analyticsReady = analyticsIsSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch((error) => {
    console.warn("Firebase Analytics is not available in this browser.", error);
    return null;
  });
