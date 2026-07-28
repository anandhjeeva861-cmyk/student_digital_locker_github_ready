const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const db = require("../db");
const { authRequired, roleRequired } = require("../middleware/auth");
const { normalizeTitle } = require("../utils/validation");

const router = express.Router();
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "server/uploads");
const storage = multer.diskStorage({
  destination(req, _file, callback) {
    const dir = path.join(uploadRoot, req.user.id);
    fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname);
    callback(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const allowedDocs = ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"];
    const allowedPhotos = ["png", "jpg", "jpeg", "webp"];
    const allowed = file.fieldname === "photo" ? allowedPhotos : allowedDocs;
    if (!allowed.includes(ext)) return callback(new Error(`Allowed file types: ${allowed.join(", ").toUpperCase()}.`));
    callback(null, true);
  }
});

const DEFAULT_ACADEMIC_TITLES = [
  "AADHAR CARD",
  "INCOME CERTIFICATE",
  "COMMUNITY CERTIFICATE",
  "10TH MARKSHEET",
  "12TH MARKSHEET",
  "BANK PASS BOOK"
];

router.use(authRequired, roleRequired("student"));

function publicProfile(profile) {
  const { password_hash, photo_path, ...safeProfile } = profile;
  return {
    ...safeProfile,
    photo_url: photo_path ? `/api/files/${encodeURIComponent(photo_path)}` : ""
  };
}

function docUrl(doc) {
  return {
    ...doc,
    file_url: `/api/files/${encodeURIComponent(doc.file_path)}`
  };
}

router.get("/profile", (req, res) => {
  res.json({ profile: publicProfile(req.user) });
});

router.post("/profile/photo", upload.single("photo"), (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error("Choose a profile photo.");
      error.status = 400;
      throw error;
    }
    const relativePath = path.relative(uploadRoot, req.file.path).replace(/\\/g, "/");
    db.prepare("UPDATE profiles SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(relativePath, req.user.id);
    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(req.user.id);
    res.json({ profile: publicProfile(profile) });
  } catch (error) {
    next(error);
  }
});

router.get("/documents", (req, res) => {
  const category = req.query.category;
  const rows = db.prepare(`
    SELECT * FROM documents
    WHERE owner_id = ? AND (? IS NULL OR category = ?)
    ORDER BY uploaded_at DESC
  `).all(req.user.id, category || null, category || null);
  res.json({ documents: rows.map(docUrl) });
});

router.post("/documents/:category", upload.single("document"), (req, res, next) => {
  try {
    const category = req.params.category;
    if (!["online", "personal", "academic"].includes(category)) {
      const error = new Error("Invalid document category.");
      error.status = 400;
      throw error;
    }
    if (!req.file) {
      const error = new Error("Choose a document file.");
      error.status = 400;
      throw error;
    }
    const title = normalizeTitle(req.body.title);
    if (!title) {
      const error = new Error("Enter or select a document title.");
      error.status = 400;
      throw error;
    }

    const relativePath = path.relative(uploadRoot, req.file.path).replace(/\\/g, "/");
    const row = {
      id: crypto.randomUUID(),
      owner_id: req.user.id,
      owner_name: req.user.name,
      owner_reg_no: req.user.reg_no,
      department: req.user.department,
      department_key: req.user.department_key,
      year: req.user.year,
      category,
      title,
      file_name: req.file.originalname,
      file_path: relativePath
    };

    db.prepare(`
      INSERT INTO documents
      (id, owner_id, owner_name, owner_reg_no, department, department_key, year, category, title, file_name, file_path)
      VALUES (@id, @owner_id, @owner_name, @owner_reg_no, @department, @department_key, @year, @category, @title, @file_name, @file_path)
    `).run(row);

    const document = db.prepare("SELECT * FROM documents WHERE id = ?").get(row.id);
    res.status(201).json({ document: docUrl(document) });
  } catch (error) {
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    if (String(error.message).includes("UNIQUE constraint failed")) {
      error = new Error("This document title is already uploaded.");
      error.status = 409;
    }
    next(error);
  }
});

router.delete("/documents/:id", (req, res, next) => {
  try {
    const doc = db.prepare("SELECT * FROM documents WHERE id = ? AND owner_id = ?").get(req.params.id, req.user.id);
    if (!doc) {
      const error = new Error("Document not found.");
      error.status = 404;
      throw error;
    }
    db.prepare("DELETE FROM documents WHERE id = ?").run(doc.id);
    fs.rmSync(path.join(uploadRoot, doc.file_path), { force: true });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/academic-titles", (req, res) => {
  const custom = db.prepare(`
    SELECT title FROM academic_titles
    WHERE department_key = ? AND year = ?
    ORDER BY title ASC
  `).all(req.user.department_key, req.user.year);
  const titles = [...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })), ...custom]
    .sort((a, b) => a.title.localeCompare(b.title));
  res.json({ titles });
});

module.exports = router;
