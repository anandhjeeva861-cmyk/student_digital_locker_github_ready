const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "index.html",
  "css/style.css",
  "images/sankara-logo.png",
  "js/auth.js",
  "js/student.js",
  "js/teacher.js",
  "js/supabase-config.example.js",
  "supabase/schema.sql",
  "supabase/rls-policies.sql",
  "supabase/complete-setup.sql",
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
  if (/ð|â|�/.test(content)) {
    failures.push(`${file} contains mojibake/corrupted visible characters.`);
  }
}

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!content.includes('from "./supabase-config.js"')) {
    failures.push(`${file} does not import ./supabase-config.js.`);
  }
}

const publicConfig = fs.readFileSync(path.join(process.cwd(), "js/supabase-config.example.js"), "utf8");
if (/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(publicConfig) || /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(publicConfig)) {
  failures.push("js/supabase-config.example.js contains real-looking Supabase values.");
}

const schema = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");
const rls = fs.readFileSync(path.join(process.cwd(), "supabase/rls-policies.sql"), "utf8");
const completeSetup = fs.readFileSync(path.join(process.cwd(), "supabase/complete-setup.sql"), "utf8");
for (const phrase of [
  "create table if not exists public.profiles",
  "create table if not exists public.academic_titles",
  "create table if not exists public.documents",
  "create or replace function public.profile_value_exists",
  "create trigger on_auth_user_created_create_profile"
]) {
  if (!schema.includes(phrase) || !completeSetup.includes(phrase)) {
    failures.push(`Supabase schema setup is missing: ${phrase}.`);
  }
}
for (const phrase of [
  "alter table public.profiles enable row level security",
  "insert into storage.buckets",
  "students upload own certificate files",
  "teachers read matching academic files"
]) {
  if (!rls.includes(phrase) || !completeSetup.includes(phrase)) {
    failures.push(`Supabase RLS/storage setup is missing: ${phrase}.`);
  }
}

for (const file of [...jsFiles, ".github/workflows/pages.yml"]) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (/firebase|getAuth|getFirestore|getStorage|firestore|uploadBytes|getDownloadURL|deleteObject/i.test(content)) {
    failures.push(`${file} still contains Firebase-era backend references.`);
  }
}

if (failures.length) {
  console.error("Static site verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static site verification passed.");
