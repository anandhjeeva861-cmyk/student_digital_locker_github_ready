import { protectPage } from "./auth.js";
import { escapeHtml, normalizeTitle, showMessage } from "./validation.js";
import { buildDocumentSubmissionStatusExcelBlob } from "./excel-report.mjs";

let teacher = null;
let selectedStudentUid = null;
let detailDocumentCache = [];
let statusDocumentCache = [];
let statusReportRows = [];
let selectedBatch = null;
let selectedBatchMembers = [];
let currentBatches = [];
let previousBatches = [];
let pendingGraduationBatchId = "";
let pendingConversion = null;
let pendingRemoveBatchStudent = null;
let alumniFilters = {};
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
  const date = value?.toDate?.() || (value ? new Date(value) : null);
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
  const teachingBatch = teacher.teachingBatch || teacher.year || "Not available";
  text("teacherYear", teachingBatch);
  text("teacherMobile", teacher.mobile);
  text("teacherScope", `${teacher.department} - Teaching Batch ${teachingBatch}`);
  const courseInput = document.getElementById("batchCourseName");
  if (courseInput && !courseInput.value) courseInput.value = teacher.department;
  const batchInput = document.getElementById("batchLabel");
  if (batchInput) batchInput.value = teachingBatch;
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

function displayValue(value, fallback = "Not available") {
  return value === 0 || value ? String(value) : fallback;
}

function careerStatusLabel(value) {
  return ({ not_updated: "Not Updated", employed: "Employed", higher_studies: "Higher Studies", entrepreneur: "Entrepreneur", seeking_opportunity: "Seeking Opportunity", other: "Other" })[value] || "Not Updated";
}

function batchCard(batch, previous = false) {
  const academicYear = batch.currentAcademicYear ? `${batch.currentAcademicYear}` : "Not available";
  const graduateAction = !previous && batch.eligibleForGraduation
    ? `<button type="button" class="small-btn success" data-graduate-batch="${escapeHtml(batch.id)}">GRADUATE BATCH</button>`
    : "";
  return `<article class="batch-card"><h3>${escapeHtml(batch.courseName || batch.department)}</h3><div class="batch-meta"><div><b>Batch:</b> ${escapeHtml(batch.batchLabel || batch.id)}</div>${previous ? "" : `<div><b>Current Academic Year:</b> ${escapeHtml(academicYear)}</div>`}<div><b>Students:</b> ${previous ? batch.memberCount || 0 : batch.studentCount || 0}</div>${previous ? `<div><b>Alumni:</b> ${batch.alumniCount || 0}</div>` : ""}<div><span class="status-badge">${escapeHtml(batch.status)}</span></div></div><div class="batch-actions"><button type="button" class="small-btn" data-view-batch="${escapeHtml(batch.id)}">${previous ? "VIEW BATCH DETAILS" : "VIEW STUDENTS"}</button>${previous ? `<button type="button" class="small-btn" data-view-batch-alumni="${escapeHtml(batch.id)}">VIEW ALUMNI</button>` : ""}${graduateAction}</div></article>`;
}

function populateBatchSelect(select, batches, placeholder) {
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${batches.map((batch) => `<option value="${escapeHtml(batch.id)}">${escapeHtml(batch.batchLabel)} — ${escapeHtml(batch.courseName || batch.department)}</option>`).join("")}`;
  if (batches.some((batch) => batch.id === selected)) select.value = selected;
}

async function renderBatches() {
  const service = await loadFirebaseService();
  const batches = await service.listTeacherBatches(teacher);
  currentBatches = batches.filter((batch) => ["active", "graduating"].includes(batch.status));
  previousBatches = batches.filter((batch) => ["graduated", "archived"].includes(batch.status));
  const currentGrid = document.getElementById("currentBatchGrid");
  const previousGrid = document.getElementById("previousBatchGrid");
  if (currentGrid) currentGrid.innerHTML = currentBatches.map((batch) => batchCard(batch)).join("");
  if (previousGrid) previousGrid.innerHTML = previousBatches.map((batch) => batchCard(batch, true)).join("");
  const currentEmpty = document.getElementById("currentBatchEmpty");
  const previousEmpty = document.getElementById("previousBatchEmpty");
  if (currentEmpty) currentEmpty.hidden = currentBatches.length > 0;
  if (previousEmpty) previousEmpty.hidden = previousBatches.length > 0;
  populateBatchSelect(document.getElementById("assignmentBatch"), currentBatches.filter((batch) => batch.status === "active"), "Select batch");
  populateBatchSelect(document.getElementById("alumniBatchFilter"), [...currentBatches, ...previousBatches], "All authorized batches");
  await renderAssignableStudents(document.getElementById("assignmentBatch")?.value || "");
}

async function renderAssignableStudents(batchId) {
  const select = document.getElementById("assignmentStudent");
  if (!select) return;
  select.innerHTML = '<option value="">Select student</option>';
  if (!batchId) return;
  const students = await (await loadFirebaseService()).listAssignableStudents(teacher, batchId);
  select.insertAdjacentHTML("beforeend", students.map((student) => `<option value="${escapeHtml(student.uid)}">${escapeHtml(student.name)} — ${escapeHtml(student.regNo)}</option>`).join(""));
}

async function renderBatchDetail(batchId) {
  const data = await (await loadFirebaseService()).getTeacherBatchStudents(teacher, batchId);
  selectedBatch = data.batch;
  selectedBatchMembers = [...data.students, ...data.alumni];
  text("batchDetailLabel", `${data.batch.courseName || data.batch.department} — ${data.batch.batchLabel}`);
  text("batchDetailSummary", `${data.batch.department} • ${String(data.batch.status || "").toUpperCase()} • Graduation ${data.batch.graduationYear}`);
  text("batchMemberHeading", data.batch.status === "active" ? "Current Students" : "Batch Members");
  text("batchMemberCount", `${selectedBatchMembers.length} member${selectedBatchMembers.length === 1 ? "" : "s"}`);
  const body = document.getElementById("batchMemberRows");
  if (body) body.innerHTML = selectedBatchMembers.map((member) => `<tr><td><b>${escapeHtml(member.name)}</b></td><td>${escapeHtml(member.regNo)}</td><td>${escapeHtml(member.department)}</td><td>${escapeHtml(member.batch || member.year || "Not available")}</td><td>${escapeHtml(member.role === "alumni" ? "Alumni" : "Student")}</td><td class="action-cell">${member.role === "student" ? `<button type="button" class="small-btn" data-student-id="${escapeHtml(member.uid)}">VIEW DATA</button>${data.batch.eligibleForGraduation ? `<button type="button" class="small-btn success" data-convert-student="${escapeHtml(member.uid)}">CONVERT TO ALUMNI</button>` : ""}` : `<button type="button" class="small-btn" data-alumni-id="${escapeHtml(member.uid)}">VIEW DETAILS</button>`}</td></tr>`).join("");
  const empty = document.getElementById("batchMemberEmpty");
  if (empty) empty.hidden = selectedBatchMembers.length > 0;
  document.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { view: "batch-detail" } }));
}

async function renderAlumni(filters = alumniFilters) {
  alumniFilters = { ...filters };
  const alumni = await (await loadFirebaseService()).listTeacherAlumni(teacher, filters);
  const body = document.getElementById("alumniRows");
  if (body) body.innerHTML = alumni.map((item) => `<tr><td><b>${escapeHtml(item.name)}</b></td><td>${escapeHtml(item.regNo)}</td><td>${escapeHtml(item.department)}</td><td>${escapeHtml(item.batch || item.year || "Not available")}</td><td>${escapeHtml(displayValue(item.graduationYear))}</td><td>${escapeHtml(careerStatusLabel(item.careerStatus))}</td><td><button type="button" class="small-btn" data-alumni-id="${escapeHtml(item.uid)}">VIEW DETAILS</button></td></tr>`).join("");
  const empty = document.getElementById("alumniEmpty");
  if (empty) empty.hidden = alumni.length > 0;
}

function careerDetailRows(profile) {
  const status = profile.careerStatus || "not_updated";
  const data = profile.careerProfile || {};
  const rowsByStatus = {
    employed: [["Company", data.company], ["Job Title", data.jobTitle], ["Location", data.location], ["Joining Year", data.joiningYear]],
    higher_studies: [["Institution", data.institution], ["Course", data.course], ["Location", data.location], ["Joining Year", data.joiningYear]],
    entrepreneur: [["Business Name", data.businessName], ["Role", data.role], ["Location", data.location], ["Started Year", data.startedYear]],
    seeking_opportunity: [["Area of Interest", data.areaOfInterest]],
    other: [["Description", data.description]],
    not_updated: []
  };
  const rows = rowsByStatus[status] || [];
  return rows.length ? rows.map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(displayValue(value))}</b></div>`).join("") : '<p class="muted">Career information has not been updated.</p>';
}

async function renderAlumniDetail(uid) {
  const alumni = await (await loadFirebaseService()).getTeacherAlumniDetail(teacher, uid);
  text("alumniDetailName", alumni.name);
  text("alumniDetailRegNo", alumni.regNo);
  text("alumniDetailEmail", alumni.email);
  text("alumniDetailDepartment", alumni.department);
  text("alumniDetailBatch", alumni.batch || alumni.year);
  text("alumniDetailGraduationYear", displayValue(alumni.graduationYear));
  text("alumniDetailGraduatedAt", dateText(alumni.graduatedAt));
  text("alumniDetailCareerStatus", careerStatusLabel(alumni.careerStatus));
  const career = document.getElementById("alumniCareerDetails");
  if (career) career.innerHTML = careerDetailRows(alumni);
  document.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { view: "alumni-detail" } }));
}

async function openGraduationDialog(batchId) {
  const data = await (await loadFirebaseService()).getTeacherBatchStudents(teacher, batchId);
  if (!data.batch.eligibleForGraduation) throw new Error("This batch is not yet eligible for graduation.");
  if (!data.students.length && !data.alumni.length) throw new Error("Assign students before graduating this batch.");
  pendingGraduationBatchId = batchId;
  text("confirmBatchLabel", data.batch.batchLabel);
  text("confirmBatchDepartment", data.batch.department);
  text("confirmGraduationYear", displayValue(data.batch.graduationYear));
  text("confirmStudentCount", displayValue(data.students.length));
  const button = document.getElementById("confirmGraduationButton");
  if (button) button.textContent = data.students.length ? `GRADUATE ${data.students.length} STUDENTS` : "COMPLETE GRADUATION";
  document.getElementById("graduationDialog")?.showModal();
}

function openStudentConversionDialog(studentUid) {
  const student = selectedBatchMembers.find((item) => item.uid === studentUid);
  if (!student || !selectedBatch) throw new Error("Student or batch details are unavailable.");
  pendingConversion = { studentUid, batchId: selectedBatch.id };
  text("convertStudentName", student.name);
  text("convertStudentRegNo", student.regNo);
  text("convertStudentBatch", student.batch || selectedBatch.batchLabel);
  text("convertStudentDepartment", student.department);
  text("convertStudentGraduationYear", displayValue(student.graduationYear || selectedBatch.graduationYear));
  document.getElementById("studentConversionDialog")?.showModal();
}

async function renderStudents(filter = "") {
  const body = document.getElementById("studentRows");
  const empty = document.getElementById("studentEmpty");
  if (!body) return;
  const students = await matchingStudents(filter);
  text("studentListDepartment", teacher.department);
  text("studentListBatch", teacher.teachingBatch || teacher.year || "Not available");
  text("studentListTotal", String(students.length));
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

async function renderRemoveBatchStudents() {
  const body = document.getElementById("removeBatchStudentRows");
  const empty = document.getElementById("removeBatchStudentEmpty");
  if (!body) return;
  const students = await matchingStudents();
  body.innerHTML = students.map((student) => `
    <tr>
      <td><b>${escapeHtml(student.name)}</b></td>
      <td>${escapeHtml(student.reg_no || "")}</td>
      <td>${escapeHtml(student.department)}</td>
      <td>${escapeHtml(student.year || student.batch || "Not available")}</td>
      <td>${escapeHtml(student.batchId ? (student.batch || student.year || "Not available") : "Not assigned")}</td>
      <td><button type="button" class="small-btn danger" data-remove-batch-student="${escapeHtml(student.id)}">REMOVE FROM BATCH</button></td>
    </tr>`).join("");
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
  if (view === "dashboard") await safeRender("Teacher dashboard load", renderDashboard);
  if (view === "batches") await safeRender("Batch load", renderBatches);
  if (view === "students") await safeRender("Student list load", renderStudents);
  if (view === "status") await safeRender("Submission status load", renderStatus);
  if (view === "add-title") await safeRender("Document title load", renderTitles);
  if (view === "remove-batch-student") await safeRender("Remove batch student load", renderRemoveBatchStudents);
  if (view === "alumni") {
    await safeRender("Alumni batch filters", renderBatches);
    await safeRender("Alumni list load", renderAlumni);
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

  document.getElementById("createBatchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      await (await loadFirebaseService()).createTeacherBatch(teacher, {
        courseName: form.elements.courseName.value,
        batchLabel: form.elements.batchLabel.value
      });
      form.reset();
      fillProfile();
      await renderBatches();
      await renderDashboard();
      showMessage("Batch created and assigned to you.", "success");
    } catch (error) {
      console.error("Batch creation failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("assignmentBatch")?.addEventListener("change", async (event) => {
    await safeRender("Assignable students load", () => renderAssignableStudents(event.target.value));
  });

  document.getElementById("assignBatchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      await (await loadFirebaseService()).assignStudentToBatch(teacher, form.elements.studentUid.value, form.elements.batchId.value);
      await renderBatches();
      await renderStudents();
      await renderDashboard();
      showMessage("Student assigned to the batch.", "success");
    } catch (error) {
      console.error("Student batch assignment failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("alumniSearchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    alumniFilters = values;
    await safeRender("Alumni filter", () => renderAlumni(alumniFilters));
  });

  document.querySelectorAll("[data-graduation-cancel]").forEach((button) => button.addEventListener("click", () => {
    pendingGraduationBatchId = "";
    document.getElementById("graduationDialog")?.close();
  }));
  document.querySelectorAll("[data-conversion-cancel]").forEach((button) => button.addEventListener("click", () => {
    pendingConversion = null;
    document.getElementById("studentConversionDialog")?.close();
  }));

  document.getElementById("confirmGraduationButton")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!pendingGraduationBatchId || button.disabled) return;
    button.disabled = true;
    const batchId = pendingGraduationBatchId;
    try {
      const count = await (await loadFirebaseService()).graduateBatch(teacher, batchId);
      pendingGraduationBatchId = "";
      document.getElementById("graduationDialog")?.close();
      await renderBatches();
      await renderStudents();
      await renderDashboard();
      showMessage(`${count} student${count === 1 ? "" : "s"} converted to Alumni. Accounts and documents were preserved.`, "success", { duration: 9000 });
    } catch (error) {
      console.error("Batch graduation failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("confirmStudentConversionButton")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!pendingConversion || button.disabled) return;
    button.disabled = true;
    const conversion = pendingConversion;
    try {
      await (await loadFirebaseService()).convertStudentToAlumni(teacher, conversion.studentUid, conversion.batchId);
      pendingConversion = null;
      document.getElementById("studentConversionDialog")?.close();
      await renderBatchDetail(conversion.batchId);
      await renderStudents();
      await renderDashboard();
      showMessage("Student converted to Alumni. The account and documents were preserved.", "success", { duration: 9000 });
    } catch (error) {
      console.error("Student conversion failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-remove-batch-student-cancel]").forEach((button) => button.addEventListener("click", () => {
    pendingRemoveBatchStudent = null;
    document.getElementById("removeBatchStudentDialog")?.close();
  }));

  document.getElementById("confirmRemoveBatchStudentButton")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!pendingRemoveBatchStudent || button.disabled) return;
    button.disabled = true;
    try {
      const { removeStudentFromCurrentBatch } = await loadFirebaseService();
      await removeStudentFromCurrentBatch(teacher, pendingRemoveBatchStudent);
      pendingRemoveBatchStudent = null;
      document.getElementById("removeBatchStudentDialog")?.close();
      await renderRemoveBatchStudents();
      await renderStudents();
      await renderDashboard();
      showMessage("Student removed from the current batch without changing the student account or documents.", "success", { duration: 9000 });
    } catch (error) {
      console.error("Remove batch student failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
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
    const batchButton = findClosestAction(event.target, "[data-view-batch]");
    const batchAlumniButton = findClosestAction(event.target, "[data-view-batch-alumni]");
    const graduateButton = findClosestAction(event.target, "[data-graduate-batch]");
    const convertButton = findClosestAction(event.target, "[data-convert-student]");
    const alumniButton = findClosestAction(event.target, "[data-alumni-id]");
    const removeBatchStudentButton = findClosestAction(event.target, "[data-remove-batch-student]");
    if (graduateButton) {
      await safeRender("Graduation confirmation", () => openGraduationDialog(graduateButton.dataset.graduateBatch));
      return;
    }
    if (convertButton) {
      try { openStudentConversionDialog(convertButton.dataset.convertStudent); }
      catch (error) { showMessage(await friendlyFirebaseError(error), "danger"); }
      return;
    }
    if (removeBatchStudentButton) {
      const student = await matchingStudents().then((students) => students.find((item) => item.id === removeBatchStudentButton.dataset.removeBatchStudent));
      if (!student) {
        showMessage("Student not found in your authorized scope.", "danger");
        return;
      }
      pendingRemoveBatchStudent = student.id;
      text("removeBatchStudentName", student.name || "");
      text("removeBatchStudentRegNo", student.reg_no || "");
      text("removeBatchStudentDepartment", student.department || "");
      text("removeBatchStudentYear", student.year || student.batch || "Not available");
      text("removeBatchStudentBatch", student.batchId ? (student.batch || "Not available") : "Not assigned");
      document.getElementById("removeBatchStudentDialog")?.showModal();
      return;
    }
    if (batchAlumniButton) {
      document.getElementById("alumniBatchFilter").value = batchAlumniButton.dataset.viewBatchAlumni;
      alumniFilters = { batchId: batchAlumniButton.dataset.viewBatchAlumni };
      document.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { view: "alumni" } }));
      return;
    }
    if (batchButton) {
      await safeRender("Batch details load", () => renderBatchDetail(batchButton.dataset.viewBatch));
      return;
    }
    if (alumniButton) {
      await safeRender("Alumni details load", () => renderAlumniDetail(alumniButton.dataset.alumniId));
      return;
    }
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
