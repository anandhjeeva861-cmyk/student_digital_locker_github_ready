import { protectPage } from "./auth.js";
import { academicTitles as savedTitles, documents, saveAcademicTitles, saveDocuments, uid } from "./local-db.js";
import { DEFAULT_ACADEMIC_TITLES, normalizeTitle, showMessage } from "./validation.js";

let user = null;
let teacher = null;
let selectedStudentUid = null;

function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
}

function dateText(value) {
  return value ? new Date(value).toLocaleString() : "";
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

function matchingStudents() {
  const rows = JSON.parse(localStorage.getItem("sdl_profiles") || "[]");
  return rows
    .filter((item) => item.role === "student" && item.department_key === teacher.department_key && item.year === teacher.year)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function academicDocs(studentUid = null) {
  return documents()
    .filter((item) => item.category === "academic" && item.department_key === teacher.department_key && item.year === teacher.year)
    .filter((item) => !studentUid || item.owner_id === studentUid)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function academicTitles() {
  const custom = savedTitles().filter((item) => item.department_key === teacher.department_key && item.year === teacher.year);
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...custom
  ].sort((a, b) => a.title.localeCompare(b.title));
}

function renderDashboard() {
  const students = matchingStudents();
  const docs = academicDocs();
  const titles = academicTitles();
  text("studentCount", String(students.length));
  text("academicCount", String(docs.length));
  text("titleCount", String(titles.length));
}

function renderStudents(filter = "") {
  const body = document.getElementById("studentRows");
  const empty = document.getElementById("studentEmpty");
  if (!body) return;
  const needle = filter.trim().toUpperCase();
  const students = matchingStudents().filter((item) => {
    const regNo = item.reg_no || "";
    return !needle || item.name.includes(needle) || regNo.includes(needle);
  });
  body.innerHTML = "";
  for (const student of students) {
    const docs = academicDocs(student.id);
    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${student.name}</b></td>
        <td>${student.reg_no}</td>
        <td>${student.department}</td>
        <td>${student.year}</td>
        <td>${docs.length}</td>
        <td><button class="small-btn" data-student-id="${student.id}">VIEW DATA</button></td>
      </tr>`);
  }
  if (empty) empty.hidden = students.length > 0;
}

function renderStudentDetail(studentUid) {
  selectedStudentUid = studentUid;
  const student = matchingStudents().find((item) => item.id === studentUid);
  if (!student) return showMessage("Access denied for this student.", "danger");
  text("detailName", student.name);
  text("detailRegNo", student.reg_no);
  text("detailEmail", student.email);
  text("detailDepartment", student.department);
  text("detailYear", student.year);
  text("detailMobile", student.mobile);
  const body = document.getElementById("academicRows");
  const docs = academicDocs(studentUid);
  body.innerHTML = docs.map((item) => `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.file_name}</td>
      <td>${dateText(item.uploaded_at)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${item.file_url}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${item.file_url}" download="${item.file_name}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}">REMOVE</button>
      </td>
    </tr>`).join("");
  showView("student-detail");
}

function renderTitles() {
  const wrap = document.getElementById("customTitles");
  if (!wrap) return;
  const data = savedTitles().filter((item) => item.department_key === teacher.department_key && item.year === teacher.year);
  wrap.innerHTML = !data.length
    ? '<div class="empty-state">No custom titles added yet.</div>'
    : data.map((item) => `<span class="pill">${item.title}</span>`).join("");
}

function renderStatus() {
  const grid = document.getElementById("statusGrid");
  if (!grid) return;
  const students = matchingStudents();
  const titles = academicTitles();
  grid.innerHTML = "";
  for (const title of titles) {
    const uploadedIds = new Set(academicDocs().filter((item) => item.title === title.title).map((item) => item.owner_id));
    const uploaded = students.filter((item) => uploadedIds.has(item.id));
    const pending = students.filter((item) => !uploadedIds.has(item.id));
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
  return `<ul class="name-list ${className}">${students.map((item) => `<li>${item.name} <small>${item.reg_no}</small></li>`).join("")}</ul>`;
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("teacher", async (currentUser, currentProfile) => {
    user = currentUser;
    teacher = currentProfile;
    fillProfile();
    renderDashboard();
    renderStudents();
    renderStatus();
    renderTitles();
  });

  document.querySelectorAll("[data-open-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showView(link.dataset.openView);
      if (link.dataset.openView === "students") renderStudents();
      if (link.dataset.openView === "status") renderStatus();
      if (link.dataset.openView === "add-title") renderTitles();
    });
  });

  document.getElementById("searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderStudents(event.currentTarget.elements.q.value);
    showView("students");
  });

  document.getElementById("addTitleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = normalizeTitle(event.currentTarget.elements.title.value);
    if (!title) return showMessage("Enter document title.", "danger");
    const rows = savedTitles();
    const exists = rows.some((item) => item.department_key === teacher.department_key && item.year === teacher.year && item.title === title);
    if (exists || DEFAULT_ACADEMIC_TITLES.includes(title)) {
      showMessage("This academic title already exists.", "warning");
      return;
    }

    saveAcademicTitles([...rows, {
      id: uid(),
      title,
      department: teacher.department,
      department_key: teacher.department_key,
      year: teacher.year,
      created_by_teacher_id: user.id,
      created_at: new Date().toISOString()
    }]);

    event.currentTarget.reset();
    renderTitles();
    renderDashboard();
    showMessage("Academic title added.", "success");
  });

  document.addEventListener("click", (event) => {
    const studentButton = event.target.closest("[data-student-id]");
    if (studentButton) renderStudentDetail(studentButton.dataset.studentId);

    const deleteButton = event.target.closest("[data-delete-doc]");
    if (deleteButton && confirm("Remove this academic document?")) {
      saveDocuments(documents().filter((item) => item.id !== deleteButton.dataset.deleteDoc));
      if (selectedStudentUid) renderStudentDetail(selectedStudentUid);
      renderDashboard();
      showMessage("Academic document removed.", "success");
    }
  });
});
