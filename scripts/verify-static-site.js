const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "index.html",
  "css/style.css",
  "images/sankara-logo.png",
  "firebase.json",
  "firestore.rules",
  "storage.rules",
  "js/auth.js",
  "js/student.js",
  "js/teacher.js",
  "js/firebase-config.example.js",
  "student-login.html",
  "student-register.html",
  "teacher-login.html",
  "teacher-register.html",
  "student-dashboard.html",
  "teacher-dashboard.html"
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(process.cwd(), file)));

if (missing.length) {
  console.error("Missing required static files:");
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const htmlFiles = [
  "index.html",
  "student-login.html",
  "student-register.html",
  "teacher-login.html",
  "teacher-register.html",
  "student-dashboard.html",
  "teacher-dashboard.html"
];

const jsFiles = ["js/auth.js", "js/student.js", "js/teacher.js"];
const failures = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (/src="\/js\//.test(content) || /href="\/css\//.test(content) || /src="\/images\//.test(content)) {
    failures.push(`${file} contains an absolute GitHub Pages path.`);
  }
  if (/<script(?![^>]*type="module")[^>]*src="\.\/js\//.test(content)) {
    failures.push(`${file} has a local JS script without type="module".`);
  }
}

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!content.includes('from "./firebase-config.js"')) {
    failures.push(`${file} does not import ./firebase-config.js.`);
  }
}

const publicConfig = fs.readFileSync(path.join(process.cwd(), "js/firebase-config.example.js"), "utf8");
if (/AIza[0-9A-Za-z_-]+/.test(publicConfig)) {
  failures.push("js/firebase-config.example.js contains a real-looking Firebase API key.");
}

if (failures.length) {
  console.error("Static site verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static site verification passed.");
