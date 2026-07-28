const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const databasePath = path.resolve(process.env.DATABASE_PATH || "server/data/locker.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  department_key TEXT NOT NULL,
  year TEXT NOT NULL,
  reg_no TEXT UNIQUE,
  photo_path TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_titles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  department_key TEXT NOT NULL,
  year TEXT NOT NULL,
  created_by_teacher_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(title, department_key, year),
  FOREIGN KEY(created_by_teacher_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_reg_no TEXT,
  department TEXT NOT NULL,
  department_key TEXT NOT NULL,
  year TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('online', 'personal', 'academic')),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, category, title),
  FOREIGN KEY(owner_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS profiles_role_scope_idx ON profiles(role, department_key, year);
CREATE INDEX IF NOT EXISTS documents_owner_category_idx ON documents(owner_id, category);
CREATE INDEX IF NOT EXISTS documents_scope_category_idx ON documents(department_key, year, category);
CREATE INDEX IF NOT EXISTS academic_titles_scope_idx ON academic_titles(department_key, year);
`);

module.exports = db;
