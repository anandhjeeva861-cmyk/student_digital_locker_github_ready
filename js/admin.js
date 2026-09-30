import { protectPage } from "./auth.js";
import { departmentKey, escapeHtml, parseDepartment, parseYear, showMessage } from "./validation.js";

let admin = null;
let approvals = [];
let teachers = [];
let students = [];
let classes = [];
let studentFilters = { q: "", department: "", classId: "" };
let detailDocumentCache = [];
let firebaseServicePromise = null;

function loadFirebaseService() {
  if (!firebaseServicePromise) firebaseServicePromise = import("./firebase-service.js");
  return firebaseServicePromise;
}

async function friendlyFirebaseError(error) {
  try {
    const { firebaseErrorMessage } = await loadFirebaseService();
    return firebaseErrorMessage(error);
  } catch (_loadError) {
    return error?.message || "Admin dashboard request failed.";
  }
}

function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
}

function dateText(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Not available";
}

function parseBatchList(value) {
  return [...new Set(String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .map((item) => parseYear(item)))];
}

function setApprovalForm(approval) {
  const form = document.getElementById("approvalForm");
  if (!form) return;
  form.elements.email.value = approval.email || "";
  form.elements.department.value = approval.department || "";
  form.elements.teachingBatches.value = (approval.teachingBatches || []).join("\n");
  form.elements.enabled.checked = approval.enabled !== false;
  document.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { view: "approvals" } }));
}

async function safeRender(label, task) {
  try {
    await task();
  } catch (error) {
    console.error(`${label} failed`, error);
    showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
  }
}

async function loadAdminData() {
  const service = await loadFirebaseService();
  [approvals, teachers, students, classes] = await Promise.all([
    service.listTeacherApprovals(admin),
    service.listAdminTeacherProfiles(admin),
    service.listAdminStudentProfiles(admin),
    service.listAdminClasses(admin)
  ]);
}

function renderDashboard() {
  text("approvalCount", String(approvals.length));
  text("teacherCount", String(teachers.length));
  text("studentCount", String(students.length));
  text("classCount", String(classes.length));
}

function renderApprovals() {
  const body = document.getElementById("approvalRows");
  const empty = document.getElementById("approvalEmpty");
  if (!body) return;
  body.innerHTML = approvals.map((approval) => `
    <tr>
      <td><b>${escapeHtml(approval.email)}</b></td>
      <td>${escapeHtml(approval.department || approval.departmentKey || "Not available")}</td>
      <td>${escapeHtml((approval.teachingBatches || []).join(", ") || "Not available")}</td>
      <td><span class="status-badge">${approval.enabled ? "Enabled" : "Disabled"}</span></td>
      <td><button type="button" class="small-btn" data-edit-approval="${escapeHtml(approval.email)}">EDIT</button></td>
    </tr>`).join("");
  if (empty) empty.hidden = approvals.length > 0;
}

function renderTeachers() {
  const body = document.getElementById("teacherRows");
  const empty = document.getElementById("teacherEmpty");
  if (!body) return;
  body.innerHTML = teachers.map((teacher) => `
    <tr>
      <td><b>${escapeHtml(teacher.name)}</b></td>
      <td>${escapeHtml(teacher.email)}</td>
      <td>${escapeHtml(teacher.department)}</td>
      <td><textarea rows="2" data-teacher-batches="${escapeHtml(teacher.uid)}">${escapeHtml((teacher.teachingBatches || []).join("\n"))}</textarea></td>
      <td><button type="button" class="small-btn" data-save-teacher-batches="${escapeHtml(teacher.uid)}">SAVE BATCHES</button></td>
    </tr>`).join("");
  if (empty) empty.hidden = teachers.length > 0;
}

function renderStudents() {
  const body = document.getElementById("studentRows");
  const empty = document.getElementById("studentEmpty");
  if (!body) return;
  const classById = new Map(classes.map((item) => [item.id, item]));
  const departmentFilter = document.getElementById("studentDepartmentFilter");
  const classFilter = document.getElementById("studentClassFilter");
  if (departmentFilter) {
    departmentFilter.innerHTML = `<option value="">All departments</option>${[...new Set(students.map((item) => item.department).filter(Boolean))]
      .sort().map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`).join("")}`;
    departmentFilter.value = studentFilters.department;
  }
  if (classFilter) {
    const availableClasses = classes.filter((item) => !studentFilters.department || item.department === studentFilters.department);
    classFilter.innerHTML = `<option value="">All classes</option>${availableClasses
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.department} — ${item.batchLabel}`)}</option>`).join("")}`;
    classFilter.value = studentFilters.classId;
  }
  const search = studentFilters.q.trim().toUpperCase();
  const filteredStudents = students.filter((student) => {
    const searchText = `${student.name || ""} ${student.reg_no || ""} ${student.email || ""}`.toUpperCase();
    return (!search || searchText.includes(search))
      && (!studentFilters.department || student.department === studentFilters.department)
      && (!studentFilters.classId || student.batchId === studentFilters.classId);
  });
  body.innerHTML = filteredStudents.map((student) => {
    const assignedClass = classById.get(student.batchId);
    const classLabel = assignedClass?.batchLabel || student.batch || "Not assigned";
    return `<tr>
      <td><b>${escapeHtml(student.name || "Not available")}</b></td>
      <td>${escapeHtml(student.reg_no || "Not available")}</td>
      <td>${escapeHtml(student.email || "Not available")}</td>
      <td>${escapeHtml(student.mobile || "Not available")}</td>
      <td>${escapeHtml(student.department || "Not available")}</td>
      <td>${escapeHtml(student.year || "Not available")}</td>
      <td>${escapeHtml(classLabel)}</td>
      <td><span class="status-badge">${escapeHtml(student.studentStatus || "active")}</span></td>
      <td><button type="button" class="small-btn" data-student-id="${escapeHtml(student.uid)}">VIEW DATA</button></td>
    </tr>`;
  }).join("");
  if (empty) empty.hidden = filteredStudents.length > 0;
}

async function renderStudentDetail(studentUid) {
  const { getAdminStudentDetail } = await loadFirebaseService();
  const { student, documents } = await getAdminStudentDetail(admin, studentUid);
  text("detailName", student.name || "Student");
  text("detailRegNo", student.reg_no || "Not available");
  text("detailEmail", student.email || "Not available");
  text("detailDepartment", student.department || "Not available");
  text("detailYear", student.year || "Not available");
  text("detailMobile", student.mobile || "Not available");
  detailDocumentCache = documents || [];
  const body = document.getElementById("academicRows");
  if (body) body.innerHTML = detailDocumentCache.map((item) => `
    <tr>
      <td><b>${escapeHtml(item.title || "Untitled")}</b></td>
      <td>${escapeHtml(item.file_name || "Not available")}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td class="action-cell"><button type="button" class="small-btn" data-view-doc="${escapeHtml(item.id)}">VIEW</button><button type="button" class="small-btn" data-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button></td>
    </tr>`).join("");
  text("academicEmpty", detailDocumentCache.length ? "" : "No academic certificates uploaded.");
  const empty = document.getElementById("academicEmpty");
  if (empty) empty.hidden = detailDocumentCache.length > 0;
  document.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { view: "student-detail" } }));
}

async function openStoredDocument(documentId, mode) {
  const item = detailDocumentCache.find((documentItem) => documentItem.id === documentId);
  if (!item) throw new Error("Document not found.");
  const previewWindow = mode === "view" ? window.open("about:blank", "_blank") : null;
  if (mode === "view" && !previewWindow) throw new Error("Document preview was blocked. Allow pop-ups for this site and try again.");
  if (previewWindow) previewWindow.opener = null;
  let url = "";
  try {
    const { getDocumentObjectUrl } = await loadFirebaseService();
    url = await getDocumentObjectUrl(item);
    if (previewWindow) previewWindow.location.replace(url);
    else {
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

function renderClasses() {
  const body = document.getElementById("classRows");
  const empty = document.getElementById("classEmpty");
  if (!body) return;
  const teacherByUid = new Map(teachers.map((item) => [item.uid, item]));
  body.innerHTML = classes.map((classItem) => {
    const teacher = teacherByUid.get(classItem.assignedTeacherUid);
    const totalStudents = students.filter((student) => student.batchId === classItem.id).length;
    return `<tr>
      <td><b>${escapeHtml(classItem.batchLabel || classItem.id)}</b></td>
      <td>${escapeHtml(classItem.department || "Not available")}</td>
      <td>${escapeHtml(classItem.courseName || "Not available")}</td>
      <td>${escapeHtml(teacher?.name || "Not assigned")}</td>
      <td>${totalStudents}</td>
      <td><span class="status-badge">${escapeHtml(classItem.status || "active")}</span></td>
    </tr>`;
  }).join("");
  if (empty) empty.hidden = classes.length > 0;
}

async function refreshAll() {
  await loadAdminData();
  renderDashboard();
  renderApprovals();
  renderTeachers();
  renderStudents();
  renderClasses();
}

async function renderViewData(view) {
  if (!admin) return;
  if (view === "dashboard") renderDashboard();
  if (view === "approvals") renderApprovals();
  if (view === "teachers") renderTeachers();
  if (view === "students") renderStudents();
  if (view === "student-detail") return;
  if (view === "classes") renderClasses();
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("admin", async (_currentUser, currentProfile) => {
    admin = currentProfile;
    text("welcomeName", admin.name || "ADMIN");
    await safeRender("Admin dashboard load", refreshAll);
  });

  document.addEventListener("dashboard:view-change", async (event) => {
    await renderViewData(event.detail?.view);
  });

  document.getElementById("approvalForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const department = parseDepartment(form.elements.department.value);
      await (await loadFirebaseService()).saveTeacherApproval(admin, {
        email: form.elements.email.value,
        department,
        departmentKey: departmentKey(department),
        teachingBatches: parseBatchList(form.elements.teachingBatches.value),
        enabled: form.elements.enabled.checked
      });
      form.reset();
      await refreshAll();
      showMessage("Teacher approval saved.", "success");
    } catch (error) {
      console.error("Teacher approval save failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("studentSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    studentFilters = {
      q: form.elements.q.value || "",
      department: form.elements.department.value || "",
      classId: form.elements.classId.value || ""
    };
    renderStudents();
  });

  document.addEventListener("click", async (event) => {
    const editButton = event.target instanceof Element ? event.target.closest("[data-edit-approval]") : null;
    if (editButton) {
      const approval = approvals.find((item) => item.email === editButton.dataset.editApproval);
      if (approval) setApprovalForm(approval);
      return;
    }

    const studentButton = event.target instanceof Element ? event.target.closest("[data-student-id]") : null;
    if (studentButton) {
      await safeRender("Student details load", () => renderStudentDetail(studentButton.dataset.studentId));
      return;
    }

    const documentButton = event.target instanceof Element ? event.target.closest("[data-view-doc], [data-download-doc]") : null;
    if (documentButton) {
      await safeRender("Academic document open", () => openStoredDocument(documentButton.dataset.viewDoc || documentButton.dataset.downloadDoc, documentButton.hasAttribute("data-view-doc") ? "view" : "download"));
      return;
    }

    const saveButton = event.target instanceof Element ? event.target.closest("[data-save-teacher-batches]") : null;
    if (!saveButton) return;
    const uid = saveButton.dataset.saveTeacherBatches;
    const input = document.querySelector(`[data-teacher-batches="${CSS.escape(uid)}"]`);
    saveButton.disabled = true;
    try {
      await (await loadFirebaseService()).updateTeacherTeachingBatches(admin, uid, parseBatchList(input?.value || ""));
      await refreshAll();
      showMessage("Teacher batches updated.", "success");
    } catch (error) {
      console.error("Teacher batch update failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      saveButton.disabled = false;
    }
  });
});
