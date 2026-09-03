import { protectPage } from "./auth.js";
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
let firebaseServicePromise = null;
let profilePhotoLoadAttempted = false;
let profilePhotoObjectUrl = "";
let profilePhotoRequestId = 0;

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

function onViewChange(name) {
  if (!profile) return;
  if (name === "academic") {
    refreshAcademicTitles().catch(async (error) => {
      console.error("Academic titles failed", error);
      showMessage(await friendlyFirebaseError(error), "danger");
    });
  }
  if (name === "profile") loadProfilePhotoForProfileView();
}

function fillProfile() {
  text("welcomeName", profile.name);
  text("studentName", profile.name);
  text("studentRegNo", profile.reg_no);
  text("studentEmail", profile.email);
  text("studentYear", profile.year);
  text("studentBatch", profile.batchId ? (profile.batch || profile.year) : "Not assigned");
  text("studentGraduationYear", profile.graduationYear || "Not available");
  text("studentDepartment", profile.department);
  text("studentMobile", profile.mobile);
  const avatar = document.getElementById("studentAvatar");
  if (avatar) {
    avatar.textContent = profile.name?.slice(0, 1) || "S";
    avatar.setAttribute("aria-label", `${profile.name || "Student"} profile placeholder`);
  }
}

function showProfilePhotoFallback() {
  const photo = document.getElementById("studentPhoto");
  const avatar = document.getElementById("studentAvatar");
  if (photo) {
    photo.removeAttribute("src");
    photo.hidden = true;
  }
  if (avatar) avatar.hidden = false;
  releaseProfilePhotoObjectUrl();
}

function releaseProfilePhotoObjectUrl() {
  if (profilePhotoObjectUrl) URL.revokeObjectURL(profilePhotoObjectUrl);
  profilePhotoObjectUrl = "";
}

async function refreshProfilePhoto({ force = false } = {}) {
  const photo = document.getElementById("studentPhoto");
  const avatar = document.getElementById("studentAvatar");
  if (!photo) return;
  if (profilePhotoLoadAttempted && !force) return;
  const requestId = ++profilePhotoRequestId;
  profilePhotoLoadAttempted = true;
  let url = "";
  try {
    const { getProfilePhotoUrl } = await loadFirebaseService();
    url = await getProfilePhotoUrl(profile);
  } catch (error) {
    if (requestId !== profilePhotoRequestId) return;
    throw error;
  }
  if (requestId !== profilePhotoRequestId) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    return;
  }
  if (!url) {
    showProfilePhotoFallback();
    return;
  }

  showProfilePhotoFallback();
  await new Promise((resolve, reject) => {
    const loader = new Image();
    loader.addEventListener("load", resolve, { once: true });
    loader.addEventListener("error", () => reject(new Error("The saved profile image could not be displayed.")), {
      once: true
    });
    loader.src = url;
  }).catch((error) => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    if (requestId !== profilePhotoRequestId) return;
    throw error;
  });

  if (requestId !== profilePhotoRequestId) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    return;
  }
  releaseProfilePhotoObjectUrl();
  if (url.startsWith("blob:")) profilePhotoObjectUrl = url;
  photo.src = url;
  photo.hidden = false;
  if (avatar) avatar.hidden = true;
}

async function loadProfilePhotoForProfileView() {
  try {
    await refreshProfilePhoto();
  } catch (error) {
    console.warn("Stored profile photo could not be loaded", error);
    showProfilePhotoFallback();
    showMessage("Your saved profile photo is unavailable. Upload a new photo to replace it.", "warning", {
      duration: 7000
    });
  }
}

async function loadDocuments(category) {
  const { listStudentDocuments } = await loadFirebaseService();
  documentCache[category] = await listStudentDocuments(profile, category);
  return documentCache[category];
}

async function loadAllDocuments() {
  const { listStudentDocuments } = await loadFirebaseService();
  const documents = await listStudentDocuments(profile);
  documentCache = { online: [], personal: [], academic: [] };
  for (const item of documents) {
    if (documentCache[item.category]) documentCache[item.category].push(item);
  }
}

function refreshCounts() {
  for (const category of ["online", "personal", "academic"]) {
    text(`${category}Count`, String(documentCache[category]?.length || 0));
  }
  renderRecentDocuments();
}

function renderRecentDocuments() {
  const body = document.getElementById("recentDocuments");
  const empty = document.getElementById("recentDocumentsEmpty");
  if (!body) return;
  const rows = Object.values(documentCache)
    .flat()
    .sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)))
    .slice(0, 5);
  body.innerHTML = rows.map((item) => `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td>${escapeHtml(String(item.category || "document").toUpperCase())}</td>
      <td>${escapeHtml(item.file_name)}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td><button type="button" class="small-btn" data-view-doc="${escapeHtml(item.id)}">VIEW</button></td>
    </tr>`).join("");
  if (empty) empty.hidden = rows.length > 0;
}

function renderCachedDocuments(category) {
  const body = document.getElementById(`${category}Documents`);
  const empty = document.getElementById(`${category}Empty`);
  if (!body) return;
  const rows = documentCache[category] || [];
  body.innerHTML = rows.map((item) => documentRow(item)).join("");
  if (empty) empty.hidden = rows.length > 0;
}

async function refreshDocuments(category) {
  await loadDocuments(category);
  renderCachedDocuments(category);
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
        <button type="button" class="small-btn" data-view-doc="${escapeHtml(item.id)}">VIEW</button>
        <button type="button" class="small-btn" data-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button>
        <button type="button" class="small-btn danger" data-delete-doc="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category)}">REMOVE</button>
      </td>
    </tr>`;
}

async function getAcademicTitles() {
  const { listAcademicTitles } = await loadFirebaseService();
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

  const { uploadStudentDocument } = await loadFirebaseService();
  await uploadStudentDocument(profile, category, title, file);

  form.reset();
  await refreshDocuments(category);
}

async function uploadPhoto(form) {
  const file = form.elements.photo.files[0];
  const result = validatePhotoFile(file);
  if (!result.ok) throw new Error(result.message);

  const { uploadProfilePhoto } = await loadFirebaseService();
  profile = await uploadProfilePhoto(profile, file);
  profilePhotoLoadAttempted = false;
  fillProfile();
  await refreshProfilePhoto({ force: true });
  form.reset();
}

function findDocument(documentId) {
  return Object.values(documentCache).flat().find((item) => item.id === documentId);
}

async function safeRefresh(label, task) {
  try {
    await task();
  } catch (error) {
    console.error(`${label} failed`, error);
    showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
  }
}

async function openStoredDocument(documentId, mode) {
  const item = findDocument(documentId);
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

document.addEventListener("DOMContentLoaded", () => {
  protectPage("student", async (_currentUser, currentProfile) => {
    profile = currentProfile;
    fillProfile();
    await safeRefresh("Student documents load", loadAllDocuments);
    for (const category of ["online", "personal", "academic"]) renderCachedDocuments(category);
    refreshCounts();
    await safeRefresh("Academic titles load", refreshAcademicTitles);
    const visibleView = document.querySelector("[data-view]:not([hidden])")?.dataset.view;
    if (visibleView === "profile") loadProfilePhotoForProfileView();
  });

  document.addEventListener("dashboard:view-change", (event) => {
    onViewChange(event.detail?.view);
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
        showMessage(await friendlyFirebaseError(error), "danger");
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
      showMessage(await friendlyFirebaseError(error), "danger");
    } finally {
      button?.removeAttribute("disabled");
    }
  });

  document.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
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
        showMessage(await friendlyFirebaseError(error), "danger");
      }
      return;
    }

    const button = event.target.closest("[data-delete-doc]");
    if (!button || !confirm("Remove this document?")) return;
    try {
      const { deleteStudentDocument } = await loadFirebaseService();
      await deleteStudentDocument(profile, button.dataset.deleteDoc);
      await refreshDocuments(button.dataset.category);
      showMessage("Document removed.", "success");
    } catch (error) {
      console.error("Student document delete failed", error);
      showMessage(await friendlyFirebaseError(error), "danger");
    }
  });
});

window.addEventListener("pagehide", releaseProfilePhotoObjectUrl);
