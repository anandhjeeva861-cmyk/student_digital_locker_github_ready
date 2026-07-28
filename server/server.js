require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

require("./db");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");
const fileRoutes = require("./routes/files");

const app = express();
const port = Number(process.env.PORT || 3000);
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "server/uploads");
fs.mkdirSync(uploadRoot, { recursive: true });

const allowedOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("CORS origin not allowed."));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/files", fileRoutes);

app.use((req, _res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  next(error);
});

app.use((error, _req, res, _next) => {
  const uploadValidation = /Allowed file types|File too large|Unexpected field/i.test(error.message || "");
  const status = error.status || (uploadValidation ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error.message || "Server error." });
});

app.listen(port, () => {
  console.log(`Student Digital Locker API running on http://localhost:${port}`);
});
