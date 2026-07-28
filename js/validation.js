import { DEPARTMENT_OPTIONS, YEAR_OPTIONS } from "./options.js";

export const DEFAULT_ACADEMIC_TITLES = [
  "AADHAR CARD",
  "INCOME CERTIFICATE",
  "COMMUNITY CERTIFICATE",
  "10TH MARKSHEET",
  "12TH MARKSHEET",
  "BANK PASS BOOK"
];

export function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeDepartment(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function departmentKey(value) {
  return normalizeDepartment(value).replace(/[^A-Z0-9]/g, "");
}

export function normalizeYear(value) {
  return String(value || "").trim().toUpperCase();
}

export function isDepartment(value) {
  return DEPARTMENT_OPTIONS.includes(value);
}

export function isAcademicYear(value) {
  return YEAR_OPTIONS.includes(value);
}

export function parseDepartment(value) {
  const raw = String(value || "");
  const normalized = normalizeDepartment(raw);
  if (!normalized) throw new Error("Please select a department.");
  if (raw !== normalized || !isDepartment(normalized)) throw new Error("Invalid department selected.");
  return normalized;
}

export function parseYear(value) {
  const raw = String(value || "");
  const normalized = normalizeYear(raw);
  if (!normalized) throw new Error("Please select a year.");
  if (raw !== normalized || !isAcademicYear(normalized)) throw new Error("Invalid academic year selected.");
  return normalized;
}

export function normalizeTitle(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function isCapsName(value) {
  return /^[A-Z ]{2,60}$/.test(normalizeName(value));
}

export function isRegisterNumber(value) {
  return /^\d{2}[A-Z]{3}\d{3}$/.test(String(value || "").trim().toUpperCase());
}

export function isMobile(value) {
  return /^[6-9]\d{9}$/.test(String(value || "").trim());
}

export function validateDocumentFile(file) {
  return validateFile(file, ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"], 16);
}

export function validatePhotoFile(file) {
  return validateFile(file, ["png", "jpg", "jpeg", "webp"], 4);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function validateFile(file, extensions, maxMb) {
  if (!file) return { ok: false, message: "Choose a file." };
  const ext = file.name.split(".").pop().toLowerCase();
  if (!extensions.includes(ext)) return { ok: false, message: `Allowed file types: ${extensions.join(", ").toUpperCase()}.` };
  if (file.size > maxMb * 1024 * 1024) return { ok: false, message: `File size must be ${maxMb} MB or less.` };
  return { ok: true };
}

export function showMessage(message, type = "info") {
  let wrap = document.querySelector(".flash-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "flash-wrap";
    document.body.prepend(wrap);
  }
  const note = document.createElement("div");
  note.className = `flash ${type}`;
  note.textContent = message;
  wrap.appendChild(note);
  setTimeout(() => note.remove(), 3500);
}
