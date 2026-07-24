import { auth, db, storage } from "./firebase-config.js";
import { protectPage } from "./auth.js";
import { DEFAULT_ACADEMIC_TITLES, normalizeTitle, showMessage } from "./validation.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { deleteObject, ref } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

protectPage("teacher");

let currentUser = null;
let teacher = null;

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "";
}

function formatDate(value) {
    const date = value?.toDate ? value.toDate() : null;
    return date ? date.toLocaleString() : "";
}

async function loadTeacher(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists() || snap.data().role !== "teacher") throw new Error("Teacher profile not found.");
    teacher = snap.data();
    setText("teacherWelcomeName", teacher.name);
    setText("teacherName", teacher.name);
    setText("teacherEmail", teacher.email);
    setText("teacherYear", teacher.year);
    setText("teacherDepartment", teacher.department);
    setText("teacherMobile", teacher.mobile);
    setText("teacherScope", `${teacher.department} - Year ${teacher.year}`);
}

async function matchingStudents() {
    const snap = await getDocs(query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("departmentKey", "==", teacher.departmentKey),
        where("year", "==", teacher.year),
        orderBy("name")
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function academicDocsForStudent(studentUid) {
    const snap = await getDocs(query(
        collection(db, "documents"),
        where("ownerUid", "==", studentUid),
        where("category", "==", "academic"),
        orderBy("title")
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadDashboardCounts() {
    const students = await matchingStudents();
    setText("teacherStudentCount", String(students.length));
    const titleRows = await academicTitles();
    setText("teacherTitleCount", String(titleRows.length));
    const docs = await getDocs(query(
        collection(db, "documents"),
        where("category", "==", "academic"),
        where("departmentKey", "==", teacher.departmentKey),
        where("year", "==", teacher.year)
    ));
    setText("teacherAcademicCount", String(docs.size));
}

async function renderStudents(filter = "") {
    const body = document.getElementById("teacherStudentsBody");
    const empty = document.getElementById("teacherStudentsEmpty");
    const count = document.getElementById("teacherStudentsCount");
    if (!body) return;
    const search = filter.trim().toUpperCase();
    const students = (await matchingStudents()).filter((s) => !search || s.name.includes(search) || s.regNo.includes(search));
    body.innerHTML = "";
    if (count) count.textContent = `${students.length} found`;
    if (empty) empty.hidden = students.length > 0;
    for (const student of students) {
        const docs = await academicDocsForStudent(student.uid);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><b>${student.name}</b></td>
            <td>${student.regNo}</td>
            <td>${student.department}</td>
            <td>${student.year}</td>
            <td>${docs.length}</td>
            <td><button class="small-btn" data-view-student="${student.uid}">VIEW DATA</button></td>`;
        body.appendChild(tr);
    }
}

async function renderStudentDetail(studentUid) {
    const box = document.getElementById("teacherStudentDetail");
    const body = document.getElementById("teacherAcademicDocsBody");
    if (!box || !body) return;
    const snap = await getDoc(doc(db, "users", studentUid));
    const student = snap.data();
    if (!student || student.departmentKey !== teacher.departmentKey || student.year !== teacher.year) {
        showMessage("Access denied for this student.", "danger");
        return;
    }
    setText("detailStudentName", student.name);
    setText("detailStudentRegNo", student.regNo);
    setText("detailStudentEmail", student.email);
    setText("detailStudentDepartment", student.department);
    setText("detailStudentYear", student.year);
    setText("detailStudentMobile", student.mobile);
    const docs = await academicDocsForStudent(studentUid);
    body.innerHTML = docs.map((item) => `
        <tr>
            <td><b>${item.title}</b></td>
            <td>${item.fileName}</td>
            <td>${formatDate(item.uploadedAt)}</td>
            <td class="action-cell">
                <a class="small-btn" href="${item.fileURL}" target="_blank" rel="noopener">VIEW</a>
                <a class="small-btn" href="${item.fileURL}" download="${item.fileName}">DOWNLOAD</a>
                <button class="small-btn danger" data-delete-doc="${item.id}" data-path="${item.storagePath}">REMOVE</button>
            </td>
        </tr>`).join("");
    box.hidden = false;
}

async function academicTitles() {
    const snap = await getDocs(query(
        collection(db, "academicTitles"),
        where("departmentKey", "==", teacher.departmentKey),
        where("year", "==", teacher.year),
        orderBy("title")
    ));
    return [
        ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title, isDefault: true })),
        ...snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    ];
}

async function renderStatus() {
    const grid = document.getElementById("teacherStatusGrid");
    if (!grid) return;
    const students = await matchingStudents();
    const titles = await academicTitles();
    grid.innerHTML = "";
    for (const title of titles) {
        const docs = await getDocs(query(
            collection(db, "documents"),
            where("category", "==", "academic"),
            where("departmentKey", "==", teacher.departmentKey),
            where("year", "==", teacher.year),
            where("title", "==", title.title)
        ));
        const uploadedIds = new Set(docs.docs.map((d) => d.data().ownerUid));
        const uploaded = students.filter((s) => uploadedIds.has(s.uid));
        const pending = students.filter((s) => !uploadedIds.has(s.uid));
        const card = document.createElement("div");
        card.className = "status-card";
        card.innerHTML = `
            <h2>${title.title}</h2>
            <div class="status-columns">
                <div><h3>Uploaded</h3>${nameList(uploaded, "good-list", "No uploads")}</div>
                <div><h3>Not Uploaded</h3>${nameList(pending, "warn-list", "All submitted")}</div>
            </div>`;
        grid.appendChild(card);
    }
}

function nameList(students, className, emptyText) {
    if (!students.length) return `<p class="muted">${emptyText}</p>`;
    return `<ul class="name-list ${className}">${students.map((s) => `<li>${s.name} <small>${s.regNo}</small></li>`).join("")}</ul>`;
}

async function addAcademicTitle(form) {
    const title = normalizeTitle(form.elements.title?.value);
    if (!title) throw new Error("Enter document title.");
    await addDoc(collection(db, "academicTitles"), {
        title,
        department: teacher.department,
        departmentKey: teacher.departmentKey,
        year: teacher.year,
        createdByTeacherUid: currentUser.uid,
        createdAt: serverTimestamp(),
    });
    form.reset();
}

function watchCustomTitles() {
    const wrap = document.getElementById("customAcademicTitles");
    if (!wrap) return;
    const q = query(
        collection(db, "academicTitles"),
        where("departmentKey", "==", teacher.departmentKey),
        where("year", "==", teacher.year),
        orderBy("createdAt", "desc")
    );
    onSnapshot(q, (snap) => {
        wrap.innerHTML = snap.empty
            ? '<div class="empty-state">No custom titles added yet.</div>'
            : snap.docs.map((d) => `<span class="pill">${d.data().title}</span>`).join("");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        currentUser = user;
        await loadTeacher(user.uid);
        await loadDashboardCounts();
        await renderStudents(new URLSearchParams(location.search).get("q") || "");
        await renderStatus();
        watchCustomTitles();
    });

    document.getElementById("teacherSearchForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await renderStudents(event.currentTarget.elements.q?.value || "");
    });

    document.addEventListener("click", async (event) => {
        const viewButton = event.target.closest("[data-view-student]");
        if (viewButton) await renderStudentDetail(viewButton.dataset.viewStudent);

        const deleteButton = event.target.closest("[data-delete-doc]");
        if (deleteButton && confirm("Remove this academic document?")) {
            await deleteObject(ref(storage, deleteButton.dataset.path));
            await deleteDoc(doc(db, "documents", deleteButton.dataset.deleteDoc));
            showMessage("Academic document removed.", "success");
            await renderStudents();
        }
    });

    document.getElementById("teacherAddTitleForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await addAcademicTitle(event.currentTarget);
            showMessage("Academic certificate title added.", "success");
        } catch (error) {
            showMessage(error.message, "danger");
        }
    });
});
