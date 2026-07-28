import { protectPage } from "./auth.js";
import {
  deleteStudentDocument,
  firebaseErrorMessage,
  listAcademicTitles,
  listStudentDocuments,
  uploadProfilePhoto,
  uploadStudentDocument
} from "./firebase-service.js";
import {
  DEFAULT_ACADEMIC_TITLES,
  escapeHtml,
  normalizeTitle,
  showMessage,
  validateDocumentFile,
  validatePhotoFile
} from "./validation.js";

let profile = null;
let documentCache = { online: [], personal: [], academic: [] };

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
  if (name === "academic") refreshAcademicTitles();
}

function fillProfile() {
  text("welcomeName", profile.name);
  text("studentName", profile.name);
  text("studentRegNo", profile.reg_no);
  text("studentEmail", profile.email);
  text("studentYear", profile.year);
  text("studentDepartment", profile.department);
  text("studentMobile", profile.mobile);
  const avatar = document.getElementById("studentAvatar");
  if (avatar) avatar.textContent = profile.name?.slice(0, 1) || "S";
  const photo = document.getElementById("studentPhoto");
  if (photo && profile.photo_url) {
    photo.src = profile.photo_url;
    photo.hidden = false;
    if (avatar) avatar.hidden = true;
  }
}

async function loadDocuments(category) {
  documentCache[category] = await listStudentDocuments(profile, category);
  return documentCache[category];
}

function refreshCounts() {
  for (const category of ["online", "personal", "academic"]) {
    text(`${category}Count`, String(documentCache[category]?.length || 0));
  }
}

async function refreshDocuments(category) {
  const body = document.getElementById(`${category}Documents`);
  const empty = document.getElementById(`${category}Empty`);
  if (!body) return;

  const rows = await loadDocuments(category);
  body.innerHTML = rows.map((item) => documentRow(item)).join("");
  if (empty) empty.hidden = rows.length > 0;
  refreshCounts();
  if (category === "academic") await refreshAcademicTitles();
}

function documentRow(item) {
  const url = item.file_url;
  return `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td>${escapeHtml(item.file_name)}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td class="action-cell">
        <a class="small-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${escapeHtml(url)}" download="${escapeHtml(item.file_name)}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category)}">REMOVE</button>
      </td>
    </tr>`;
}

async function getAcademicTitles() {
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...(await listAcademicTitles(profile))
  ].filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index)
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function refreshAcademicTitles() {
  const select = document.getElementById("academicTitleSelect");
  const list = document.getElementById("academicTitleList");
  if (!select && !list) return;

  const uploaded = new Set(documentCache.academic.map((item) => item.title));
  const titles = await getAcademicTitles();

  if (select) {
    select.innerHTML = '<option value="">Choose title</option>';
    titles.filter((item) => !uploaded.has(item.title)).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.title;
      option.textContent = item.title;
      select.appendChild(option);
    });
  }
  if (list) {
    list.innerHTML = titles.map((item) => `<span class="pill">${escapeHtml(item.title)}</span>`).join("");
  }
}

async function uploadDocument(form, category) {
  const file = form.elements.document.files[0];
  const result = validateDocumentFile(file);
  if (!result.ok) throw new Error(result.message);

  const title = normalizeTitle(form.elements.title.value);
  if (!title) throw new Error("Enter or select a document title.");

  await uploadStudentDocument(profile, category, title, file);

  form.reset();
  await refreshDocuments(category);
}

async function uploadPhoto(form) {
  const file = form.elements.photo.files[0];
  const result = validatePhotoFile(file);
  if (!result.ok) throw new Error(result.message);

  profile = await uploadProfilePhoto(profile, file);
  fillProfile();
  form.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("student", async (_currentUser, currentProfile) => {
    profile = currentProfile;
    fillProfile();
    for (const category of ["online", "personal", "academic"]) await refreshDocuments(category);
    await refreshAcademicTitles();
  });

  document.querySelectorAll("[data-open-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showView(link.dataset.openView);
    });
  });

  document.querySelectorAll("[data-upload-category]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await uploadDocument(form, form.dataset.uploadCategory);
        showMessage("Document uploaded successfully.", "success");
      } catch (error) {
        console.error("Student document upload failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      }
    });
  });

  document.getElementById("studentPhotoForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await uploadPhoto(event.currentTarget);
      showMessage("Profile photo updated.", "success");
    } catch (error) {
      console.error("Student profile photo upload failed", error);
      showMessage(firebaseErrorMessage(error), "danger");
    }
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-doc]");
    if (!button || !confirm("Remove this document?")) return;
    try {
      await deleteStudentDocument(profile, button.dataset.deleteDoc);
      await refreshDocuments(button.dataset.category);
      showMessage("Document removed.", "success");
    } catch (error) {
      console.error("Student document delete failed", error);
      showMessage(firebaseErrorMessage(error), "danger");
    }
  });
});
