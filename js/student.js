import { supabase } from "./supabase-config.js";
import { protectPage } from "./auth.js";
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

async function signedUrl(path) {
  const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function signedRows(rows) {
  return Promise.all(rows.map(async (item) => ({ ...item, signedUrl: await signedUrl(item.file_path) })));
}

async function fillProfile() {
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
    photo.src = profile.photo_url.startsWith("http") ? profile.photo_url : await signedUrl(profile.photo_url);
    photo.hidden = false;
    if (avatar) avatar.hidden = true;
  }
}

async function loadDocuments(category) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_id", user.id)
    .eq("category", category)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function refreshCounts() {
  for (const category of ["online", "personal", "academic"]) {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("category", category);
    if (error) throw error;
    text(`${category}Count`, String(count || 0));
  }
}

async function refreshDocuments(category) {
  const body = document.getElementById(`${category}Documents`);
  const empty = document.getElementById(`${category}Empty`);
  if (!body) return;

  const rows = await signedRows(await loadDocuments(category));
  body.innerHTML = rows.map((item) => documentRow(item)).join("");
  if (empty) empty.hidden = rows.length > 0;
  if (category === "academic") await refreshAcademicTitles();
}

function documentRow(item) {
  return `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.file_name}</td>
      <td>${dateText(item.uploaded_at)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${item.signedUrl}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${item.signedUrl}" download="${item.file_name}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}" data-path="${item.file_path}">REMOVE</button>
      </td>
    </tr>`;
}

async function getAcademicTitles() {
  const { data, error } = await supabase
    .from("academic_titles")
    .select("title")
    .eq("department_key", profile.department_key)
    .eq("year", profile.year)
    .order("title", { ascending: true });
  if (error) throw error;
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...(data || [])
  ].sort((a, b) => a.title.localeCompare(b.title));
}

async function refreshAcademicTitles() {
  const select = document.getElementById("academicTitleSelect");
  const list = document.getElementById("academicTitleList");
  if (!select && !list) return;

  const uploaded = new Set((await loadDocuments("academic")).map((item) => item.title));
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
    list.innerHTML = titles.map((item) => `<span class="pill">${item.title}</span>`).join("");
  }
}

async function uploadDocument(form, category) {
  const file = form.elements.document.files[0];
  const result = validateDocumentFile(file);
  if (!result.ok) throw new Error(result.message);

  const title = normalizeTitle(form.elements.title.value);
  if (!title) throw new Error("Enter or select a document title.");

  if (category === "academic") {
    const { data, error } = await supabase
      .from("documents")
      .select("id")
      .eq("owner_id", user.id)
      .eq("category", "academic")
      .eq("title", title)
      .maybeSingle();
    if (error) throw error;
    if (data) throw new Error("This academic certificate is already uploaded.");
  }

  const filePath = `documents/${user.id}/${category}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("certificates").upload(filePath, file);
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("documents").insert({
    owner_id: user.id,
    owner_name: profile.name,
    owner_reg_no: profile.reg_no,
    department: profile.department,
    department_key: profile.department_key,
    year: profile.year,
    category,
    title,
    file_name: file.name,
    file_path: filePath,
    file_url: ""
  });
  if (insertError) throw insertError;

  form.reset();
  await refreshCounts();
  await refreshDocuments(category);
}

async function uploadPhoto(form) {
  const file = form.elements.photo.files[0];
  const result = validatePhotoFile(file);
  if (!result.ok) throw new Error(result.message);

  const filePath = `profilePhotos/${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("certificates").upload(filePath, file);
  if (uploadError) throw uploadError;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ photo_url: filePath, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (updateError) throw updateError;

  profile.photo_url = filePath;
  await fillProfile();
  form.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("student", async (currentUser, currentProfile) => {
    user = currentUser;
    profile = currentProfile;
    await fillProfile();
    await refreshCounts();
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

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-doc]");
    if (!button || !confirm("Remove this document?")) return;
    try {
      const { error: storageError } = await supabase.storage.from("certificates").remove([button.dataset.path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", button.dataset.deleteDoc);
      if (deleteError) throw deleteError;
      await refreshCounts();
      await refreshDocuments(button.dataset.path.split("/")[2]);
      showMessage("Document removed.", "success");
    } catch (error) {
      showMessage(error.message, "danger");
    }
  });
});
