import {
  firebaseErrorMessage,
  getCurrentProfile,
  loginWithEmail,
  logout,
  registerStudent as firebaseRegisterStudent,
  registerTeacher as firebaseRegisterTeacher
} from "./firebase-service.js";
import {
  departmentKey,
  isCapsName,
  isMobile,
  isRegisterNumber,
  normalizeName,
  parseDepartment,
  parseYear,
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
  return firebaseErrorMessage(error);
}

function studentPayload(form) {
  const payload = {
    name: normalizeName(value(form, "name")),
    regNo: value(form, "regNo").trim().toUpperCase(),
    email: value(form, "email").trim().toLowerCase(),
    year: parseYear(value(form, "year")),
    department: parseDepartment(value(form, "department")),
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
    department: parseDepartment(value(form, "department")),
    year: parseYear(value(form, "year")),
    mobile: value(form, "mobile").trim(),
    password: value(form, "password")
  };
  payload.departmentKey = departmentKey(payload.department);

  if (!isCapsName(payload.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(payload.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (payload.password.length < 6) throw new Error("Password must contain at least 6 characters.");
  return payload;
}

async function registerStudent(form) {
  await firebaseRegisterStudent(studentPayload(form));
  location.href = pages.student;
}

async function registerTeacher(form) {
  await firebaseRegisterTeacher(teacherPayload(form));
  location.href = pages.teacher;
}

async function login(form, role) {
  const profile = await loginWithEmail(
    value(form, "email").trim().toLowerCase(),
    value(form, "password")
  );

  if (profile.role !== role) {
    await logout();
    throw new Error(`This is not a ${role} account.`);
  }
  location.href = pages[role];
}

export async function fetchProfile() {
  return getCurrentProfile();
}

export async function protectPage(role, callback) {
  try {
    const profile = await fetchProfile();
    if (!profile || profile.role !== role) {
      await logout().catch(() => {});
      location.href = pages.login;
      return;
    }
    await Promise.resolve(callback?.({ id: profile.uid }, profile));
  } catch (error) {
    console.error("Protected page failed", error);
    await logout().catch(() => {});
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
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      await logout().catch((error) => console.error("Logout failed", error));
      location.href = pages.login;
    });
  });
});
