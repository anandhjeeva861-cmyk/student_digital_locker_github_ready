import { protectPage } from "./auth.js";
import { departmentKey, escapeHtml, parseDepartment, parseYear, showMessage } from "./validation.js";

let admin = null;
let approvals = [];
let teachers = [];
let students = [];
let classes = [];
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
  body.innerHTML = students.map((student) => {
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
    </tr>`;
  }).join("");
  if (empty) empty.hidden = students.length > 0;
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

  document.addEventListener("click", async (event) => {
    const editButton = event.target instanceof Element ? event.target.closest("[data-edit-approval]") : null;
    if (editButton) {
      const approval = approvals.find((item) => item.email === editButton.dataset.editApproval);
      if (approval) setApprovalForm(approval);
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
