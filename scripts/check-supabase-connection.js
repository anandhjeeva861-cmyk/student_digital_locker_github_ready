const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local not found.");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  env.SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or publishable/anon key in .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const checks = [
    [
      "profile_value_exists RPC",
      () =>
        supabase.rpc("profile_value_exists", {
          check_column: "email",
          check_value: "connection-check@example.invalid"
        })
    ],
    ["academic_titles table", () => supabase.from("academic_titles").select("title").limit(1)],
    ["documents table", () => supabase.from("documents").select("id").limit(1)],
    ["certificates bucket", () => supabase.storage.from("certificates").list("", { limit: 1 })]
  ];

  const failures = [];
  for (const [name, check] of checks) {
    const { error } = await check();
    if (error) failures.push(`${name}: ${error.message}`);
  }

  if (failures.length) {
    console.error("Supabase connection reached the project, but setup is incomplete:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    console.error("Run supabase/complete-setup.sql in Supabase SQL Editor, then run this check again.");
    process.exit(1);
  }

  console.log("Supabase connection and database setup passed.");
}

run().catch((error) => {
  console.error(`Supabase check failed: ${error.message}`);
  process.exit(1);
});
