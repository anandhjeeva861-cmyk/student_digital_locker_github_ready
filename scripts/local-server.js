const fs = require("fs");
const http = require("http");
const path = require("path");

const root = process.cwd();
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
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
  const fullPath = resolveRequestPath(request.url);
  if (!fullPath) return sendText(response, 403, "Forbidden");

  fs.stat(fullPath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendText(response, 404, "Not found");

    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(fullPath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    fs.createReadStream(fullPath).pipe(response);
  });
});

server.listen(port, () => {
  console.log(`Local site ready at http://localhost:${port}`);
});
