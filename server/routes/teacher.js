const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { authRequired, roleRequired } = require("../middleware/auth");
const { normalizeTitle } = require("../utils/validation");

const router = express.Router();
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "server/uploads");

const DEFAULT_ACADEMIC_TITLES = [
  "AADHAR CARD",
  "INCOME CERTIFICATE",
  "COMMUNITY CERTIFICATE",
  "10TH MARKSHEET",
  "12TH MARKSHEET",
  "BANK PASS BOOK"
];

router.use(authRequired, roleRequired("teacher"));

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

router.get("/students", (req, res) => {
  const q = String(req.query.q || "").trim().toUpperCase();
  const rows = db.prepare(`
    SELECT p.id, p.role, p.name, p.email, p.mobile, p.department, p.department_key, p.year, p.reg_no,
      (SELECT COUNT(*) FROM documents d WHERE d.owner_id = p.id AND d.category = 'academic') AS academic_count
    FROM profiles p
    WHERE p.role = 'student'
      AND p.department_key = ?
      AND p.year = ?
      AND (? = '' OR p.name LIKE ? OR COALESCE(p.reg_no, '') LIKE ?)
    ORDER BY p.name ASC
  `).all(req.user.department_key, req.user.year, q, `%${q}%`, `%${q}%`);
  res.json({ students: rows });
});

router.get("/students/:id", (req, res, next) => {
  try {
    const student = db.prepare(`
      SELECT id, role, name, email, mobile, department, department_key, year, reg_no
      FROM profiles
      WHERE id = ? AND role = 'student' AND department_key = ? AND year = ?
    `).get(req.params.id, req.user.department_key, req.user.year);
    if (!student) {
      const error = new Error("Student not found.");
      error.status = 404;
      throw error;
    }
    const docs = db.prepare(`
      SELECT * FROM documents
      WHERE owner_id = ? AND category = 'academic'
      ORDER BY title ASC
    `).all(student.id).map(docUrl);
    res.json({ student, documents: docs });
  } catch (error) {
    next(error);
  }
});

router.get("/academic-documents", (req, res) => {
  const docs = db.prepare(`
    SELECT * FROM documents
    WHERE category = 'academic' AND department_key = ? AND year = ?
    ORDER BY title ASC
  `).all(req.user.department_key, req.user.year).map(docUrl);
  res.json({ documents: docs });
});

router.delete("/academic-documents/:id", (req, res, next) => {
  try {
    const doc = db.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND category = 'academic' AND department_key = ? AND year = ?
    `).get(req.params.id, req.user.department_key, req.user.year);
    if (!doc) {
      const error = new Error("Academic document not found.");
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
    SELECT id, title, department, department_key, year, created_by_teacher_id, created_at
    FROM academic_titles
    WHERE department_key = ? AND year = ?
    ORDER BY title ASC
  `).all(req.user.department_key, req.user.year);
  const titles = [...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })), ...custom]
    .sort((a, b) => a.title.localeCompare(b.title));
  res.json({ titles, customTitles: custom });
});

router.post("/academic-titles", (req, res, next) => {
  try {
    const title = normalizeTitle(req.body.title);
    if (!title) {
      const error = new Error("Enter document title.");
      error.status = 400;
      throw error;
    }
    if (DEFAULT_ACADEMIC_TITLES.includes(title)) {
      const error = new Error("This academic title already exists.");
      error.status = 409;
      throw error;
    }
    const row = {
      id: crypto.randomUUID(),
      title,
      department: req.user.department,
      department_key: req.user.department_key,
      year: req.user.year,
      created_by_teacher_id: req.user.id
    };
    db.prepare(`
      INSERT INTO academic_titles (id, title, department, department_key, year, created_by_teacher_id)
      VALUES (@id, @title, @department, @department_key, @year, @created_by_teacher_id)
    `).run(row);
    res.status(201).json({ title: row });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      error = new Error("This academic title already exists.");
      error.status = 409;
    }
    next(error);
  }
});

router.get("/status", (req, res) => {
  const students = db.prepare(`
    SELECT id, name, reg_no FROM profiles
    WHERE role = 'student' AND department_key = ? AND year = ?
    ORDER BY name ASC
  `).all(req.user.department_key, req.user.year);
  const custom = db.prepare(`
    SELECT title FROM academic_titles
    WHERE department_key = ? AND year = ?
  `).all(req.user.department_key, req.user.year);
  const titles = [...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })), ...custom]
    .sort((a, b) => a.title.localeCompare(b.title));
  const docs = db.prepare(`
    SELECT owner_id, title FROM documents
    WHERE category = 'academic' AND department_key = ? AND year = ?
  `).all(req.user.department_key, req.user.year);

  const rows = titles.map((title) => {
    const uploadedIds = new Set(docs.filter((doc) => doc.title === title.title).map((doc) => doc.owner_id));
    return {
      title: title.title,
      uploaded: students.filter((student) => uploadedIds.has(student.id)),
      pending: students.filter((student) => !uploadedIds.has(student.id))
    };
  });
  res.json({ status: rows });
});

module.exports = router;
