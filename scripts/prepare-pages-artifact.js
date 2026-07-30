const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dist = path.join(root, "dist");

const files = [
  ".nojekyll",
  "index.html",
  "student-login.html",
  "student-register.html",
  "student-dashboard.html",
  "teacher-login.html",
  "teacher-register.html",
  "teacher-dashboard.html"
];

const directories = ["css", "images", "js"];

if (!fs.existsSync(path.join(root, "js", "firebase-config.js"))) {
  console.error("Missing js/firebase-config.js. Run npm run config:firebase first.");
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

for (const directory of directories) {
  fs.cpSync(path.join(root, directory), path.join(dist, directory), {
    recursive: true,
    filter: (source) => !source.endsWith("firebase-config.example.js")
  });
}

const forbidden = [".env", ".env.local", ".env.production", "node_modules", "server"];
const copied = fs.readdirSync(dist, { withFileTypes: true }).map((item) => item.name);
const unsafe = forbidden.filter((name) => copied.includes(name));
if (unsafe.length) {
  console.error(`Unsafe files in Pages artifact: ${unsafe.join(", ")}`);
  process.exit(1);
}

const generatedConfig = path.join(dist, "js", "firebase-config.js");
if (!fs.existsSync(generatedConfig)) {
  console.error("Pages artifact is missing dist/js/firebase-config.js.");
  process.exit(1);
}

const artifactFiles = [];
function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath);
    else artifactFiles.push(path.relative(dist, fullPath).replaceAll("\\", "/"));
  }
}
collectFiles(dist);

const forbiddenArtifactFiles = artifactFiles.filter((file) =>
  /(^|\/)(\.env(?:\..*)?|.*(?:service[-_]?account|serviceAccount|firebase-admin|firebase-adminsdk).*\.json|vercel\.json|netlify\.toml|_redirects|_headers|.*\.(?:pem|key|p12|pfx|db|sqlite|sqlite3))$/i.test(file)
  || /(^|\/)(?:server|\.vercel|\.netlify|\.firebase)(\/|$)/i.test(file)
);
if (forbiddenArtifactFiles.length) {
  console.error(`Credential files found in Pages artifact: ${forbiddenArtifactFiles.join(", ")}`);
  process.exit(1);
}

console.log("Prepared GitHub Pages artifact in dist.");
