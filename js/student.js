import { protectPage } from "./auth.js";
import {
  deleteStudentDocument,
  firebaseErrorMessage,
  getDocumentObjectUrl,
  listAcademicTitles,
  getProfilePhotoUrl,
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

async function refreshProfilePhoto() {
  const photo = document.getElementById("studentPhoto");
  const avatar = document.getElementById("studentAvatar");
  if (!photo) return;
  const url = await getProfilePhotoUrl(profile);
  if (!url) return;
  photo.src = url;
  photo.hidden = false;
  if (avatar) avatar.hidden = true;
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
  return `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td>${escapeHtml(item.file_name)}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td class="action-cell">
        <button class="small-btn" data-view-doc="${escapeHtml(item.id)}">VIEW</button>
        <button class="small-btn" data-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button>
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
  await refreshProfilePhoto();
  form.reset();
}

function findDocument(documentId) {
  return Object.values(documentCache).flat().find((item) => item.id === documentId);
}

async function openStoredDocument(documentId, mode) {
  const item = findDocument(documentId);
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

document.addEventListener("DOMContentLoaded", () => {
  protectPage("student", async (_currentUser, currentProfile) => {
    profile = currentProfile;
    fillProfile();
    await refreshProfilePhoto();
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
      const button = form.querySelector("button[type='submit']");
      button?.setAttribute("disabled", "disabled");
      try {
        await uploadDocument(form, form.dataset.uploadCategory);
        showMessage("Document uploaded successfully.", "success");
      } catch (error) {
        console.error("Student document upload failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  });

  document.getElementById("studentPhotoForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    button?.setAttribute("disabled", "disabled");
    try {
      await uploadPhoto(event.currentTarget);
      showMessage("Profile photo updated.", "success");
    } catch (error) {
      console.error("Student profile photo upload failed", error);
      showMessage(firebaseErrorMessage(error), "danger");
    } finally {
      button?.removeAttribute("disabled");
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
        console.error("Student document open failed", error);
        showMessage(firebaseErrorMessage(error), "danger");
      }
      return;
    }

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
