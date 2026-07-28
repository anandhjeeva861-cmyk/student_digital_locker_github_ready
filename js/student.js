import { protectPage } from "./auth.js";
import { documents, fileToDataUrl, saveDocuments, saveProfiles, profiles, uid } from "./local-db.js";
import {
  DEFAULT_ACADEMIC_TITLES,
  normalizeTitle,
  showMessage,
  validateDocumentFile,
  validatePhotoFile
} from "./validation.js";

let user = null;
let profile = null;

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

function loadDocuments(category) {
  return documents()
    .filter((item) => item.owner_id === user.id && item.category === category)
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
}

function refreshCounts() {
  for (const category of ["online", "personal", "academic"]) {
    text(`${category}Count`, String(loadDocuments(category).length));
  }
}

function refreshDocuments(category) {
  const body = document.getElementById(`${category}Documents`);
  const empty = document.getElementById(`${category}Empty`);
  if (!body) return;

  const rows = loadDocuments(category);
  body.innerHTML = rows.map((item) => documentRow(item)).join("");
  if (empty) empty.hidden = rows.length > 0;
  if (category === "academic") refreshAcademicTitles();
}

function documentRow(item) {
  return `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.file_name}</td>
      <td>${dateText(item.uploaded_at)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${item.file_url}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${item.file_url}" download="${item.file_name}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}">REMOVE</button>
      </td>
    </tr>`;
}

function getAcademicTitles() {
  const custom = JSON.parse(localStorage.getItem("sdl_academic_titles") || "[]")
    .filter((item) => item.department_key === profile.department_key && item.year === profile.year);
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...custom
  ].sort((a, b) => a.title.localeCompare(b.title));
}

function refreshAcademicTitles() {
  const select = document.getElementById("academicTitleSelect");
  const list = document.getElementById("academicTitleList");
  if (!select && !list) return;

  const uploaded = new Set(loadDocuments("academic").map((item) => item.title));
  const titles = getAcademicTitles();

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
    list.innerHTML = titles.map((item) => `<span class="pill">${item.title}</span>`).join("");
  }
}

async function uploadDocument(form, category) {
  const file = form.elements.document.files[0];
  const result = validateDocumentFile(file);
  if (!result.ok) throw new Error(result.message);

  const title = normalizeTitle(form.elements.title.value);
  if (!title) throw new Error("Enter or select a document title.");
  if (category === "academic" && loadDocuments("academic").some((item) => item.title === title)) {
    throw new Error("This academic certificate is already uploaded.");
  }

  const fileUrl = await fileToDataUrl(file);
  const row = {
    id: uid(),
    owner_id: user.id,
    owner_name: profile.name,
    owner_reg_no: profile.reg_no,
    department: profile.department,
    department_key: profile.department_key,
    year: profile.year,
    category,
    title,
    file_name: file.name,
    file_url: fileUrl,
    uploaded_at: new Date().toISOString()
  };

  saveDocuments([...documents(), row]);
  form.reset();
  refreshCounts();
  refreshDocuments(category);
}

async function uploadPhoto(form) {
  const file = form.elements.photo.files[0];
  const result = validatePhotoFile(file);
  if (!result.ok) throw new Error(result.message);

  profile.photo_url = await fileToDataUrl(file);
  profile.updated_at = new Date().toISOString();
  saveProfiles(profiles().map((item) => (item.id === profile.id ? { ...item, photo_url: profile.photo_url } : item)));
  fillProfile();
  form.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("student", async (currentUser, currentProfile) => {
    user = currentUser;
    profile = currentProfile;
    fillProfile();
    refreshCounts();
    for (const category of ["online", "personal", "academic"]) refreshDocuments(category);
    refreshAcademicTitles();
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
        showMessage(error.message, "danger");
      }
    });
  });

  document.getElementById("studentPhotoForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await uploadPhoto(event.currentTarget);
      showMessage("Profile photo updated.", "success");
    } catch (error) {
      showMessage(error.message, "danger");
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-doc]");
    if (!button || !confirm("Remove this document?")) return;
    const rows = documents();
    const removed = rows.find((item) => item.id === button.dataset.deleteDoc);
    saveDocuments(rows.filter((item) => item.id !== button.dataset.deleteDoc));
    refreshCounts();
    refreshDocuments(removed?.category || "academic");
    showMessage("Document removed.", "success");
  });
});
