import { supabase } from "./supabase-config.js";
import { protectPage } from "./auth.js";
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

async function signedUrl(path) {
  const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function withSignedUrls(rows) {
  return Promise.all(rows.map(async (item) => ({ ...item, signedUrl: await signedUrl(item.file_path) })));
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
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .eq("department_key", teacher.department_key)
    .eq("year", teacher.year)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function academicDocs(studentUid = null) {
  let query = supabase
    .from("documents")
    .select("*")
    .eq("category", "academic")
    .eq("department_key", teacher.department_key)
    .eq("year", teacher.year)
    .order("title", { ascending: true });
  if (studentUid) query = query.eq("owner_id", studentUid);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  const students = (await matchingStudents()).filter((item) => !needle || item.name.includes(needle) || item.reg_no.includes(needle));
  body.innerHTML = "";
  for (const student of students) {
    const docs = await academicDocs(student.id);
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

async function renderStudentDetail(studentUid) {
  selectedStudentUid = studentUid;
  const student = (await matchingStudents()).find((item) => item.id === studentUid);
  if (!student) return showMessage("Access denied for this student.", "danger");
  text("detailName", student.name);
  text("detailRegNo", student.reg_no);
  text("detailEmail", student.email);
  text("detailDepartment", student.department);
  text("detailYear", student.year);
  text("detailMobile", student.mobile);
  const body = document.getElementById("academicRows");
  const docs = await withSignedUrls(await academicDocs(studentUid));
  body.innerHTML = docs.map((item) => `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.file_name}</td>
      <td>${dateText(item.uploaded_at)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${item.signedUrl}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${item.signedUrl}" download="${item.file_name}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}" data-path="${item.file_path}">REMOVE</button>
      </td>
    </tr>`).join("");
  showView("student-detail");
}

async function academicTitles() {
  const { data, error } = await supabase
    .from("academic_titles")
    .select("title")
    .eq("department_key", teacher.department_key)
    .eq("year", teacher.year)
    .order("title", { ascending: true });
  if (error) throw error;
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...(data || [])
  ].sort((a, b) => a.title.localeCompare(b.title));
}

async function renderTitles() {
  const wrap = document.getElementById("customTitles");
  if (!wrap) return;
  const { data, error } = await supabase
    .from("academic_titles")
    .select("title")
    .eq("department_key", teacher.department_key)
    .eq("year", teacher.year)
    .order("title", { ascending: true });
  if (error) throw error;
  wrap.innerHTML = !data?.length
    ? '<div class="empty-state">No custom titles added yet.</div>'
    : data.map((item) => `<span class="pill">${item.title}</span>`).join("");
}

async function renderStatus() {
  const grid = document.getElementById("statusGrid");
  if (!grid) return;
  const students = await matchingStudents();
  const titles = await academicTitles();
  grid.innerHTML = "";
  for (const title of titles) {
    const { data, error } = await supabase
      .from("documents")
      .select("owner_id")
      .eq("category", "academic")
      .eq("department_key", teacher.department_key)
      .eq("year", teacher.year)
      .eq("title", title.title);
    if (error) throw error;
    const uploadedIds = new Set((data || []).map((item) => item.owner_id));
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
    const { data, error } = await supabase
      .from("academic_titles")
      .select("id")
      .eq("department_key", teacher.department_key)
      .eq("year", teacher.year)
      .eq("title", title)
      .maybeSingle();
    if (error) return showMessage(error.message, "danger");
    if (data || DEFAULT_ACADEMIC_TITLES.includes(title)) {
      showMessage("This academic title already exists.", "warning");
      return;
    }

    const { error: insertError } = await supabase.from("academic_titles").insert({
      title,
      department: teacher.department,
      department_key: teacher.department_key,
      year: teacher.year,
      created_by_teacher_id: user.id
    });
    if (insertError) return showMessage(insertError.message, "danger");

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
      try {
        const { error: storageError } = await supabase.storage.from("certificates").remove([deleteButton.dataset.path]);
        if (storageError) throw storageError;
        const { error: deleteError } = await supabase.from("documents").delete().eq("id", deleteButton.dataset.deleteDoc);
        if (deleteError) throw deleteError;
        if (selectedStudentUid) await renderStudentDetail(selectedStudentUid);
        await renderDashboard();
        showMessage("Academic document removed.", "success");
      } catch (error) {
        showMessage(error.message, "danger");
      }
    }
  });
});
