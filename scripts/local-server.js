const fs = require("fs");
const http = require("http");
const path = require("path");

const root = process.cwd();
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function resolveRequestPath(url) {
  let pathname = "";
  try {
    pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  } catch (_error) {
    return null;
  }
  if (pathname.includes("\\") || pathname.includes(":")) return null;
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const segments = relativePath.split("/");
  if (segments.some((segment) => !segment || segment.startsWith("."))) return null;
  const publicPages = ["index.html", "student-login.html", "student-register.html", "student-dashboard.html", "teacher-login.html", "teacher-register.html", "teacher-dashboard.html", "alumni-login.html", "alumni-dashboard.html", "robots.txt", "sitemap.xml"];
  if (!publicPages.includes(relativePath) && !["css", "js", "images"].includes(segments[0])) return null;
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) return null;
  return fullPath;
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}

const configPath = path.join(root, "js", "firebase-config.js");
if (!fs.existsSync(configPath)) {
  console.warn("Missing js/firebase-config.js. Run npm run config:firebase before login testing.");
}

const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) return sendText(response, 405, "Method not allowed");
  const fullPath = resolveRequestPath(request.url);
  if (!fullPath) return sendText(response, 403, "Forbidden");

  fs.stat(fullPath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendText(response, 404, "Not found");

    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(fullPath).toLowerCase()] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      "cache-control": "no-store"
    });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(fullPath).on("error", () => response.destroy()).pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local site ready at http://localhost:${port}`);
});
