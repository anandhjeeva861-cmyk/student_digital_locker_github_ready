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

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing Firebase environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const config = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const output = `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(path.join(process.cwd(), "js", "firebase-config.js"), output);
console.log("Generated js/firebase-config.js");
