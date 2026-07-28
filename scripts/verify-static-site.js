const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "index.html",
  "css/style.css",
  "images/sankara-logo.png",
  "js/api.js",
  "js/auth.js",
  "js/student.js",
  "js/teacher.js",
  "server/server.js",
  "server/db.js",
  "server/routes/auth.js",
  "server/routes/student.js",
  "server/routes/teacher.js",
  "server/routes/files.js",
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

const jsFiles = ["js/api.js", "js/auth.js", "js/student.js", "js/teacher.js"];
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
  if (/supabase|firebase|firestore|service_role/i.test(content)) {
    failures.push(`${file} still contains removed-provider references.`);
  }
}

if (failures.length) {
  console.error("Static site verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static site verification passed.");
