const fs = require("fs");
const path = require("path");

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
const envPath = path.join(process.cwd(), envFile);

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const required = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_MEASUREMENT_ID"
];

function configFromJson() {
  if (!process.env.FIREBASE_CONFIG_JSON) return null;
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG_JSON);
  } catch (error) {
    console.error("FIREBASE_CONFIG_JSON must be valid JSON.");
    throw error;
  }
}

const publicFirebaseConfig = {
  apiKey: "REDACTED_FIREBASE_API_KEY",
  authDomain: "student-digi-locker-2-3293a.firebaseapp.com",
  projectId: "student-digi-locker-2-3293a",
  storageBucket: "student-digi-locker-2-3293a.firebasestorage.app",
  messagingSenderId: "202705864241",
  appId: "1:202705864241:web:0d27a0084d8f491efbf710",
  measurementId: "G-3Y5T34K732"
};

const config = configFromJson() || {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const finalConfig = Object.values(config).some(Boolean) ? config : publicFirebaseConfig;

const missing = [
  ["apiKey", "FIREBASE_API_KEY"],
  ["authDomain", "FIREBASE_AUTH_DOMAIN"],
  ["projectId", "FIREBASE_PROJECT_ID"],
  ["storageBucket", "FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "FIREBASE_MESSAGING_SENDER_ID"],
  ["appId", "FIREBASE_APP_ID"],
  ["measurementId", "FIREBASE_MEASUREMENT_ID"]
].filter(([configKey]) => !finalConfig[configKey]).map(([, envName]) => envName);

if (missing.length) {
  console.error(`Missing Firebase configuration values: ${missing.join(", ")}`);
  process.exit(1);
}

const output = `export const firebaseConfig = ${JSON.stringify(finalConfig, null, 2)};\n`;
fs.writeFileSync(path.join(process.cwd(), "js", "firebase-config.js"), output);
console.log("Generated js/firebase-config.js");
