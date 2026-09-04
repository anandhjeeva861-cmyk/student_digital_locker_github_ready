import {
  departmentKey,
  isCapsName,
  isMobile,
  isRecoveryQuestion,
  isRegisterNumber,
  normalizeName,
  parseDepartment,
  parseYear,
  showMessage
} from "./validation.js";
import { RECOVERY_QUESTIONS } from "./options.js";

const pages = {
  student: "./student-dashboard.html",
  teacher: "./teacher-dashboard.html",
  alumni: "./alumni-dashboard.html",
  login: "./index.html"
};

const portalLoginPages = {
  student: "./student-login.html",
  teacher: "./teacher-login.html",
  alumni: "./alumni-login.html"
};

let firebaseServicePromise = null;

function loadFirebaseService() {
  if (!firebaseServicePromise) firebaseServicePromise = import("./firebase-service.js");
  return firebaseServicePromise;
}

function value(form, name) {
  return form.elements[name]?.value || "";
}

async function friendlyError(error) {
  try {
    const { firebaseErrorMessage } = await loadFirebaseService();
    return firebaseErrorMessage(error);
  } catch (_loadError) {
    return error?.message || "Firebase request failed. Check the browser console.";
  }
}

function studentPayload(form) {
  const payload = {
    name: normalizeName(value(form, "name")),
    regNo: value(form, "regNo").trim().toUpperCase(),
    email: value(form, "email").trim().toLowerCase(),
    year: parseYear(value(form, "year")),
    department: parseDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    password: value(form, "password"),
    recoveryQuestion: value(form, "recoveryQuestion"),
    recoveryAnswer: value(form, "recoveryAnswer")
  };
  payload.departmentKey = departmentKey(payload.department);

  if (!isCapsName(payload.name)) throw new Error("Name must be uppercase letters only.");
  if (!isRegisterNumber(payload.regNo)) throw new Error("Register number must be like 25BSC003.");
  if (!isMobile(payload.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (payload.password.length < 6) throw new Error("Password must contain at least 6 characters.");
  if (!isRecoveryQuestion(payload.recoveryQuestion)) throw new Error("Please select a recovery question.");
  if (payload.recoveryAnswer.trim().replace(/\s+/g, " ").length < 2) {
    throw new Error("Recovery answer must contain at least 2 characters.");
  }
  return payload;
}

function teacherPayload(form) {
  const payload = {
    name: normalizeName(value(form, "name")),
    email: value(form, "email").trim().toLowerCase(),
    department: parseDepartment(value(form, "department")),
    teachingBatch: parseYear(value(form, "teachingBatch")),
    mobile: value(form, "mobile").trim(),
    password: value(form, "password"),
    recoveryQuestion: value(form, "recoveryQuestion"),
    recoveryAnswer: value(form, "recoveryAnswer")
  };
  payload.departmentKey = departmentKey(payload.department);

  if (!isCapsName(payload.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(payload.mobile)) throw new Error("Enter a valid 10 digit mobile number.");
  if (payload.password.length < 6) throw new Error("Password must contain at least 6 characters.");
  if (!isRecoveryQuestion(payload.recoveryQuestion)) throw new Error("Please select a recovery question.");
  if (payload.recoveryAnswer.trim().replace(/\s+/g, " ").length < 2) {
    throw new Error("Recovery answer must contain at least 2 characters.");
  }
  return payload;
}

async function registerStudent(form) {
  const { registerStudent: firebaseRegisterStudent } = await loadFirebaseService();
  await firebaseRegisterStudent(studentPayload(form));
  location.replace(pages.student);
}

async function registerTeacher(form) {
  const { registerTeacher: firebaseRegisterTeacher } = await loadFirebaseService();
  await firebaseRegisterTeacher(teacherPayload(form));
  location.replace(pages.teacher);
}

async function login(form, role) {
  const { loginWithEmail, logout } = await loadFirebaseService();
  const profile = await loginWithEmail(
    value(form, "email").trim().toLowerCase(),
    value(form, "password")
  );

  if (profile.role !== role) {
    await logout();
    const error = new Error(wrongPortalMessage(profile.role, role));
    error.code = "app/wrong-portal";
    error.actualRole = profile.role;
    throw error;
  }
  location.replace(pages[role]);
}

function wrongPortalMessage(actualRole, attemptedRole) {
  if (actualRole === "alumni" && attemptedRole === "student") {
    return "Your student account has been converted to an Alumni account. Please use the Alumni Login to continue.";
  }
  if (actualRole === "student" && attemptedRole === "alumni") {
    return "This account is still registered as a Student. Please use the Student Login.";
  }
  if (actualRole === "teacher" && attemptedRole !== "teacher") {
    return "This account belongs to the Teacher Portal. Please use Teacher Login.";
  }
  const label = actualRole === "student" ? "Student" : actualRole === "alumni" ? "Alumni" : "Teacher";
  return `This account belongs to the ${label} Portal. Please use ${label} Login.`;
}

function showPortalAction(form, actualRole = "") {
  const action = form.querySelector(".portal-action");
  if (!action) return;
  action.hidden = !portalLoginPages[actualRole];
  if (portalLoginPages[actualRole]) {
    action.innerHTML = "";
    const link = document.createElement("a");
    link.href = portalLoginPages[actualRole];
    link.textContent = `GO TO ${actualRole.toUpperCase()} LOGIN`;
    action.appendChild(link);
  }
}

function setRecoveryStep(dialog, step) {
  dialog.querySelectorAll("[data-recovery-step]").forEach((section) => {
    section.hidden = section.dataset.recoveryStep !== step;
  });
}

function resetRecoveryDialog(dialog, loginForm) {
  dialog.querySelectorAll("form").forEach((form) => form.reset());
  const loginEmail = value(loginForm, "email").trim().toLowerCase();
  const emailInput = dialog.querySelector("[name='recoveryEmail']");
  if (emailInput) emailInput.value = loginEmail;
  delete dialog.dataset.recoveryEmail;
  setRecoveryStep(dialog, "email");
}

function setupRecoveryDialog(dialog, loginForm) {
  const emailForm = dialog.querySelector("[data-recovery-email-form]");
  const answerForm = dialog.querySelector("[data-recovery-answer-form]");
  const question = dialog.querySelector("[data-recovery-question]");

  dialog.querySelectorAll("[data-recovery-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.querySelector("[data-recovery-back]")?.addEventListener("click", () => {
    setRecoveryStep(dialog, "email");
  });
  dialog.addEventListener("close", () => resetRecoveryDialog(dialog, loginForm));

  emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = emailForm.querySelector("button[type='submit']");
    button?.setAttribute("disabled", "disabled");
    try {
      const email = value(emailForm, "recoveryEmail").trim().toLowerCase();
      const { getRecoveryQuestionByEmail } = await loadFirebaseService();
      const savedQuestion = await getRecoveryQuestionByEmail(email);
      dialog.dataset.recoveryEmail = email;
      question.textContent = savedQuestion || RECOVERY_QUESTIONS[0];
      setRecoveryStep(dialog, "answer");
      answerForm?.elements.recoveryAnswer?.focus();
    } catch (error) {
      console.error("Recovery email lookup failed", error);
      showMessage(await friendlyError(error), "danger", { duration: 9000 });
    } finally {
      button?.removeAttribute("disabled");
    }
  });

  answerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = answerForm.querySelector("button[type='submit']");
    button?.setAttribute("disabled", "disabled");
    try {
      const email = dialog.dataset.recoveryEmail || "";
      const answer = value(answerForm, "recoveryAnswer");
      const { sendRecoveryPasswordReset, verifyRecoveryAnswer } = await loadFirebaseService();
      if (!await verifyRecoveryAnswer(email, answer)) {
        showMessage("Recovery details are incorrect.", "danger", { duration: 7000 });
        answerForm.elements.recoveryAnswer.value = "";
        answerForm.elements.recoveryAnswer.focus();
        return;
      }
      await sendRecoveryPasswordReset(email);
      dialog.close();
      showMessage(
        "If the details are correct, a password reset link has been sent to your email.",
        "success",
        { duration: 9000 }
      );
    } catch (error) {
      console.error("Password recovery failed", error);
      showMessage(await friendlyError(error), "danger", { duration: 9000 });
    } finally {
      button?.removeAttribute("disabled");
    }
  });
}

export async function protectPage(role, callback) {
  let service = null;
  let profile = null;
  try {
    service = await loadFirebaseService();
    profile = await service.getCurrentProfile();
    if (!profile || profile.role !== role) {
      await service.logout().catch(() => {});
      location.replace(pages.login);
      return;
    }
  } catch (error) {
    console.error("Protected page failed", error);
    await service?.logout?.().catch(() => {});
    showMessage(await friendlyError(error), "danger");
    window.setTimeout(() => {
      location.replace(pages.login);
    }, 1800);
    return;
  }

  try {
    await Promise.resolve(callback?.({ id: profile.uid }, profile));
  } catch (error) {
    console.error("Dashboard data failed", error);
    showMessage(await friendlyError(error), "danger", { duration: 9000 });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const handlers = {
    studentLoginForm: (form) => login(form, "student"),
    teacherLoginForm: (form) => login(form, "teacher"),
    alumniLoginForm: (form) => login(form, "alumni"),
    studentRegisterForm: registerStudent,
    teacherRegisterForm: registerTeacher
  };

  Object.entries(handlers).forEach(([id, handler]) => {
    const form = document.getElementById(id);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button?.setAttribute("disabled", "disabled");
      showPortalAction(form);
      try {
        await handler(form);
      } catch (error) {
        console.error(`${id} failed`, error);
        if (error?.code === "app/wrong-portal") showPortalAction(form, error.actualRole);
        showMessage(await friendlyError(error), "danger", { duration: 9000 });
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  });

  document.querySelectorAll("[data-forgot-password]").forEach((button) => {
    const loginForm = button.closest("form");
    const dialog = document.querySelector(button.dataset.forgotPassword);
    if (!loginForm || !dialog) return;
    setupRecoveryDialog(dialog, loginForm);
    button.addEventListener("click", () => {
      resetRecoveryDialog(dialog, loginForm);
      dialog.showModal();
      dialog.querySelector("[name='recoveryEmail']")?.focus();
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const { logout } = await loadFirebaseService();
      await logout().catch((error) => console.error("Logout failed", error));
      location.replace(pages.login);
    });
  });

  const removeAccountDialog = document.getElementById("removeAccountDialog");
  const removeAccountPasswordInput = document.getElementById("removeAccountPassword");
  const confirmRemoveAccountButton = document.getElementById("confirmRemoveAccountButton");
  let pendingAccountRemoval = false;

  document.querySelectorAll("[data-remove-account]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!removeAccountDialog) {
        if (!confirm("Remove this account and all your stored data? This cannot be undone.")) return;
        button.setAttribute("disabled", "disabled");
        try {
          const { deleteCurrentAccount } = await loadFirebaseService();
          await deleteCurrentAccount();
          showMessage("Account removed successfully.", "success");
          window.setTimeout(() => { location.replace(pages.login); }, 700);
        } catch (error) {
          console.error("Account remove failed", error);
          showMessage(await friendlyError(error), "danger", { duration: 9000 });
        } finally {
          button.removeAttribute("disabled");
        }
        return;
      }
      pendingAccountRemoval = true;
      if (removeAccountPasswordInput) removeAccountPasswordInput.value = "";
      removeAccountDialog.showModal();
    });
  });

  document.getElementById("cancelRemoveAccountButton")?.addEventListener("click", () => {
    pendingAccountRemoval = false;
    removeAccountDialog?.close();
    if (removeAccountPasswordInput) removeAccountPasswordInput.value = "";
  });
  document.getElementById("cancelRemoveAccountButtonSecondary")?.addEventListener("click", () => {
    pendingAccountRemoval = false;
    removeAccountDialog?.close();
    if (removeAccountPasswordInput) removeAccountPasswordInput.value = "";
  });

  confirmRemoveAccountButton?.addEventListener("click", async () => {
    if (!pendingAccountRemoval) return;
    const password = (removeAccountPasswordInput?.value || "").trim();
    if (!password) {
      showMessage("Enter your current password to continue.", "danger");
      removeAccountPasswordInput?.focus();
      return;
    }
    confirmRemoveAccountButton.setAttribute("disabled", "disabled");
    try {
      const { deleteCurrentAccount } = await loadFirebaseService();
      await deleteCurrentAccount(password);
      removeAccountDialog?.close();
      showMessage("Account removed successfully.", "success");
      window.setTimeout(() => { location.replace(pages.login); }, 700);
    } catch (error) {
      console.error("Account remove failed", error);
      showMessage(await friendlyError(error), "danger", { duration: 9000 });
    } finally {
      confirmRemoveAccountButton.removeAttribute("disabled");
      pendingAccountRemoval = false;
      if (removeAccountPasswordInput) removeAccountPasswordInput.value = "";
    }
  });
});
