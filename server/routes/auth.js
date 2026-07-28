const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");
const { signToken, authRequired } = require("../middleware/auth");
const {
  departmentKey,
  loginSchema,
  parseBody,
  registerStudentSchema,
  registerTeacherSchema
} = require("../utils/validation");

const router = express.Router();

function publicProfile(profile) {
  const { password_hash, photo_path, ...safeProfile } = profile;
  return {
    ...safeProfile,
    photo_url: photo_path ? `/api/files/${encodeURIComponent(photo_path)}` : ""
  };
}

function createProfile(data, role) {
  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(data.password, 12);
  const department_key = departmentKey(data.department);
  const row = {
    id,
    role,
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    department: data.department,
    department_key,
    year: data.year,
    reg_no: data.regNo || null,
    password_hash: passwordHash
  };

  try {
    db.prepare(`
      INSERT INTO profiles (id, role, name, email, mobile, department, department_key, year, reg_no, password_hash)
      VALUES (@id, @role, @name, @email, @mobile, @department, @department_key, @year, @reg_no, @password_hash)
    `).run(row);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      const duplicate = new Error("Account already exists with this email, mobile, or register number.");
      duplicate.status = 409;
      throw duplicate;
    }
    throw error;
  }

  return db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
}

router.post("/register/student", (req, res, next) => {
  try {
    const data = parseBody(registerStudentSchema, req.body);
    const profile = createProfile(data, "student");
    res.status(201).json({ token: signToken(profile), profile: publicProfile(profile) });
  } catch (error) {
    next(error);
  }
});

router.post("/register/teacher", (req, res, next) => {
  try {
    const data = parseBody(registerTeacherSchema, req.body);
    const profile = createProfile(data, "teacher");
    res.status(201).json({ token: signToken(profile), profile: publicProfile(profile) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", (req, res, next) => {
  try {
    const data = parseBody(loginSchema, req.body);
    const profile = db.prepare("SELECT * FROM profiles WHERE email = ?").get(data.email);
    if (!profile || !bcrypt.compareSync(data.password, profile.password_hash)) {
      const error = new Error("Invalid credentials.");
      error.status = 401;
      throw error;
    }
    res.json({ token: signToken(profile), profile: publicProfile(profile) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authRequired, (req, res) => {
  res.json({ profile: publicProfile(req.user) });
});

module.exports = router;
