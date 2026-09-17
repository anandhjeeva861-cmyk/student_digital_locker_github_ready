const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const requiredFiles = [
  "index.html",
  "robots.txt",
  "sitemap.xml",
  ".nojekyll",
  "css/style.css",
  "images/sankara-logo.png",
  "js/firebase.js",
  "js/firebase-service.js",
  "js/dashboard-nav.js",
  "js/firebase-config.js",
  "js/firebase-config.example.js",
  "js/options.js",
  "js/auth.js",
  "js/student.js",
  "js/admin.js",
  "js/alumni.js",
  "js/teacher.js",
  "scripts/local-server.js",
  ".firebaserc",
  "firebase.json",
  "firebase/firestore.rules",
  "firebase/storage.rules",
  "firebase/firestore.indexes.json",
  "student-login.html",
  "student-register.html",
  "teacher-login.html",
  "teacher-register.html",
  "admin-login.html",
  "admin-dashboard.html",
  "student-dashboard.html",
  "alumni-login.html",
  "alumni-dashboard.html",
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
  "admin-login.html",
  "admin-dashboard.html",
  "student-dashboard.html",
  "alumni-login.html",
  "alumni-dashboard.html",
  "teacher-dashboard.html"
];

const jsFiles = ["js/firebase.js", "js/firebase-service.js", "js/dashboard-nav.js", "js/options.js", "js/auth.js", "js/student.js", "js/teacher.js", "js/admin.js", "js/alumni.js", "js/validation.js"];
const failures = [];

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenTrackedFiles = trackedFiles.filter((file) =>
  file !== ".env.example"
  && (
    /(^|\/)(?:\.env(?:\..*)?|js\/firebase-config\.js|vercel\.json|netlify\.toml|_redirects|_headers)$/i.test(file)
    || /(^|\/)(?:server|\.vercel|\.netlify|\.firebase)(\/|$)/i.test(file)
    || /(^|\/).*(?:service[-_]?account|serviceAccount|firebase-admin|firebase-adminsdk).*\.json$/i.test(file)
    || /\.(?:pem|key|p12|pfx|db|sqlite|sqlite3)$/i.test(file)
  )
);
if (forbiddenTrackedFiles.length) {
  failures.push(`Tracked files include deployment leftovers or secrets: ${forbiddenTrackedFiles.join(", ")}`);
}

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if ((content.match(/<title>[^<]+<\/title>/g) || []).length !== 1) {
    failures.push(`${file} must contain exactly one non-empty title.`);
  }
  if (!/<meta name="description" content="[^"]+">/.test(content)) {
    failures.push(`${file} is missing a meta description.`);
  }
  if (!/<link rel="canonical" href="https:\/\/[^\"]+">/.test(content)) {
    failures.push(`${file} is missing an HTTPS canonical URL.`);
  }
  if (!/<link rel="icon"[^>]+href="\.\/images\/sankara-logo\.png">/.test(content)) {
    failures.push(`${file} is missing the site favicon.`);
  }

  const ids = [...content.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    failures.push(`${file} contains duplicate IDs: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  const idSet = new Set(ids);
  for (const match of content.matchAll(/<label[^>]*\sfor="([^"]+)"[^>]*>/g)) {
    if (!idSet.has(match[1])) failures.push(`${file} has a label for missing ID: ${match[1]}`);
  }
  if (/<label(?![^>]*\sfor=)[^>]*>/i.test(content)) {
    failures.push(`${file} has a form label without an associated control.`);
  }

  for (const match of content.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)) {
    if (!fs.existsSync(path.join(process.cwd(), match[1]))) {
      failures.push(`${file} references a missing local file: ${match[1]}`);
    }
  }
  if (/src="\/js\//.test(content) || /href="\/css\//.test(content) || /src="\/images\//.test(content)) {
    failures.push(`${file} contains an absolute GitHub Pages path.`);
  }
  if (/<script(?![^>]*type="module")[^>]*src="\.\/js\//.test(content)) {
    failures.push(`${file} has a local JS script without type="module".`);
  }
  if (/<button(?![^>]*\btype=)/i.test(content)) {
    failures.push(`${file} contains a button without an explicit type.`);
  }
  if (/ð|â|�/.test(content)) {
    failures.push(`${file} contains mojibake/corrupted visible characters.`);
  }
}

for (const file of [...jsFiles, ".github/workflows/pages.yml"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (/supabase|service_role|private_key|serviceAccount|vercel|netlify/i.test(content)) {
    failures.push(`${file} contains unsafe or removed-provider references.`);
  }
  if (/Ã°|Ã¢|ï¿½|â˜|ðŸ/.test(content)) {
    failures.push(`${file} contains mojibake/corrupted visible characters.`);
  }
}

const firebaseJs = fs.readFileSync(path.join(process.cwd(), "js/firebase.js"), "utf8");
const firebaseServiceJs = fs.readFileSync(path.join(process.cwd(), "js/firebase-service.js"), "utf8");
const authJs = fs.readFileSync(path.join(process.cwd(), "js/auth.js"), "utf8");
const studentJs = fs.readFileSync(path.join(process.cwd(), "js/student.js"), "utf8");
const teacherJs = fs.readFileSync(path.join(process.cwd(), "js/teacher.js"), "utf8");
const adminJs = fs.readFileSync(path.join(process.cwd(), "js/admin.js"), "utf8");
const styleCss = fs.readFileSync(path.join(process.cwd(), "css/style.css"), "utf8");
const firestoreRules = fs.readFileSync(path.join(process.cwd(), "firebase/firestore.rules"), "utf8");
const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase.json"), "utf8"));

for (const [file, content] of [["js/student.js", studentJs], ["js/teacher.js", teacherJs], ["js/admin.js", adminJs]]) {
  if (/<button(?![^>]*\btype=)/i.test(content)) {
    failures.push(`${file} renders a button without an explicit type.`);
  }
}

if (firebaseJson.hosting || JSON.stringify(firebaseJson).includes("rewrites")) {
  failures.push("firebase.json must not contain Firebase Hosting rewrites for the GitHub Pages app.");
}

if (/AIza[0-9A-Za-z_-]{20,}/.test(firebaseJs)) {
  failures.push("js/firebase.js must not contain a hardcoded Firebase API key.");
}

if (!/import\((?:["']\.\/firebase-config\.js["']|firebaseConfigUrl)\)/.test(firebaseJs)) {
  failures.push("js/firebase.js must load the generated Firebase browser config.");
}

for (const file of ["student-login.html", "teacher-login.html", "admin-login.html", "alumni-login.html"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!/<script\s+type="module"\s+src="\.\/js\/auth\.js"><\/script>/.test(content)) {
    failures.push(`${file} must load ./js/auth.js as a JavaScript module.`);
  }
  if (!/<form[^>]+method="post"[^>]+action="\.\/[^"]+\.html"/.test(content)) {
    failures.push(`${file} login form must use method="post" so passwords cannot leak into the URL if JavaScript fails.`);
  }
}

for (const file of ["student-register.html", "teacher-register.html"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!/<form[^>]+method="post"[^>]+action="\.\/[^"]+\.html"/.test(content)) {
    failures.push(`${file} register form must use method="post" so passwords cannot leak into the URL if JavaScript fails.`);
  }
}

if (/from\s+["']\.\/firebase-service\.js["']/.test(authJs) || !authJs.includes("loadFirebaseService")) {
  failures.push("js/auth.js must lazy-load Firebase service after submit handlers attach.");
}

for (const [file, content] of [["js/student.js", studentJs], ["js/teacher.js", teacherJs], ["js/admin.js", adminJs]]) {
  if (/from\s+["']\.\/firebase-service\.js["']/.test(content) || !content.includes("loadFirebaseService")) {
    failures.push(`${file} must lazy-load Firebase service so dashboard click and submit handlers attach before Firebase data calls.`);
  }
}

for (const file of ["student-dashboard.html", "teacher-dashboard.html", "admin-dashboard.html"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!/<script\s+type="module"\s+src="\.\/js\/dashboard-nav\.js"><\/script>/.test(content)) {
    failures.push(`${file} must load ./js/dashboard-nav.js before dashboard data scripts.`);
  }
  if (/href="#"/.test(content)) {
    failures.push(`${file} must not use href="#" for dashboard controls.`);
  }
  if (/<a[^>]+data-open-view=/.test(content) || /<a[^>]+data-logout/.test(content)) {
    failures.push(`${file} dashboard controls must be buttons, not hash links.`);
  }
  if (["student-dashboard.html", "teacher-dashboard.html"].includes(file) && !content.includes("data-remove-account")) {
    failures.push(`${file} must include a REMOVE ACCOUNT menu option.`);
  }
  if (!/<button[^>]+class="nav-link"[^>]+data-open-view="dashboard">DASHBOARD<\/button>/.test(content)) {
    failures.push(`${file} must include one Dashboard sidebar button.`);
  }
  if (!content.includes('data-menu-toggle')
    || !content.includes('data-menu-close')
    || !content.includes('id="dashboardSidebar"')) {
    failures.push(`${file} must keep the dashboard menu hidden until the MENU button is touched.`);
  }
}

const dashboardNavJs = fs.readFileSync(path.join(process.cwd(), "js/dashboard-nav.js"), "utf8");
if (!dashboardNavJs.includes("dashboard:view-change") || !dashboardNavJs.includes("event.preventDefault()")) {
  failures.push("js/dashboard-nav.js must prevent # navigation and emit dashboard view changes.");
}
if (!dashboardNavJs.includes("data-menu-toggle")
  || !dashboardNavJs.includes("menu-open")
  || !dashboardNavJs.includes("Escape")) {
  failures.push("js/dashboard-nav.js must open/close the dashboard menu from the MENU button.");
}
if (!dashboardNavJs.includes("aria-current")
  || !dashboardNavJs.includes("pushState")
  || !dashboardNavJs.includes("popstate")) {
  failures.push("js/dashboard-nav.js must maintain active state and browser back navigation.");
}

if (!/const profileCollection = ["']profiles["']/.test(firebaseServiceJs)
  || !/loginWithEmail[\s\S]*getProfile\(credential\.user\.uid\)/.test(firebaseServiceJs)) {
  failures.push("loginWithEmail must read the signed-in user's document from the profiles collection.");
}
if (!/loginWithEmail[\s\S]*Profile not found\./.test(firebaseServiceJs)) {
  failures.push("loginWithEmail must provide a clear error when the Firestore profile is missing.");
}

for (const expected of ["browserSessionPersistence", "inMemoryPersistence"]) {
  if (!firebaseJs.includes(expected)) failures.push(`js/firebase.js is missing auth persistence fallback: ${expected}`);
}

const trackedTextFiles = trackedFiles
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

if (!authJs.includes("data-remove-account") || !firebaseServiceJs.includes("deleteCurrentAccount")) {
  failures.push("Dashboard must support removing the signed-in account and owned data.");
}

for (const expected of ["writeChunks", "buildObjectUrl", "storageProvider: \"firestore\"", "fileChunksCollection"]) {
  if (!firebaseServiceJs.includes(expected)) failures.push(`js/firebase-service.js is missing Firestore chunk upload support: ${expected}`);
}

if (!/request\.resource\.data\.storageProvider == "firestore"/.test(firestoreRules) || !/validOwnedDocumentId/.test(firestoreRules)) {
  failures.push("firebase/firestore.rules must accept Firestore chunk metadata and first-upload document checks.");
}

if (!/validAcademicTitleWrite/.test(firestoreRules)
  || !/resource\.data\.createdBy == request\.auth\.uid/.test(firestoreRules)
  || !/profileDepartmentKeyMatches\(currentProfile\(\), resource\.data\.departmentKey\)/.test(firestoreRules)) {
  failures.push("firebase/firestore.rules must protect teacher-added academic title writes and deletes.");
}

if (!/profileDepartmentKeyMatches/.test(firestoreRules)
  || !/profileRegNoMatches/.test(firestoreRules)
  || !/matchesCurrentProfileScope/.test(firestoreRules)
  || !/data\.regNo \|\| data\.reg_no/.test(firebaseServiceJs)
  || !/byDepartmentQuery/.test(firebaseServiceJs)) {
  failures.push("Dashboard code and Firestore rules must support older profile field shapes.");
}

if (!/validAcademicYear/.test(firestoreRules)
  || !/uniqueTeacherScopes/.test(firestoreRules)
  || !/getAfter\(/.test(firestoreRules)
  || !/teacherScopeId/.test(firebaseServiceJs)) {
  failures.push("Registration must enforce academic-year format and one teacher per department/academic-year scope.");
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
for (const expected of ["BSC CS", "BSC AI&ML", "BSC IT", "CSDA", "BCOM", "BCOM CA", "BCOM PA", "CS&HM", "BCOM IT", "MBA", "BBA", "2025-2028"]) {
  if (!options.includes(`"${expected}"`)) failures.push(`js/options.js is missing option: ${expected}`);
}

for (const file of ["student-register.html", "teacher-register.html"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!/select[^>]*name="department" data-options="departments" required/.test(content)) {
    failures.push(`${file} must use the shared department select.`);
  }
  const yearInput = file === "teacher-register.html"
    ? /data-academic-year[^>]*name="teachingBatch"|name="teachingBatch"[^>]*data-academic-year/.test(content)
    : /<label[^>]*>Academic Year<\/label><input[^>]*name="year" data-academic-year placeholder="2025-2028" pattern="20\[0-9\]\{2\}-20\[0-9\]\{2\}"[^>]*required>/.test(content);
  if (!yearInput) {
    failures.push(`${file} must use a supported three-year academic range input.`);
  }
}

const studentDashboard = fs.readFileSync(path.join(process.cwd(), "student-dashboard.html"), "utf8");
if (!studentDashboard.includes('id="recentDocuments"')
  || !studentJs.includes("loadAllDocuments")
  || /fillProfile\(\);\s*await safeRefresh\("Profile photo load"/.test(studentJs)) {
  failures.push("Student dashboard must use real document data and must not eagerly load profile photo chunks during login.");
}

if ((studentDashboard.match(/id="studentPhoto"/g) || []).length !== 1
  || (studentDashboard.match(/id="studentAvatar"/g) || []).length !== 1
  || !/\.avatar-placeholder:not\(\[hidden\]\)\s*\{[^}]*display:\s*grid/.test(styleCss)
  || /\.avatar-placeholder\s*\{[^}]*display:\s*grid/.test(styleCss)
  || !studentJs.includes("profilePhotoRequestId")
  || !studentJs.includes("new Image()")) {
  failures.push("Student profile must render exactly one photo or one fallback avatar without overriding the hidden state.");
}

if (!firebaseServiceJs.includes('error.code = "app/stored-file-incomplete"')
  || !firebaseServiceJs.includes("chunksAreComplete")) {
  failures.push("Stored file retrieval must validate metadata and complete ordered chunks.");
}

const robots = fs.readFileSync(path.join(process.cwd(), "robots.txt"), "utf8");
const sitemap = fs.readFileSync(path.join(process.cwd(), "sitemap.xml"), "utf8");
if (!robots.includes("Sitemap: https://") || !sitemap.includes("<urlset")) {
  failures.push("SEO files must expose an HTTPS sitemap and valid URL set.");
}

const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/pages.yml"), "utf8");
for (const expected of [
  "actions/checkout@v7",
  "actions/configure-pages@v6",
  "actions/setup-node@v7",
  "npm ci",
  "actions: read",
  "Validate Firebase API key secret",
  "npm run config:firebase",
  "npm run build",
  "npm run pages:artifact",
  "actions/upload-pages-artifact@v5",
  "Wait for legacy Pages deployment",
  "actions/deploy-pages@v5",
  "Verify deployed Firebase configuration",
  "path: dist"
]) {
  if (!workflow.includes(expected)) failures.push(`GitHub Pages workflow is missing: ${expected}`);
}

const secretExpressions = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
const unexpectedSecrets = secretExpressions.filter((name) => name !== "FIREBASE_API_KEY");
if (unexpectedSecrets.length) {
  failures.push(`GitHub Pages workflow contains unexpected secret references: ${unexpectedSecrets.join(", ")}`);
}

if (!secretExpressions.includes("FIREBASE_API_KEY")) {
  failures.push("GitHub Pages workflow must load FIREBASE_API_KEY from a GitHub Actions secret.");
}

const workflowOrder = [
  "npm run config:firebase",
  "npm run build",
  "npm run pages:artifact",
  "actions/upload-pages-artifact@v5"
].map((item) => workflow.indexOf(item));
if (workflowOrder.some((position) => position < 0)
  || workflowOrder.some((position, index) => index > 0 && position <= workflowOrder[index - 1])) {
  failures.push("GitHub Pages workflow must generate config, verify, prepare, and upload the artifact in that order.");
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

const teacherDashboard = fs.readFileSync(path.join(process.cwd(), "teacher-dashboard.html"), "utf8");
if (!teacherDashboard.includes("data-transient-view")
  || !dashboardNavJs.includes('hasAttribute("data-transient-view")')) {
  failures.push("Transient teacher detail views must not reload as empty standalone routes.");
}
if (teacherDashboard.includes('data-open-view="remove-title"')
  || teacherDashboard.includes('id="removeTitleRows"')) {
  failures.push("Teacher dashboard must not expose remove document title as a separate page.");
}

if (!teacherDashboard.includes('id="customTitleRows"')
  || !teacherJs.includes("deleteAcademicTitle")
  || !teacherJs.includes("data-remove-title")
  || !teacherJs.includes("statusDocumentButtons")
  || !teacherJs.includes("data-status-view-doc")
  || !teacherJs.includes("data-status-download-doc")) {
  failures.push("Teacher dashboard must support title removal inside add-title and document view/download inside status.");
}

if (failures.length) {
  console.error("Static site verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static site verification passed.");
