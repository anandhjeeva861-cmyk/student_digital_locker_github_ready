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
  login: "./index.html",
  studentLogin: "./student-login.html",
  teacherLogin: "./teacher-login.html"
};

function value(form, name) {
  return form.elements[name]?.value || "";
}

export function profileColumns(profile, userId = profile.id) {
  return {
    id: userId,
    role: profile.role,
    name: profile.name,
    email: profile.email,
    mobile: profile.mobile,
    department: profile.department,
    department_key: profile.department_key || profile.departmentKey,
    year: profile.year,
    reg_no: profile.reg_no || profile.regNo || null,
    photo_url: profile.photo_url || profile.photoURL || ""
  };
}

function profileFromMetadata(user) {
  const meta = user?.user_metadata || {};
  if (!meta.role) return null;
  return profileColumns(
    {
      role: meta.role,
      name: meta.name,
      email: user.email || meta.email,
      mobile: meta.mobile,
      department: meta.department,
      department_key: meta.department_key,
      year: meta.year,
      reg_no: meta.reg_no,
      photo_url: meta.photo_url
    },
    user.id
  );
}

export function friendlyAuthError(error) {
  const message = String(error?.message || error || "");

  if (/invalid login credentials/i.test(message)) {
    return "Invalid credentials. Check your email and password.";
  }
  if (/email not confirmed|confirm your email/i.test(message)) {
    return "Email not confirmed. Please verify your email, then login.";
  }
  if (/row-level security|violates row level security|permission denied/i.test(message)) {
    return "Supabase RLS blocked this request. Run supabase/schema.sql, then supabase/rls-policies.sql.";
  }
  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return "Supabase table or function is missing. Run the setup SQL files in Supabase SQL Editor.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Could not reach Supabase. Check your Supabase URL, anon key, and internet connection.";
  }

  return message || "Something went wrong. Check the browser console for details.";
}

export function showAuthMessage(message, type = "info") {
  showMessage(message, type);
}

export function redirectAfterDelay(url, delay = 1800) {
  window.setTimeout(() => {
    location.href = url;
  }, delay);
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
    if (error) {
      console.error("Duplicate check failed", { column, error });
      throw error;
    }
    if (data) throw new Error(message);
  }
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Profile fetch failed", { userId, error });
    throw error;
  }

  return data;
}

export async function ensureProfile(user, fallbackProfile = null) {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;

  const row = fallbackProfile
    ? profileColumns(fallbackProfile, user.id)
    : profileFromMetadata(user);

  if (!row?.role) {
    throw new Error("Profile not found. Run Supabase setup SQL or register again.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("Profile creation fallback failed", { userId: user.id, error });
    throw error;
  }

  return data;
}

async function registerProfile(profile, password) {
  await assertNoDuplicate(profile);

  const row = profileColumns(profile);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: profile.email,
    password,
    options: {
      data: row
    }
  });

  if (authError) {
    console.error("Registration failed", { role: profile.role, email: profile.email, error: authError });
    throw authError;
  }
  if (!authData.user) throw new Error("Account was not created. Please try again.");

  if (!authData.session) {
    showAuthMessage("Account created. Please verify your email, then login.", "success");
    redirectAfterDelay(profile.role === "student" ? pages.studentLogin : pages.teacherLogin);
    return;
  }

  await ensureProfile(authData.user, profile);
  location.href = pages[profile.role];
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
    photoURL: ""
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isRegisterNumber(profile.regNo)) throw new Error("Register number must be like 25BSC003.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (password.length < 6) throw new Error("Password must contain at least 6 characters.");

  await registerProfile(profile, password);
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
    photoURL: ""
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (password.length < 6) throw new Error("Password must contain at least 6 characters.");

  await registerProfile(profile, password);
}

async function login(form, role) {
  const email = value(form, "email").trim().toLowerCase();
  const password = value(form, "password");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Login failed", { role, email, error });
    throw error;
  }

  const profile = await ensureProfile(data.user);
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error("Profile not found. Run Supabase setup SQL or register again.");
  }

  if (profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error(`This is not a ${role} account.`);
  }

  location.href = pages[role];
}

export async function protectPage(role, callback) {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (!data.session?.user) {
      location.href = pages.login;
      return;
    }

    const profile = await ensureProfile(data.session.user);
    if (!profile || profile.role !== role) {
      await supabase.auth.signOut();
      showAuthMessage(`This is not a ${role} account.`, "danger");
      redirectAfterDelay(pages.login);
      return;
    }

    await Promise.resolve(callback?.(data.session.user, profile));
  } catch (error) {
    console.error("Protected page load failed", { role, error });
    showAuthMessage(friendlyAuthError(error), "danger");
    redirectAfterDelay(pages.login, 2500);
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
        console.error(`${id} submit failed`, error);
        showAuthMessage(friendlyAuthError(error), "danger");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Logout failed", error);
      }
      location.href = pages.login;
    });
  });
});
