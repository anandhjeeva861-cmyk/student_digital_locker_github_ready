import { protectPage } from "./auth.js";
import {
  addAcademicTitle,
  deleteTeacherAcademicDocument,
  firebaseErrorMessage,
  getTeacherStudentDetail,
  listAcademicTitles,
  listTeacherAcademicDocuments,
  listTeacherStudents,
  teacherStatus
} from "./firebase-service.js";
import { DEFAULT_ACADEMIC_TITLES, escapeHtml, normalizeTitle, showMessage } from "./validation.js";

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

async function matchingStudents(filter = "") {
  return listTeacherStudents(teacher, filter);
}

async function academicDocs(studentUid = null) {
  if (studentUid) {
    return (await getTeacherStudentDetail(teacher, studentUid)).documents || [];
  }
  return listTeacherAcademicDocuments(teacher);
}

async function renderDashboard() {
  const students = await matchingStudents();
  const docs = await academicDocs();
  const titles = await allAcademicTitles();
  text("studentCount", String(students.length));
  text("academicCount", String(docs.length));
  text("titleCount", String(titles.length));
}

async function allAcademicTitles() {
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...(await listAcademicTitles(teacher))
  ].filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index);
}

async function renderStudents(filter = "") {
  const body = document.getElementById("studentRows");
  const empty = document.getElementById("studentEmpty");
  if (!body) return;
  const students = await matchingStudents(filter);
  body.innerHTML = "";
  for (const student of students) {
    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${escapeHtml(student.name)}</b></td>
        <td>${escapeHtml(student.reg_no || "")}</td>
        <td>${escapeHtml(student.department)}</td>
        <td>${escapeHtml(student.year)}</td>
        <td>${student.academic_count || 0}</td>
        <td><button class="small-btn" data-student-id="${escapeHtml(student.id)}">VIEW DATA</button></td>
      </tr>`);
  }
  if (empty) empty.hidden = students.length > 0;
}

async function renderStudentDetail(studentUid) {
  selectedStudentUid = studentUid;
  const data = await getTeacherStudentDetail(teacher, studentUid);
  const student = data.student;
  text("detailName", student.name);
  text("detailRegNo", student.reg_no);
  text("detailEmail", student.email);
  text("detailDepartment", student.department);
  text("detailYear", student.year);
  text("detailMobile", student.mobile);
  const body = document.getElementById("academicRows");
  const docs = data.documents || [];
  body.innerHTML = docs.map((item) => {
    const url = item.file_url;
    return `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td>${escapeHtml(item.file_name)}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td class="action-cell">
        <a class="small-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${escapeHtml(url)}" download="${escapeHtml(item.file_name)}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${escapeHtml(item.id)}">REMOVE</button>
      </td>
    </tr>`;
  }).join("");
  showView("student-detail");
}

async function renderTitles() {
  const wrap = document.getElementById("customTitles");
  if (!wrap) return;
  const custom = await listAcademicTitles(teacher);
  wrap.innerHTML = !custom.length
    ? '<div class="empty-state">No custom titles added yet.</div>'
    : custom.map((item) => `<span class="pill">${escapeHtml(item.title)}</span>`).join("");
}

async function renderStatus() {
  const grid = document.getElementById("statusGrid");
  if (!grid) return;
  const status = await teacherStatus(teacher);
  grid.innerHTML = "";
  for (const row of status) {
    grid.insertAdjacentHTML("beforeend", `
      <div class="status-card">
        <h2>${escapeHtml(row.title)}</h2>
        <div class="status-columns">
          <div><h3>Uploaded</h3>${nameList(row.uploaded, "good-list", "No uploads")}</div>
          <div><h3>Not Uploaded</h3>${nameList(row.pending, "warn-list", "All submitted")}</div>
        </div>
      </div>`);
  }
}

function nameList(students, className, emptyText) {
  if (!students.length) return `<p class="muted">${emptyText}</p>`;
  return `<ul class="name-list ${className}">${students.map((item) => `<li>${escapeHtml(item.name)} <small>${escapeHtml(item.reg_no || "")}</small></li>`).join("")}</ul>`;
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("teacher", async (_currentUser, currentProfile) => {
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
    try {
      await addAcademicTitle(teacher, title);
      event.currentTarget.reset();
      await renderTitles();
      await renderDashboard();
      showMessage("Academic title added.", "success");
    } catch (error) {
      console.error("Teacher add title failed", error);
      showMessage(firebaseErrorMessage(error), "danger");
    }
  });

  document.addEventListener("click", async (event) => {
    const studentButton = event.target.closest("[data-student-id]");
    if (studentButton) {
      try {
        await renderStudentDetail(studentButton.dataset.studentId);
      } catch (error) {
        console.error("Teacher student detail failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      }
    }

    const deleteButton = event.target.closest("[data-delete-doc]");
    if (deleteButton && confirm("Remove this academic document?")) {
      try {
        await deleteTeacherAcademicDocument(teacher, deleteButton.dataset.deleteDoc);
        if (selectedStudentUid) await renderStudentDetail(selectedStudentUid);
        await renderDashboard();
        showMessage("Academic document removed.", "success");
      } catch (error) {
        console.error("Teacher academic document delete failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      }
    }
  });
});
