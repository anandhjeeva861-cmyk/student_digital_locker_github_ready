import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
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

let firebasePromise = null;

export async function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = import("./firebase-config.js").catch(() => {
      throw new Error("Firebase is not configured. Copy js/firebase-config.example.js to js/firebase-config.js and paste your Firebase Console values.");
    });
  }
  return firebasePromise;
}

function value(form, name) {
  return form.elements[name]?.value || "";
}

async function saveProfileWithLocks(uid, profile) {
  const { db } = await getFirebase();
  await runTransaction(db, async (transaction) => {
    const mobileRef = doc(db, "uniqueMobiles", profile.mobile);
    const mobileSnap = await transaction.get(mobileRef);
    if (mobileSnap.exists()) throw new Error("Account already exists with this mobile number.");

    if (profile.role === "student") {
      const regRef = doc(db, "uniqueRegNos", profile.regNo);
      const regSnap = await transaction.get(regRef);
      if (regSnap.exists()) throw new Error("Account already exists with this register number.");
      transaction.set(regRef, { ownerUid: uid, role: "student", createdAt: serverTimestamp() });
    }

    transaction.set(doc(db, "users", uid), profile);
    transaction.set(mobileRef, { ownerUid: uid, role: profile.role, createdAt: serverTimestamp() });
  });
}

async function registerStudent(form) {
  const { auth } = await getFirebase();
  const profile = {
    role: "student",
    name: normalizeName(value(form, "name")),
    regNo: value(form, "regNo").trim().toUpperCase(),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    email: value(form, "email").trim().toLowerCase(),
    photoURL: "",
    createdAt: serverTimestamp()
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isRegisterNumber(profile.regNo)) throw new Error("Register number must be like 25BSC003.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");

  const cred = await createUserWithEmailAndPassword(auth, profile.email, value(form, "password"));
  profile.uid = cred.user.uid;
  try {
    await saveProfileWithLocks(cred.user.uid, profile);
    location.href = pages.student;
  } catch (error) {
    await cred.user.delete();
    throw error;
  }
}

async function registerTeacher(form) {
  const { auth } = await getFirebase();
  const profile = {
    role: "teacher",
    name: normalizeName(value(form, "name")),
    year: normalizeYear(value(form, "year")),
    department: normalizeDepartment(value(form, "department")),
    mobile: value(form, "mobile").trim(),
    email: value(form, "email").trim().toLowerCase(),
    photoURL: "",
    createdAt: serverTimestamp()
  };
  profile.departmentKey = departmentKey(profile.department);

  if (!isCapsName(profile.name)) throw new Error("Name must be uppercase letters only.");
  if (!isMobile(profile.mobile)) throw new Error("Enter a valid 10 digit mobile number.");

  const cred = await createUserWithEmailAndPassword(auth, profile.email, value(form, "password"));
  profile.uid = cred.user.uid;
  try {
    await saveProfileWithLocks(cred.user.uid, profile);
    location.href = pages.teacher;
  } catch (error) {
    await cred.user.delete();
    throw error;
  }
}

async function login(form, role) {
  const { auth, db } = await getFirebase();
  const email = value(form, "email").trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, email, value(form, "password"));
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (!snap.exists() || snap.data().role !== role) {
    await signOut(auth);
    throw new Error(`This is not a ${role} account.`);
  }
  location.href = pages[role];
}

export function protectPage(role, callback) {
  getFirebase().then(({ auth, db }) => {
    onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = pages.login;
      return;
    }
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().role !== role) {
      location.href = pages.login;
      return;
    }
    callback?.(user, snap.data());
  });
  }).catch((error) => showMessage(error.message, "danger"));
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
      const { auth } = await getFirebase();
      await signOut(auth);
      location.href = pages.login;
    });
  });
});
