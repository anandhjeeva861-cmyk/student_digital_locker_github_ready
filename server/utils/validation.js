const { z } = require("zod");

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeDepartment(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function departmentKey(value) {
  return normalizeDepartment(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeYear(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTitle(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

const registerStudentSchema = z.object({
  name: z.string().transform(normalizeName).refine((value) => /^[A-Z ]{2,60}$/.test(value), "Name must be uppercase letters only."),
  regNo: z.string().transform((value) => value.trim().toUpperCase()).refine((value) => /^\d{2}[A-Z]{3}\d{3}$/.test(value), "Register number must be like 25BSC003."),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  year: z.string().transform(normalizeYear).refine(Boolean, "Year is required."),
  department: z.string().transform(normalizeDepartment).refine(Boolean, "Department is required."),
  mobile: z.string().trim().refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid 10 digit mobile number."),
  password: z.string().min(6, "Password must contain at least 6 characters.")
});

const registerTeacherSchema = registerStudentSchema.omit({ regNo: true });

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, "Password is required.")
});

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  return parsed.data;
}

module.exports = {
  departmentKey,
  loginSchema,
  normalizeTitle,
  parseBody,
  registerStudentSchema,
  registerTeacherSchema
};
