const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "index.html",
  ".nojekyll",
  "css/style.css",
  "images/sankara-logo.png",
  "js/firebase.js",
  "js/firebase-service.js",
  "js/firebase-config.example.js",
  "js/auth.js",
  "js/student.js",
  "js/teacher.js",
  "firebase/firestore.rules",
  "firebase/storage.rules",
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

const jsFiles = ["js/firebase.js", "js/firebase-service.js", "js/auth.js", "js/student.js", "js/teacher.js", "js/validation.js"];
const failures = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (/src="\/js\//.test(content) || /href="\/css\//.test(content) || /src="\/images\//.test(content)) {
    failures.push(`${file} contains an absolute GitHub Pages path.`);
  }
  if (/<script(?![^>]*type="module")[^>]*src="\.\/js\//.test(content)) {
    failures.push(`${file} has a local JS script without type="module".`);
  }
  if (/ð|â|�/.test(content)) {
    failures.push(`${file} contains mojibake/corrupted visible characters.`);
  }
}

for (const file of [...jsFiles, ".github/workflows/pages.yml"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (/supabase|service_role|private_key|serviceAccount/i.test(content)) {
    failures.push(`${file} contains unsafe or removed-provider references.`);
  }
}

const gitignore = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
if (!/js\/firebase-config\.js/.test(gitignore)) {
  failures.push(".gitignore must ignore generated js/firebase-config.js.");
}

const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
if (/AIza|student-digi-locker-2-3293a|G-3Y5T34K732/.test(example)) {
  failures.push(".env.example must contain placeholders only.");
}

if (failures.length) {
  console.error("Static site verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static site verification passed.");
