import {
  departmentKey,
  isCapsName,
  isMobile,
  isRegisterNumber,
  normalizeDepartment,
  normalizeName,
  normalizeYear,
  showMessage
} from "./validation.js";
import { clearSession, currentSession, profiles, saveProfiles, setSession, uid } from "./local-db.js";

const pages = {
  student: "./student-dashboard.html",
  teacher: "./teacher-dashboard.html",
  login: "./index.html"
};

function value(form, name) {
  return form.elements[name]?.value || "";
}

function profileColumns(profile, id = uid()) {
  return {
    id,
    role: profile.role,
    name: profile.name,
    email: profile.email,
    mobile: profile.mobile,
    department: profile.department,
    department_key: profile.departmentKey,
    year: profile.year,
    reg_no: profile.regNo || null,
    photo_url: profile.photoURL || "",
    password: profile.password,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function assertNoDuplicate({ mobile, regNo, email }) {
  const rows = profiles();
  if (rows.some((item) => item.mobile === mobile)) throw new Error("Account already exists with this mobile number.");
  if (rows.some((item) => item.email === email)) throw new Error("Account already exists with this email address.");
  if (regNo && rows.some((item) => item.reg_no === regNo)) {
    throw new Error("Account already exists with this register number.");
  }
}

function publicProfile(profile) {
  const { password, ...safeProfile } = profile;
  return safeProfile;
}

export async function fetchProfile(userId) {
  return publicProfile(profiles().find((item) => item.id === userId) || null);
}

function registerProfile(profile) {
  assertNoDuplicate(profile);
  const row = profileColumns(profile);
  saveProfiles([...profiles(), row]);
  setSession({ userId: row.id, role: row.role });
  location.href = pages[row.role];
}

async function registerStudent(form) {
  const password = value(form, "password");
  const profile = {
    role: "student",
    name: normalizeName(value(form, "name")),
    regNo: value(form, "regNo").trim().toUpperCase(),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    email: value(form, "email").trim().toLowerCase(),
    password,
    photoURL: ""
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isRegisterNumber(profile.regNo)) throw new Error("Register number must be like 25BSC003.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (password.length < 6) throw new Error("Password must contain at least 6 characters.");

  registerProfile(profile);
}

async function registerTeacher(form) {
  const password = value(form, "password");
  const profile = {
    role: "teacher",
    name: normalizeName(value(form, "name")),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    email: value(form, "email").trim().toLowerCase(),
    password,
    photoURL: ""
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (password.length < 6) throw new Error("Password must contain at least 6 characters.");

  registerProfile(profile);
}

async function login(form, role) {
  const email = value(form, "email").trim().toLowerCase();
  const password = value(form, "password");
  const profile = profiles().find((item) => item.email === email && item.password === password);

  if (!profile) throw new Error("Invalid credentials. Register first or check your email and password.");
  if (profile.role !== role) throw new Error(`This is not a ${role} account.`);

  setSession({ userId: profile.id, role: profile.role });
  location.href = pages[role];
}

export async function protectPage(role, callback) {
  const session = currentSession();
  if (!session?.userId) {
    location.href = pages.login;
    return;
  }

  const profile = await fetchProfile(session.userId);
  if (!profile || profile.role !== role) {
    clearSession();
    location.href = pages.login;
    return;
  }

  await Promise.resolve(callback?.({ id: profile.id }, profile));
}

document.addEventListener("DOMContentLoaded", () => {
  const handlers = {
    studentLoginForm: (form) => login(form, "student"),
    teacherLoginForm: (form) => login(form, "teacher"),
    studentRegisterForm: registerStudent,
    teacherRegisterForm: registerTeacher
  };

  Object.entries(handlers).forEach(([id, handler]) => {
    const form = document.getElementById(id);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button?.setAttribute("disabled", "disabled");
      try {
        await handler(form);
      } catch (error) {
        console.error(`${id} failed`, error);
        showMessage(error.message, "danger");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      clearSession();
      location.href = pages.login;
    });
  });
});
