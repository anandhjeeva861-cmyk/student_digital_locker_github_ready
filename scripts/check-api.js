const baseUrl = process.env.API_BASE || "http://localhost:3000/api";

async function run() {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`API health failed with status ${response.status}`);
  }
  const body = await response.json();
  if (!body.ok) {
    throw new Error("API health response did not include ok=true.");
  }
  console.log("API health check passed.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
