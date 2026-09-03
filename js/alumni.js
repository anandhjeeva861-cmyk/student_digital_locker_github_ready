import { protectPage } from "./auth.js";
import { escapeHtml, normalizeTitle, showMessage, validateDocumentFile } from "./validation.js";

let profile = null;
let documents = [];
let achievements = [];
let firebaseServicePromise = null;

function loadFirebaseService() {
  if (!firebaseServicePromise) firebaseServicePromise = import("./firebase-service.js");
  return firebaseServicePromise;
}

async function friendlyFirebaseError(error) {
  try {
    return (await loadFirebaseService()).firebaseErrorMessage(error);
  } catch (_loadError) {
    return error?.message || "The Alumni portal could not complete this request.";
  }
}

function text(id, value, fallback = "Not available") {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value || fallback);
}

function dateText(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Not available";
}

function statusLabel(value) {
  const labels = {
    not_updated: "Not updated",
    employed: "Employed",
    higher_studies: "Higher Studies",
    entrepreneur: "Entrepreneur",
    seeking_opportunity: "Seeking Opportunity",
    other: "Other"
  };
  return labels[value] || "Not updated";
}

function fillProfile() {
  const batch = profile.batch || profile.year || "Not available";
  text("welcomeName", profile.name, "ALUMNI");
  text("dashboardRegNo", profile.regNo);
  text("dashboardDepartment", profile.department);
  text("dashboardBatch", batch);
  text("dashboardGraduationYear", profile.graduationYear);
  text("dashboardCareerStatus", statusLabel(profile.careerStatus));
  text("alumniName", profile.name);
  text("alumniRegNo", profile.regNo);
  text("alumniDepartment", profile.department);
  text("alumniBatch", batch);
  text("alumniGraduationYear", profile.graduationYear);
  text("alumniEmail", profile.email);
  text("alumniMobile", profile.mobile);
  const contactForm = document.getElementById("alumniProfileForm");
  if (contactForm) {
    contactForm.elements.personalEmail.value = profile.personalEmail || "";
    contactForm.elements.linkedin.value = profile.linkedin || "";
  }
  fillCareerForm();
}

function fillCareerForm() {
  const form = document.getElementById("careerForm");
  if (!form || !profile) return;
  const status = profile.careerStatus || "not_updated";
  const values = profile.careerProfile || {};
  form.elements.careerStatus.value = status;
  const fieldValues = {
    company: values.company,
    jobTitle: values.jobTitle,
    employmentLocation: status === "employed" ? values.location : "",
    joiningYear: status === "employed" ? values.joiningYear : "",
    institution: values.institution,
    course: values.course,
    studyLocation: status === "higher_studies" ? values.location : "",
    studyJoiningYear: status === "higher_studies" ? values.joiningYear : "",
    businessName: values.businessName,
    businessRole: values.role,
    businessLocation: status === "entrepreneur" ? values.location : "",
    startedYear: values.startedYear,
    areaOfInterest: values.areaOfInterest,
    description: values.description
  };
  Object.entries(fieldValues).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value || "";
  });
  showCareerFields(status);
}

function showCareerFields(status) {
  document.querySelectorAll("[data-career-fields]").forEach((section) => {
    section.hidden = section.dataset.careerFields !== status;
  });
}

async function refreshDocuments() {
  documents = await (await loadFirebaseService()).listStudentDocuments(profile);
  text("dashboardDocumentCount", documents.length, "0");
  text("alumniDocumentCount", `${documents.length} document${documents.length === 1 ? "" : "s"}`, "0 documents");
  const body = document.getElementById("alumniDocumentRows");
  const empty = document.getElementById("alumniDocumentEmpty");
  if (!body) return;
  body.innerHTML = documents.map((item) => `
    <tr>
      <td><b>${escapeHtml(item.title)}</b></td>
      <td>${escapeHtml(String(item.category || "").toUpperCase())}</td>
      <td>${escapeHtml(item.file_name || "")}</td>
      <td>${escapeHtml(dateText(item.uploaded_at))}</td>
      <td class="action-cell"><button type="button" class="small-btn" data-alumni-view-doc="${escapeHtml(item.id)}">VIEW</button><button type="button" class="small-btn" data-alumni-download-doc="${escapeHtml(item.id)}">DOWNLOAD</button><button type="button" class="small-btn danger" data-alumni-delete-doc="${escapeHtml(item.id)}">REMOVE</button></td>
    </tr>`).join("");
  if (empty) empty.hidden = documents.length > 0;
}

async function openStoredDocument(documentId, mode) {
  const item = documents.find((documentItem) => documentItem.id === documentId);
  if (!item) throw new Error("Document not found.");
  const previewWindow = mode === "view" ? window.open("about:blank", "_blank") : null;
  if (mode === "view" && !previewWindow) throw new Error("Document preview was blocked. Allow pop-ups and try again.");
  if (previewWindow) previewWindow.opener = null;
  let url = "";
  try {
    url = await (await loadFirebaseService()).getDocumentObjectUrl(item);
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

async function refreshAchievements() {
  achievements = await (await loadFirebaseService()).listAlumniAchievements(profile);
  const list = document.getElementById("achievementList");
  const empty = document.getElementById("achievementEmpty");
  if (!list) return;
  list.innerHTML = achievements.map((item) => `
    <article class="record-card"><h3>${escapeHtml(item.title)}</h3><p><span class="status-badge">${escapeHtml(item.type)}</span></p><p class="muted">${escapeHtml(item.description || "No description")}</p><div class="batch-actions"><b>${escapeHtml(item.year)}</b><button type="button" class="small-btn danger" data-delete-achievement="${escapeHtml(item.id)}">REMOVE</button></div></article>`).join("");
  if (empty) empty.hidden = achievements.length > 0;
}

async function runAction(label, action) {
  try {
    await action();
  } catch (error) {
    console.error(`${label} failed`, error);
    showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("alumni", async (_currentUser, currentProfile) => {
    profile = currentProfile;
    fillProfile();
    await runAction("Alumni documents load", refreshDocuments);
    if (document.querySelector("[data-view]:not([hidden])")?.dataset.view === "achievements") {
      await runAction("Achievements load", refreshAchievements);
    }
  });

  document.addEventListener("dashboard:view-change", (event) => {
    if (event.detail?.view === "achievements" && profile) runAction("Achievements load", refreshAchievements);
  });

  document.getElementById("careerStatus")?.addEventListener("change", (event) => showCareerFields(event.target.value));

  document.getElementById("alumniDocumentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const file = form.elements.document.files[0];
      const validation = validateDocumentFile(file);
      if (!validation.ok) throw new Error(validation.message);
      const title = normalizeTitle(form.elements.title.value);
      if (!title) throw new Error("Enter a document title.");
      await (await loadFirebaseService()).uploadStudentDocument(profile, form.elements.category.value, title, file);
      form.reset();
      await refreshDocuments();
      showMessage("Document uploaded successfully.", "success");
    } catch (error) {
      console.error("Alumni document upload failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("careerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const status = form.elements.careerStatus.value;
      const values = status === "employed" ? { company: form.elements.company.value, jobTitle: form.elements.jobTitle.value, location: form.elements.employmentLocation.value, joiningYear: form.elements.joiningYear.value }
        : status === "higher_studies" ? { institution: form.elements.institution.value, course: form.elements.course.value, location: form.elements.studyLocation.value, joiningYear: form.elements.studyJoiningYear.value }
          : status === "entrepreneur" ? { businessName: form.elements.businessName.value, role: form.elements.businessRole.value, location: form.elements.businessLocation.value, startedYear: form.elements.startedYear.value }
            : status === "seeking_opportunity" ? { areaOfInterest: form.elements.areaOfInterest.value }
              : { description: form.elements.description.value };
      profile = await (await loadFirebaseService()).updateAlumniCareerProfile(profile, status, values);
      fillProfile();
      showMessage("Career profile updated.", "success");
    } catch (error) {
      console.error("Career profile update failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("alumniProfileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      profile = await (await loadFirebaseService()).updateAlumniContactProfile(profile, {
        personalEmail: form.elements.personalEmail.value,
        linkedin: form.elements.linkedin.value
      });
      fillProfile();
      showMessage("Contact links updated. Your login email was not changed.", "success");
    } catch (error) {
      console.error("Alumni profile update failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("achievementForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      await (await loadFirebaseService()).addAlumniAchievement(profile, Object.fromEntries(new FormData(form)));
      form.reset();
      await refreshAchievements();
      showMessage("Achievement added.", "success");
    } catch (error) {
      console.error("Achievement add failed", error);
      showMessage(await friendlyFirebaseError(error), "danger", { duration: 9000 });
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const view = event.target.closest("[data-alumni-view-doc]");
    const download = event.target.closest("[data-alumni-download-doc]");
    if (view || download) {
      await runAction("Alumni document open", () => openStoredDocument(view?.dataset.alumniViewDoc || download.dataset.alumniDownloadDoc, view ? "view" : "download"));
      return;
    }
    const removeDocument = event.target.closest("[data-alumni-delete-doc]");
    if (removeDocument && confirm("Remove this document?")) {
      await runAction("Alumni document remove", async () => {
        await (await loadFirebaseService()).deleteStudentDocument(profile, removeDocument.dataset.alumniDeleteDoc);
        await refreshDocuments();
        showMessage("Document removed.", "success");
      });
      return;
    }
    const removeAchievement = event.target.closest("[data-delete-achievement]");
    if (removeAchievement && confirm("Remove this achievement?")) {
      await runAction("Achievement remove", async () => {
        await (await loadFirebaseService()).deleteAlumniAchievement(profile, removeAchievement.dataset.deleteAchievement);
        await refreshAchievements();
        showMessage("Achievement removed.", "success");
      });
    }
  });
});
