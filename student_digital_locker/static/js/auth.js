import { supabase } from "./supabase-config.js";
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

function profileColumns(profile) {
  return {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    email: profile.email,
    mobile: profile.mobile,
    department: profile.department,
    department_key: profile.departmentKey,
    year: profile.year,
    reg_no: profile.regNo || null,
    photo_url: profile.photoURL || ""
  };
}

async function assertNoDuplicate({ mobile, regNo, email }) {
  const checks = [
    ["mobile", mobile, "Account already exists with this mobile number."],
    ["email", email, "Account already exists with this email address."]
  ];
  if (regNo) checks.push(["reg_no", regNo, "Account already exists with this register number."]);

  for (const [column, valueToCheck, message] of checks) {
    const { data, error } = await supabase.rpc("profile_value_exists", {
      check_column: column,
      check_value: valueToCheck
    });
    if (error) throw error;
    if (data) throw new Error(message);
  }
}

async function registerProfile(profile, password) {
  await assertNoDuplicate(profile);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: profile.email,
    password,
    options: {
      data: profileColumns(profile)
    }
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error("Account was not created. Please try again.");

  const row = profileColumns({ ...profile, id: authData.user.id });
  const { error: profileError } = await supabase.from("profiles").insert(row);
  if (profileError && profileError.code !== "23505") {
    if (/row-level security|violates row level security/i.test(profileError.message)) {
      return;
    }
    throw profileError;
  }
}

async function registerStudent(form) {
  const profile = {
    role: "student",
    name: normalizeName(value(form, "name")),
    regNo: value(form, "regNo").trim().toUpperCase(),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    email: value(form, "email").trim().toLowerCase(),
    photoURL: ""
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isRegisterNumber(profile.regNo)) throw new Error("Register number must be like 25BSC003.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");

  await registerProfile(profile, value(form, "password"));
  location.href = pages.student;
}

async function registerTeacher(form) {
  const profile = {
    role: "teacher",
    name: normalizeName(value(form, "name")),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    email: value(form, "email").trim().toLowerCase(),
    photoURL: ""
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");

  await registerProfile(profile, value(form, "password"));
  location.href = pages.teacher;
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function login(form, role) {
  const email = value(form, "email").trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: value(form, "password")
  });
  if (error) throw error;

  const profile = await fetchProfile(data.user.id);
  if (!profile || profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error(`This is not a ${role} account.`);
  }
  location.href = pages[role];
}

export async function protectPage(role, callback) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    location.href = pages.login;
    return;
  }

  const profile = await fetchProfile(data.session.user.id);
  if (!profile || profile.role !== role) {
    await supabase.auth.signOut();
    location.href = pages.login;
    return;
  }

  callback?.(data.session.user, profile);
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
        showMessage(error.message, "danger");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      await supabase.auth.signOut();
      location.href = pages.login;
    });
  });
});
