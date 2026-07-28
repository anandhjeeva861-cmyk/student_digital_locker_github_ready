import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
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
export const storage = getStorage(app);
export const authReady = setPersistence(auth, browserLocalPersistence);

export const analyticsReady = analyticsIsSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch((error) => {
    console.warn("Firebase Analytics is not available in this browser.", error);
    return null;
  });
