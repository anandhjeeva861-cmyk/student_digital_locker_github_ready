import { auth, db, storage } from "./firebase-config.js";
import { protectPage } from "./auth.js";
import { DEFAULT_ACADEMIC_TITLES, normalizeTitle, showMessage } from "./validation.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { deleteObject, ref } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

let user = null;
let teacher = null;
let selectedStudentUid = null;

function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
}

function dateText(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "";
}

function showView(name) {
  document.querySelectorAll("[data-view]").forEach((view) => {
    view.hidden = view.dataset.view !== name;
  });
}

function fillProfile() {
  text("welcomeName", teacher.name);
  text("teacherName", teacher.name);
  text("teacherEmail", teacher.email);
  text("teacherDepartment", teacher.department);
  text("teacherYear", teacher.year);
  text("teacherMobile", teacher.mobile);
  text("teacherScope", `${teacher.department} - Year ${teacher.year}`);
}

async function matchingStudents() {
  const snap = await getDocs(query(
    collection(db, "users"),
    where("role", "==", "student"),
    where("departmentKey", "==", teacher.departmentKey),
    where("year", "==", teacher.year)
  ));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => a.name.localeCompare(b.name));
}

async function academicDocs(studentUid = null) {
  const filters = [
    where("category", "==", "academic"),
    where("departmentKey", "==", teacher.departmentKey),
    where("year", "==", teacher.year)
  ];
  if (studentUid) filters.push(where("ownerUid", "==", studentUid));
  const snap = await getDocs(query(collection(db, "documents"), ...filters));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => a.title.localeCompare(b.title));
}

async function renderDashboard() {
  const students = await matchingStudents();
  const docs = await academicDocs();
  const titles = await academicTitles();
  text("studentCount", String(students.length));
  text("academicCount", String(docs.length));
  text("titleCount", String(titles.length));
}

async function renderStudents(filter = "") {
  const body = document.getElementById("studentRows");
  const empty = document.getElementById("studentEmpty");
  if (!body) return;
  const needle = filter.trim().toUpperCase();
  const students = (await matchingStudents()).filter((item) => !needle || item.name.includes(needle) || item.regNo.includes(needle));
  body.innerHTML = "";
  for (const student of students) {
    const docs = await academicDocs(student.uid);
    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${student.name}</b></td>
        <td>${student.regNo}</td>
        <td>${student.department}</td>
        <td>${student.year}</td>
        <td>${docs.length}</td>
        <td><button class="small-btn" data-student-id="${student.uid}">VIEW DATA</button></td>
      </tr>`);
  }
  if (empty) empty.hidden = students.length > 0;
}

async function renderStudentDetail(studentUid) {
  selectedStudentUid = studentUid;
  const student = (await matchingStudents()).find((item) => item.uid === studentUid);
  if (!student) return showMessage("Access denied for this student.", "danger");
  text("detailName", student.name);
  text("detailRegNo", student.regNo);
  text("detailEmail", student.email);
  text("detailDepartment", student.department);
  text("detailYear", student.year);
  text("detailMobile", student.mobile);
  const body = document.getElementById("academicRows");
  const docs = await academicDocs(studentUid);
  body.innerHTML = docs.map((item) => `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.fileName}</td>
      <td>${dateText(item.uploadedAt)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${item.fileURL}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${item.fileURL}" download="${item.fileName}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}" data-path="${item.storagePath}">REMOVE</button>
      </td>
    </tr>`).join("");
  showView("student-detail");
}

async function academicTitles() {
  const snap = await getDocs(query(
    collection(db, "academicTitles"),
    where("departmentKey", "==", teacher.departmentKey),
    where("year", "==", teacher.year)
  ));
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...snap.docs.map((item) => item.data())
  ].sort((a, b) => a.title.localeCompare(b.title));
}

async function renderTitles() {
  const wrap = document.getElementById("customTitles");
  if (!wrap) return;
  const snap = await getDocs(query(
    collection(db, "academicTitles"),
    where("departmentKey", "==", teacher.departmentKey),
    where("year", "==", teacher.year)
  ));
  wrap.innerHTML = snap.empty
    ? '<div class="empty-state">No custom titles added yet.</div>'
    : snap.docs.map((item) => `<span class="pill">${item.data().title}</span>`).join("");
}

async function renderStatus() {
  const grid = document.getElementById("statusGrid");
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
    const uploadedIds = new Set(docs.docs.map((item) => item.data().ownerUid));
    const uploaded = students.filter((item) => uploadedIds.has(item.uid));
    const pending = students.filter((item) => !uploadedIds.has(item.uid));
    grid.insertAdjacentHTML("beforeend", `
      <div class="status-card">
        <h2>${title.title}</h2>
        <div class="status-columns">
          <div><h3>Uploaded</h3>${nameList(uploaded, "good-list", "No uploads")}</div>
          <div><h3>Not Uploaded</h3>${nameList(pending, "warn-list", "All submitted")}</div>
        </div>
      </div>`);
  }
}

function nameList(students, className, emptyText) {
  if (!students.length) return `<p class="muted">${emptyText}</p>`;
  return `<ul class="name-list ${className}">${students.map((item) => `<li>${item.name} <small>${item.regNo}</small></li>`).join("")}</ul>`;
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("teacher", async (currentUser, currentProfile) => {
    user = currentUser;
    teacher = currentProfile;
    fillProfile();
    await renderDashboard();
    await renderStudents();
    await renderStatus();
    await renderTitles();
  });

  document.querySelectorAll("[data-open-view]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      showView(link.dataset.openView);
      if (link.dataset.openView === "students") await renderStudents();
      if (link.dataset.openView === "status") await renderStatus();
      if (link.dataset.openView === "add-title") await renderTitles();
    });
  });

  document.getElementById("searchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await renderStudents(event.currentTarget.elements.q.value);
    showView("students");
  });

  document.getElementById("addTitleForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = normalizeTitle(event.currentTarget.elements.title.value);
    if (!title) return showMessage("Enter document title.", "danger");
    await addDoc(collection(db, "academicTitles"), {
      title,
      department: teacher.department,
      departmentKey: teacher.departmentKey,
      year: teacher.year,
      createdByTeacherUid: user.uid,
      createdAt: serverTimestamp()
    });
    event.currentTarget.reset();
    await renderTitles();
    await renderDashboard();
    showMessage("Academic title added.", "success");
  });

  document.addEventListener("click", async (event) => {
    const studentButton = event.target.closest("[data-student-id]");
    if (studentButton) await renderStudentDetail(studentButton.dataset.studentId);

    const deleteButton = event.target.closest("[data-delete-doc]");
    if (deleteButton && confirm("Remove this academic document?")) {
      await deleteObject(ref(storage, deleteButton.dataset.path));
      await deleteDoc(doc(db, "documents", deleteButton.dataset.deleteDoc));
      if (selectedStudentUid) await renderStudentDetail(selectedStudentUid);
      showMessage("Academic document removed.", "success");
    }
  });
});
