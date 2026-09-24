const { spawnSync } = require("node:child_process");

const firebaseBin = require.resolve("firebase-tools/lib/bin/firebase.js");

const args = [
  firebaseBin,
  "emulators:exec",
  "--project",
  "demo-digital-locker",
  "--only",
  "firestore,auth",
  "node --test && npx playwright test"
];

const result = spawnSync(process.execPath, args, { stdio: "inherit", cwd: process.cwd() });

if (result.error) throw result.error;
process.exit(result.status ?? (result.signal ? 1 : 0));