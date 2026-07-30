import { protectPage } from "./auth.js";
import {
  addAcademicTitle,
  deleteAcademicTitle,
  deleteTeacherAcademicDocument,
  firebaseErrorMessage,
  getDocumentObjectUrl,
  getTeacherStudentDetail,
  listAcademicTitles,
  listTeacherAcademicDocuments,
  listTeacherStudents,
  teacherStatus
} from "./firebase-service.js";
import { DEFAULT_ACADEMIC_TITLES, escapeHtml, normalizeTitle, showMessage } from "./validation.js";

let teacher = null;
let selectedStudentUid = null;
let detailDocumentCache = [];

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

async function safeRender(label, task) {
  try {
    await task();
  } catch (error) {
    console.error(`${label} failed`, error);
    showMessage(firebaseErrorMessage(error), "danger", { duration: 9000 });
  }
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
  detailDocumentCache = docs;
  body.innerHTML = docs.map((item) => {
    return `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td>${escapeHtml(item.file_name)}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td class="action-cell">
        <button class="small-btn" data-view-doc="${escapeHtml(item.id)}">VIEW</button>
        <button class="small-btn" data-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button>
        <button class="small-btn danger" data-delete-doc="${escapeHtml(item.id)}">REMOVE</button>
      </td>
    </tr>`;
  }).join("");
  showView("student-detail");
}

async function openStoredDocument(documentId, mode) {
  const item = detailDocumentCache.find((documentItem) => documentItem.id === documentId);
  if (!item) throw new Error("Document not found.");
  const url = await getDocumentObjectUrl(item);
  if (mode === "view") {
    window.open(url, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = item.file_name || "document";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function renderTitles() {
  const wrap = document.getElementById("customTitles");
  if (!wrap) return;
  const custom = await listAcademicTitles(teacher);
  wrap.innerHTML = !custom.length
    ? '<div class="empty-state">No custom titles added yet.</div>'
    : custom.map((item) => `<span class="pill">${escapeHtml(item.title)}</span>`).join("");
}

async function renderRemoveTitles() {
  const body = document.getElementById("removeTitleRows");
  const empty = document.getElementById("removeTitleEmpty");
  if (!body) return;
  const custom = await listAcademicTitles(teacher);
  body.innerHTML = custom.map((item) => `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td><button class="small-btn danger" data-remove-title="${escapeHtml(item.id)}" data-title-name="${escapeHtml(item.title)}">REMOVE</button></td>
    </tr>`).join("");
  if (empty) empty.hidden = custom.length > 0;
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
    await safeRender("Teacher dashboard load", renderDashboard);
    await safeRender("Student list load", renderStudents);
    await safeRender("Submission status load", renderStatus);
    await safeRender("Document title load", renderTitles);
  });

  document.querySelectorAll("[data-open-view]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      showView(link.dataset.openView);
      if (link.dataset.openView === "students") await safeRender("Student list load", renderStudents);
      if (link.dataset.openView === "status") await safeRender("Submission status load", renderStatus);
      if (link.dataset.openView === "add-title") await safeRender("Document title load", renderTitles);
      if (link.dataset.openView === "remove-title") await safeRender("Remove title list load", renderRemoveTitles);
    });
  });

  document.getElementById("searchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await safeRender("Student search", () => renderStudents(event.currentTarget.elements.q.value));
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
      await renderRemoveTitles();
      await renderDashboard();
      showMessage("Academic title added.", "success");
    } catch (error) {
      console.error("Teacher add title failed", error);
      showMessage(firebaseErrorMessage(error), "danger");
    }
  });

  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view-doc]");
    const downloadButton = event.target.closest("[data-download-doc]");
    if (viewButton || downloadButton) {
      try {
        await openStoredDocument(
          (viewButton || downloadButton).dataset.viewDoc || (viewButton || downloadButton).dataset.downloadDoc,
          viewButton ? "view" : "download"
        );
      } catch (error) {
        console.error("Teacher document open failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      }
      return;
    }

    const studentButton = event.target.closest("[data-student-id]");
    if (studentButton) {
      try {
        await renderStudentDetail(studentButton.dataset.studentId);
      } catch (error) {
        console.error("Teacher student detail failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      }
    }

    const removeTitleButton = event.target.closest("[data-remove-title]");
    if (removeTitleButton && confirm(`Remove document title "${removeTitleButton.dataset.titleName}"?`)) {
      try {
        await deleteAcademicTitle(teacher, removeTitleButton.dataset.removeTitle);
        await renderRemoveTitles();
        await renderTitles();
        await renderDashboard();
        await renderStatus();
        showMessage("Document title removed.", "success");
      } catch (error) {
        console.error("Teacher remove title failed", error);
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
