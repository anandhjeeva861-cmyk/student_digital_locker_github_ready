import { auth, db } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
    departmentKey,
    isCapsName,
    isMobile,
    isRegisterNumber,
    normalizeDepartment,
    normalizeName,
    normalizeYear,
    showMessage,
} from "./validation.js";

const routes = {
    student: "/student/dashboard",
    teacher: "/teacher/dashboard",
    login: "/login",
};

function formValue(form, name) {
    return form.elements[name]?.value || "";
}

async function reserveUniqueProfile(uid, profile) {
    await runTransaction(db, async (transaction) => {
        const mobileRef = doc(db, "uniqueMobiles", profile.mobile);
        const keys = [mobileRef];
        if (profile.role === "student") {
            keys.push(doc(db, "uniqueRegNos", profile.regNo));
        }
        for (const keyRef of keys) {
            const keySnap = await transaction.get(keyRef);
            if (keySnap.exists()) throw new Error("Duplicate email, mobile number, or register number.");
        }
        transaction.set(doc(db, "users", uid), profile);
        transaction.set(mobileRef, { ownerUid: uid, role: profile.role, createdAt: serverTimestamp() });
        if (profile.role === "student") {
            transaction.set(doc(db, "uniqueRegNos", profile.regNo), { ownerUid: uid, role: "student", createdAt: serverTimestamp() });
        }
    });
}

async function registerStudent(form) {
    const name = normalizeName(formValue(form, "name"));
    const regNo = formValue(form, "regno").trim().toUpperCase();
    const mobile = formValue(form, "mobile").trim();
    const email = formValue(form, "email").trim().toLowerCase();
    const password = formValue(form, "password");
    const year = normalizeYear(formValue(form, "year"));
    const department = normalizeDepartment(formValue(form, "department"));

    if (!isCapsName(name)) throw new Error("Name must contain uppercase letters and spaces only.");
    if (!isRegisterNumber(regNo)) throw new Error("Register number must be like 25BSC003.");
    if (!isMobile(mobile)) throw new Error("Enter a valid 10 digit Indian mobile number.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
        await reserveUniqueProfile(cred.user.uid, {
        uid: cred.user.uid,
        role: "student",
        name,
        regNo,
        email,
        mobile,
        year,
        department,
        departmentKey: departmentKey(department),
        photoURL: "",
        createdAt: serverTimestamp(),
        });
    } catch (error) {
        await cred.user.delete();
        throw error;
    }
    localStorage.setItem("lockerRole", "student");
    window.location.href = routes.student;
}

async function registerTeacher(form) {
    const name = normalizeName(formValue(form, "name"));
    const mobile = formValue(form, "mobile").trim();
    const email = formValue(form, "email").trim().toLowerCase();
    const password = formValue(form, "password");
    const year = normalizeYear(formValue(form, "year"));
    const department = normalizeDepartment(formValue(form, "department"));

    if (!isCapsName(name)) throw new Error("Name must contain uppercase letters and spaces only.");
    if (!isMobile(mobile)) throw new Error("Enter a valid 10 digit Indian mobile number.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
        await reserveUniqueProfile(cred.user.uid, {
        uid: cred.user.uid,
        role: "teacher",
        name,
        email,
        mobile,
        year,
        department,
        departmentKey: departmentKey(department),
        photoURL: "",
        createdAt: serverTimestamp(),
        });
    } catch (error) {
        await cred.user.delete();
        throw error;
    }
    localStorage.setItem("lockerRole", "teacher");
    window.location.href = routes.teacher;
}

async function login(form, expectedRole) {
    const email = formValue(form, "email").trim().toLowerCase();
    const password = formValue(form, "password");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists() || snap.data().role !== expectedRole) {
        await signOut(auth);
        throw new Error(`This is not a ${expectedRole} account.`);
    }
    localStorage.setItem("lockerRole", expectedRole);
    window.location.href = routes[expectedRole];
}

export function protectPage(requiredRole) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = routes.login;
            return;
        }
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || snap.data().role !== requiredRole) {
            window.location.href = routes.login;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const studentRegister = document.getElementById("studentRegisterForm");
    const teacherRegister = document.getElementById("teacherRegisterForm");
    const studentLogin = document.getElementById("studentLoginForm");
    const teacherLogin = document.getElementById("teacherLoginForm");

    [
        [studentRegister, registerStudent],
        [teacherRegister, registerTeacher],
        [studentLogin, (form) => login(form, "student")],
        [teacherLogin, (form) => login(form, "teacher")],
    ].forEach(([form, handler]) => {
        if (!form) return;
        form.addEventListener("submit", async (event) => {
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

    document.querySelectorAll("[data-firebase-logout]").forEach((link) => {
        link.addEventListener("click", async (event) => {
            event.preventDefault();
            await signOut(auth);
            localStorage.removeItem("lockerRole");
            window.location.href = routes.login;
        });
    });
});
