import { protectPage } from "./auth.js";
import { DEFAULT_ACADEMIC_TITLES, escapeHtml, normalizeTitle, showMessage } from "./validation.js";

let teacher = null;
let selectedStudentUid = null;
let detailDocumentCache = [];
let statusDocumentCache = [];
let firebaseServicePromise = null;

function loadFirebaseService() {
  if (!firebaseServicePromise) firebaseServicePromise = import("./firebase-service.js");
  return firebaseServicePromise;
}

async function friendlyFirebaseError(error) {
  try {
    const { firebaseErrorMessage } = await loadFirebaseService();
    return firebaseErrorMessage(error);
  } catch (loadError) {
    console.error("Firebase service failed to load", loadError);
    return error?.message || "Dashboard Firebase service failed to load. Refresh after the latest deployment completes.";
  }
}

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
  text("teacherScope", `${teacher.department} - Academic Year ${teacher.year}`);
}

async function safeRender(label, task) {
  try {
    await task();
  } catch (error) {
    console.error(`${label} failed`, error);
    showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
  }
}

async function matchingStudents(filter = "") {
  const { listTeacherStudents } = await loadFirebaseService();
  return listTeacherStudents(teacher, filter);
}

async function academicDocs(studentUid = null) {
  const { getTeacherStudentDetail, listTeacherAcademicDocuments } = await loadFirebaseService();
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
  const { listAcademicTitles } = await loadFirebaseService();
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
  const { getTeacherStudentDetail } = await loadFirebaseService();
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
  const { getDocumentObjectUrl } = await loadFirebaseService();
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
  const body = document.getElementById("customTitleRows");
  const empty = document.getElementById("customTitleEmpty");
  if (!body) return;
  const { listAcademicTitles } = await loadFirebaseService();
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
  const { teacherStatus } = await loadFirebaseService();
  const status = await teacherStatus(teacher);
  statusDocumentCache = status.flatMap((row) => row.uploaded.flatMap((student) => student.documents || []));
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
  return `<ul class="name-list ${className}">${students.map((item) => `
    <li>
      <span>${escapeHtml(item.name)} <small>${escapeHtml(item.reg_no || "")}</small></span>
      ${statusDocumentButtons(item.documents || [])}
    </li>`).join("")}</ul>`;
}

function statusDocumentButtons(documents) {
  if (!documents.length) return "";
  return `<div class="status-actions">${documents.map((item) => `
    <button class="small-btn" data-status-view-doc="${escapeHtml(item.id)}">VIEW</button>
    <button class="small-btn" data-status-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button>`).join("")}</div>`;
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

  document.addEventListener("dashboard:view-change", async (event) => {
    const view = event.detail?.view;
    if (view === "students") await safeRender("Student list load", renderStudents);
    if (view === "status") await safeRender("Submission status load", renderStatus);
    if (view === "add-title") await safeRender("Document title load", renderTitles);
  });

  document.getElementById("searchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await safeRender("Student search", () => renderStudents(form.elements.q.value));
    showView("students");
  });

  document.getElementById("addTitleForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = normalizeTitle(form.elements.title.value);
    if (!title) return showMessage("Enter document title.", "danger");
    try {
      const { addAcademicTitle } = await loadFirebaseService();
      await addAcademicTitle(teacher, title);
      form.reset();
      await renderTitles();
      await renderDashboard();
      showMessage("Academic title added.", "success");
    } catch (error) {
      console.error("Teacher add title failed", error);
      showMessage(await friendlyFirebaseError(error), "danger");
    }
  });

  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view-doc]");
    const downloadButton = event.target.closest("[data-download-doc]");
    const statusViewButton = event.target.closest("[data-status-view-doc]");
    const statusDownloadButton = event.target.closest("[data-status-download-doc]");
    if (statusViewButton || statusDownloadButton) {
      try {
        const documentId = statusViewButton?.dataset.statusViewDoc || statusDownloadButton?.dataset.statusDownloadDoc;
        const item = statusDocumentCache.find((documentItem) => documentItem.id === documentId);
        if (!item) throw new Error("Document not found.");
        detailDocumentCache = [...detailDocumentCache.filter((documentItem) => documentItem.id !== item.id), item];
        await openStoredDocument(item.id, statusViewButton ? "view" : "download");
      } catch (error) {
        console.error("Teacher status document open failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
      return;
    }

    if (viewButton || downloadButton) {
      try {
        await openStoredDocument(
          (viewButton || downloadButton).dataset.viewDoc || (viewButton || downloadButton).dataset.downloadDoc,
          viewButton ? "view" : "download"
        );
      } catch (error) {
        console.error("Teacher document open failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
      return;
    }

    const studentButton = event.target.closest("[data-student-id]");
    if (studentButton) {
      try {
        await renderStudentDetail(studentButton.dataset.studentId);
      } catch (error) {
        console.error("Teacher student detail failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
    }

    const removeTitleButton = event.target.closest("[data-remove-title]");
    if (removeTitleButton && confirm(`Remove document title "${removeTitleButton.dataset.titleName}"?`)) {
      try {
        const { deleteAcademicTitle } = await loadFirebaseService();
        await deleteAcademicTitle(teacher, removeTitleButton.dataset.removeTitle);
        await renderTitles();
        await renderDashboard();
        await renderStatus();
        showMessage("Document title removed.", "success");
      } catch (error) {
        console.error("Teacher remove title failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
    }

    const deleteButton = event.target.closest("[data-delete-doc]");
    if (deleteButton && confirm("Remove this academic document?")) {
      try {
        const { deleteTeacherAcademicDocument } = await loadFirebaseService();
        await deleteTeacherAcademicDocument(teacher, deleteButton.dataset.deleteDoc);
        if (selectedStudentUid) await renderStudentDetail(selectedStudentUid);
        await renderDashboard();
        showMessage("Academic document removed.", "success");
      } catch (error) {
        console.error("Teacher academic document delete failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
    }
  });
});
