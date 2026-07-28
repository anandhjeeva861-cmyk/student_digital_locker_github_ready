import { apiGet, apiPost, clearToken, setToken } from "./api.js";
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

const pages = {
  student: "./student-dashboard.html",
  teacher: "./teacher-dashboard.html",
  login: "./index.html"
};

function value(form, name) {
  return form.elements[name]?.value || "";
}

function friendlyError(error) {
  const message = String(error?.message || error || "");
  if (/failed to fetch/i.test(message)) return "Backend API is not reachable. Start the backend with npm run dev:api.";
  return message || "Something went wrong.";
}

function studentPayload(form) {
  const payload = {
    name: normalizeName(value(form, "name")),
    regNo: value(form, "regNo").trim().toUpperCase(),
    email: value(form, "email").trim().toLowerCase(),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    password: value(form, "password")
  };
  payload.departmentKey = departmentKey(payload.department);

  if (!isCapsName(payload.name)) throw new Error("Name must be uppercase letters only.");
  if (!isRegisterNumber(payload.regNo)) throw new Error("Register number must be like 25BSC003.");
  if (!isMobile(payload.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (payload.password.length < 6) throw new Error("Password must contain at least 6 characters.");
  return payload;
}

function teacherPayload(form) {
  const payload = {
    name: normalizeName(value(form, "name")),
    email: value(form, "email").trim().toLowerCase(),
    department: normalizeDepartment(value(form, "department")),
    year: normalizeYear(value(form, "year")),
    mobile: value(form, "mobile").trim(),
    password: value(form, "password")
  };

  if (!isCapsName(payload.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(payload.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (payload.password.length < 6) throw new Error("Password must contain at least 6 characters.");
  return payload;
}

async function registerStudent(form) {
  const data = await apiPost("/auth/register/student", studentPayload(form));
  setToken(data.token);
  location.href = pages.student;
}

async function registerTeacher(form) {
  const data = await apiPost("/auth/register/teacher", teacherPayload(form));
  setToken(data.token);
  location.href = pages.teacher;
}

async function login(form, role) {
  const data = await apiPost("/auth/login", {
    email: value(form, "email").trim().toLowerCase(),
    password: value(form, "password")
  });

  if (data.profile.role !== role) {
    clearToken();
    throw new Error(`This is not a ${role} account.`);
  }

  setToken(data.token);
  location.href = pages[role];
}

export async function fetchProfile() {
  const data = await apiGet("/auth/me");
  return data.profile;
}

export async function protectPage(role, callback) {
  try {
    const profile = await fetchProfile();
    if (!profile || profile.role !== role) {
      clearToken();
      location.href = pages.login;
      return;
    }
    await Promise.resolve(callback?.({ id: profile.id }, profile));
  } catch (error) {
    console.error("Protected page failed", error);
    clearToken();
    showMessage(friendlyError(error), "danger");
    window.setTimeout(() => {
      location.href = pages.login;
    }, 1800);
  }
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
        showMessage(friendlyError(error), "danger");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      clearToken();
      location.href = pages.login;
    });
  });
});
