import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfigUrl = `./firebase-config.js?v=${Date.now()}`;
const { firebaseConfig } = await import(firebaseConfigUrl).catch((error) => {
  console.error("Firebase configuration failed to load.", error);
  const message = document.createElement("p");
  message.className = "message danger";
  message.setAttribute("role", "alert");
  message.textContent = "Website configuration is unavailable. Please refresh after the latest deployment completes.";
  (document.querySelector("form") || document.body).prepend(message);
  throw new Error("Firebase configuration file is missing from this deployment.", { cause: error });
});

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
