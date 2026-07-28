const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
const outputPath = path.join(process.cwd(), "js", "supabase-config.js");

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

if (!fs.existsSync(envPath)) {
  console.error(".env.local not found. Create it with Supabase URL and publishable/anon key.");
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
  console.error("Missing Supabase values in .env.local.");
  console.error("Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const config = `import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseKey)};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, config);
console.log("Generated js/supabase-config.js from .env.local.");
