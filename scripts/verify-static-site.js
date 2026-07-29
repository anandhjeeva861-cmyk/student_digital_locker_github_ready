const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const requiredFiles = [
  "index.html",
  ".nojekyll",
  "css/style.css",
  "images/sankara-logo.png",
  "js/firebase.js",
  "js/firebase-service.js",
  "js/firebase-config.js",
  "js/firebase-config.example.js",
  "js/options.js",
  "js/auth.js",
  "js/student.js",
  "js/teacher.js",
  ".firebaserc",
  "firebase.json",
  "firebase/firestore.rules",
  "firebase/storage.rules",
  "firebase/firestore.indexes.json",
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

const jsFiles = ["js/firebase.js", "js/firebase-service.js", "js/options.js", "js/auth.js", "js/student.js", "js/teacher.js", "js/validation.js"];
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
  if (/Ã°|Ã¢|ï¿½|â˜|ðŸ/.test(content)) {
    failures.push(`${file} contains mojibake/corrupted visible characters.`);
  }
}

const firebaseJs = fs.readFileSync(path.join(process.cwd(), "js/firebase.js"), "utf8");
const firebaseServiceJs = fs.readFileSync(path.join(process.cwd(), "js/firebase-service.js"), "utf8");
const firestoreRules = fs.readFileSync(path.join(process.cwd(), "firebase/firestore.rules"), "utf8");

if (/AIza[0-9A-Za-z_-]{20,}/.test(firebaseJs)) {
  failures.push("js/firebase.js must not contain a hardcoded Firebase API key.");
}

if (!/import\((?:["']\.\/firebase-config\.js["']|firebaseConfigUrl)\)/.test(firebaseJs)) {
  failures.push("js/firebase.js must load the generated Firebase browser config.");
}

for (const expected of ["browserSessionPersistence", "inMemoryPersistence"]) {
  if (!firebaseJs.includes(expected)) failures.push(`js/firebase.js is missing auth persistence fallback: ${expected}`);
}

const trackedTextFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => /(?:^|\/)(?:[^/]+\.(?:html?|css|js|json|md|ya?ml|txt|rules)|\.firebaserc|\.env\.example)$/.test(file));

for (const file of trackedTextFiles) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (/AIza[0-9A-Za-z_-]{20,}/.test(content)) {
    failures.push(`${file} contains a tracked Google/Firebase API key.`);
  }
}

if (/firebase-storage\.js|getStorage\(|uploadBytes|uploadBytesResumable|deleteObject\(|ref\(storage/.test(firebaseJs + "\n" + firebaseServiceJs)) {
  failures.push("Firebase Storage is not configured for this project; uploads must stay in Firestore.");
}

for (const expected of ["writeChunks", "buildObjectUrl", "storageProvider: \"firestore\"", "fileChunksCollection"]) {
  if (!firebaseServiceJs.includes(expected)) failures.push(`js/firebase-service.js is missing Firestore chunk upload support: ${expected}`);
}

if (!/request\.resource\.data\.storageProvider == "firestore"/.test(firestoreRules) || !/validOwnedDocumentId/.test(firestoreRules)) {
  failures.push("firebase/firestore.rules must accept Firestore chunk metadata and first-upload document checks.");
}

const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
if (/AIza|student-digi-locker-2-3293a|G-3Y5T34K732/.test(example)) {
  failures.push(".env.example must contain placeholders only.");
}

const firebaseConfig = fs.readFileSync(path.join(process.cwd(), "js/firebase-config.js"), "utf8");
if (/YOUR_FIREBASE_/.test(firebaseConfig)) {
  failures.push("js/firebase-config.js must contain deployable Firebase Web SDK values, not placeholders.");
}

const options = fs.readFileSync(path.join(process.cwd(), "js/options.js"), "utf8");
for (const expected of ["BSC CS", "BSC AI&ML", "BSC IT", "CSDA", "BCOM", "BCOM CA", "BCOM PA", "CS&HM", "BCOM IT", "MBA", "BBA", "I", "II", "III"]) {
  if (!options.includes(`"${expected}"`)) failures.push(`js/options.js is missing option: ${expected}`);
}

for (const file of ["student-register.html", "teacher-register.html"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!/select name="department" data-options="departments" required/.test(content)) {
    failures.push(`${file} must use the shared department select.`);
  }
  if (!/select name="year" data-options="years" required/.test(content)) {
    failures.push(`${file} must use the shared year select.`);
  }
}

const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/pages.yml"), "utf8");
for (const expected of [
  "actions/configure-pages@v5",
  "actions/setup-node@v4",
  "npm ci",
  "actions: read",
  "npm run config:firebase",
  "npm run build",
  "npm run pages:artifact",
  "actions/upload-pages-artifact@v3",
  "Wait for legacy Pages deployment",
  "actions/deploy-pages@v4",
  "Verify deployed Firebase configuration",
  "path: dist"
]) {
  if (!workflow.includes(expected)) failures.push(`GitHub Pages workflow is missing: ${expected}`);
}

const secretExpressions = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
const unsafeSecretExpressions = secretExpressions.filter((name) => name !== "FIREBASE_API_KEY");
if (unsafeSecretExpressions.length) {
  failures.push(`GitHub Pages workflow contains unexpected secret references: ${unsafeSecretExpressions.join(", ")}`);
}

if (!/\$\{\{\s*vars\.FIREBASE_API_KEY\s*\|\|\s*secrets\.FIREBASE_API_KEY\s*\}\}/.test(workflow)) {
  failures.push("GitHub Pages workflow must read FIREBASE_API_KEY from a repository variable or secret.");
}

if (/path:\s*\./.test(workflow)) {
  failures.push("GitHub Pages workflow must deploy the clean dist artifact, not the repository root.");
}

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
for (const scriptName of ["config:firebase", "build", "pages:artifact", "dev"]) {
  if (!packageJson.scripts?.[scriptName]) failures.push(`package.json is missing ${scriptName} script.`);
}

if (/localhost:3000|localhost:8000|127\.0\.0\.1:3000/.test([...htmlFiles, ...jsFiles].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n"))) {
  failures.push("Frontend contains hardcoded local backend URLs.");
}

if (failures.length) {
  console.error("Static site verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static site verification passed.");
