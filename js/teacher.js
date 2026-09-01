import { protectPage } from "./auth.js";
import { escapeHtml, normalizeTitle, showMessage } from "./validation.js";
import { buildDocumentSubmissionStatusExcelBlob } from "./excel-report.mjs";

let teacher = null;
let selectedStudentUid = null;
let detailDocumentCache = [];
let statusDocumentCache = [];
let statusReportRows = [];
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
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "";
}

function downloadReportBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadStatusReport() {
  if (!teacher) throw new Error("Teacher profile not loaded.");
  const status = statusReportRows.length ? statusReportRows : await (await loadFirebaseService()).teacherStatus(teacher);
  statusReportRows = status;
  const documentTitles = status.map((titleBlock) => titleBlock.title);
  const studentsByUid = new Map();

  for (const titleBlock of status) {
    for (const [submitted, titleStudents] of [[true, titleBlock.uploaded], [false, titleBlock.pending]]) {
      for (const student of titleStudents) {
        const studentKey = student.uid || student.id || `${student.reg_no || ""}:${student.name || ""}`;
        if (!studentsByUid.has(studentKey)) {
          studentsByUid.set(studentKey, {
            studentName: student.name,
            registerNo: student.reg_no || "",
            department: student.department || "",
            year: student.year || "",
            submittedByTitle: {}
          });
        }
        studentsByUid.get(studentKey).submittedByTitle[titleBlock.title] = submitted;
      }
    }
  }

  const reportData = { documentTitles, students: [...studentsByUid.values()] };
  const blob = await buildDocumentSubmissionStatusExcelBlob(reportData);
  downloadReportBlob(blob, "document-submission-status-report.xlsx");
}

function findClosestAction(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
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

async function renderDashboard() {
  const { getTeacherDashboardSummary } = await loadFirebaseService();
  const summary = await getTeacherDashboardSummary(teacher);
  text("studentCount", String(summary.studentCount));
  text("academicCount", String(summary.academicCount));
  text("titleCount", String(summary.titleCount));
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
        <td><button type="button" class="small-btn" data-student-id="${escapeHtml(student.id)}">VIEW DATA</button></td>
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
        <button type="button" class="small-btn" data-view-doc="${escapeHtml(item.id)}">VIEW</button>
        <button type="button" class="small-btn" data-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button>
        <button type="button" class="small-btn danger" data-remove-doc="${escapeHtml(item.id)}">REMOVE</button>
      </td>
    </tr>`;
  }).join("");
  document.dispatchEvent(new CustomEvent("dashboard:navigate", {
    detail: { view: "student-detail" }
  }));
}

async function openStoredDocument(documentId, mode) {
  const item = detailDocumentCache.find((documentItem) => documentItem.id === documentId);
  if (!item) throw new Error("Document not found.");
  const previewWindow = mode === "view" ? window.open("about:blank", "_blank") : null;
  if (mode === "view" && !previewWindow) {
    throw new Error("Document preview was blocked. Allow pop-ups for this site and try again.");
  }
  if (previewWindow) previewWindow.opener = null;

  let url = "";
  try {
    const { getDocumentObjectUrl } = await loadFirebaseService();
    url = await getDocumentObjectUrl(item);
    if (previewWindow) {
      previewWindow.location.replace(url);
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = item.file_name || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } catch (error) {
    previewWindow?.close();
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    throw error;
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
      <td><button type="button" class="small-btn danger" data-remove-title="${escapeHtml(item.id)}" data-title-name="${escapeHtml(item.title)}">REMOVE</button></td>
    </tr>`).join("");
  if (empty) empty.hidden = custom.length > 0;
}

async function renderStatus() {
  const grid = document.getElementById("statusGrid");
  if (!grid) return;
  const { teacherStatus } = await loadFirebaseService();
  const status = await teacherStatus(teacher);
  statusReportRows = status;
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

async function renderViewData(view) {
  if (!teacher) return;
  if (view === "students") await safeRender("Student list load", renderStudents);
  if (view === "status") await safeRender("Submission status load", renderStatus);
  if (view === "add-title") await safeRender("Document title load", renderTitles);
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
    <button type="button" class="small-btn" data-status-view-doc="${escapeHtml(item.id)}">VIEW</button>
    <button type="button" class="small-btn" data-status-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button>`).join("")}</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("teacher", async (_currentUser, currentProfile) => {
    teacher = currentProfile;
    fillProfile();
    await safeRender("Teacher dashboard load", renderDashboard);
    const visibleView = document.querySelector("[data-view]:not([hidden])")?.dataset.view;
    if (visibleView && visibleView !== "dashboard") await renderViewData(visibleView);
  });

  document.addEventListener("dashboard:view-change", async (event) => {
    await renderViewData(event.detail?.view);
  });

  document.getElementById("searchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await safeRender("Student search", () => renderStudents(form.elements.q.value));
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

  document.getElementById("downloadStatusReportButton")?.addEventListener("click", async () => {
    await safeRender("Report download", downloadStatusReport);
  });

  document.addEventListener("click", async (event) => {
    const viewButton = findClosestAction(event.target, "[data-view-doc]");
    const downloadButton = findClosestAction(event.target, "[data-download-doc]");
    const removeDocumentButton = findClosestAction(event.target, "[data-remove-doc]");
    const statusViewButton = findClosestAction(event.target, "[data-status-view-doc]");
    const statusDownloadButton = findClosestAction(event.target, "[data-status-download-doc]");
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

    if (removeDocumentButton) {
      if (!confirm("Remove this academic document?")) return;
      try {
        const { deleteTeacherAcademicDocument } = await loadFirebaseService();
        await deleteTeacherAcademicDocument(teacher, removeDocumentButton.dataset.removeDoc);
        detailDocumentCache = detailDocumentCache.filter((item) => item.id !== removeDocumentButton.dataset.removeDoc);
        statusDocumentCache = [];
        statusReportRows = [];
        if (selectedStudentUid) await renderStudentDetail(selectedStudentUid);
        await renderDashboard();
        showMessage("Academic document removed.", "success");
      } catch (error) {
        console.error("Teacher document remove failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
      return;
    }

    const studentButton = findClosestAction(event.target, "[data-student-id]");
    if (studentButton) {
      try {
        await renderStudentDetail(studentButton.dataset.studentId);
      } catch (error) {
        console.error("Teacher student detail failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
    }

    const removeTitleButton = findClosestAction(event.target, "[data-remove-title]");
    if (removeTitleButton && confirm(`Remove document title "${removeTitleButton.dataset.titleName}"?`)) {
      try {
        const { deleteAcademicTitle } = await loadFirebaseService();
        await deleteAcademicTitle(teacher, removeTitleButton.dataset.removeTitle);
        await renderTitles();
        await renderDashboard();
        statusDocumentCache = [];
        statusReportRows = [];
        showMessage("Document title removed.", "success");
      } catch (error) {
        console.error("Teacher remove title failed", error);
        showMessage(await friendlyFirebaseError(error), "danger");
      }
    }
  });
});
