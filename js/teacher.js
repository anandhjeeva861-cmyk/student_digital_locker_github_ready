import { apiDelete, apiGet, apiPost, fileUrl } from "./api.js";
import { protectPage } from "./auth.js";
import { normalizeTitle, showMessage } from "./validation.js";

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

async function matchingStudents(filter = "") {
  const query = filter ? `?q=${encodeURIComponent(filter)}` : "";
  const data = await apiGet(`/teacher/students${query}`);
  return data.students || [];
}

async function academicDocs(studentUid = null) {
  if (studentUid) {
    const data = await apiGet(`/teacher/students/${studentUid}`);
    return data.documents || [];
  }
  const data = await apiGet("/teacher/academic-documents");
  return data.documents || [];
}

async function renderDashboard() {
  const students = await matchingStudents();
  const docs = await academicDocs();
  const titles = await apiGet("/teacher/academic-titles");
  text("studentCount", String(students.length));
  text("academicCount", String(docs.length));
  text("titleCount", String((titles.titles || []).length));
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
        <td><b>${student.name}</b></td>
        <td>${student.reg_no || ""}</td>
        <td>${student.department}</td>
        <td>${student.year}</td>
        <td>${student.academic_count || 0}</td>
        <td><button class="small-btn" data-student-id="${student.id}">VIEW DATA</button></td>
      </tr>`);
  }
  if (empty) empty.hidden = students.length > 0;
}

async function renderStudentDetail(studentUid) {
  selectedStudentUid = studentUid;
  const data = await apiGet(`/teacher/students/${studentUid}`);
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
    const url = fileUrl(item.file_url);
    return `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.file_name}</td>
      <td>${dateText(item.uploaded_at)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${url}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${url}" download="${item.file_name}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}">REMOVE</button>
      </td>
    </tr>`;
  }).join("");
  showView("student-detail");
}

async function renderTitles() {
  const wrap = document.getElementById("customTitles");
  if (!wrap) return;
  const data = await apiGet("/teacher/academic-titles");
  const custom = data.customTitles || [];
  wrap.innerHTML = !custom.length
    ? '<div class="empty-state">No custom titles added yet.</div>'
    : custom.map((item) => `<span class="pill">${item.title}</span>`).join("");
}

async function renderStatus() {
  const grid = document.getElementById("statusGrid");
  if (!grid) return;
  const data = await apiGet("/teacher/status");
  grid.innerHTML = "";
  for (const row of data.status || []) {
    grid.insertAdjacentHTML("beforeend", `
      <div class="status-card">
        <h2>${row.title}</h2>
        <div class="status-columns">
          <div><h3>Uploaded</h3>${nameList(row.uploaded, "good-list", "No uploads")}</div>
          <div><h3>Not Uploaded</h3>${nameList(row.pending, "warn-list", "All submitted")}</div>
        </div>
      </div>`);
  }
}

function nameList(students, className, emptyText) {
  if (!students.length) return `<p class="muted">${emptyText}</p>`;
  return `<ul class="name-list ${className}">${students.map((item) => `<li>${item.name} <small>${item.reg_no || ""}</small></li>`).join("")}</ul>`;
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
    try {
      await apiPost("/teacher/academic-titles", { title });
      event.currentTarget.reset();
      await renderTitles();
      await renderDashboard();
      showMessage("Academic title added.", "success");
    } catch (error) {
      showMessage(error.message, "danger");
    }
  });

  document.addEventListener("click", async (event) => {
    const studentButton = event.target.closest("[data-student-id]");
    if (studentButton) await renderStudentDetail(studentButton.dataset.studentId);

    const deleteButton = event.target.closest("[data-delete-doc]");
    if (deleteButton && confirm("Remove this academic document?")) {
      try {
        await apiDelete(`/teacher/academic-documents/${deleteButton.dataset.deleteDoc}`);
        if (selectedStudentUid) await renderStudentDetail(selectedStudentUid);
        await renderDashboard();
        showMessage("Academic document removed.", "success");
      } catch (error) {
        showMessage(error.message, "danger");
      }
    }
  });
});
