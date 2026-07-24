import { getFirebase, protectPage } from "./auth.js";
import {
  DEFAULT_ACADEMIC_TITLES,
  normalizeTitle,
  showMessage,
  validateDocumentFile,
  validatePhotoFile
} from "./validation.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

let user = null;
let profile = null;
let db = null;
let storage = null;

function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
}

function dateText(value) {
  return value?.toDate ? value.toDate().toLocaleString() : "";
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
  text("studentRegNo", profile.regNo);
  text("studentEmail", profile.email);
  text("studentYear", profile.year);
  text("studentDepartment", profile.department);
  text("studentMobile", profile.mobile);
  const avatar = document.getElementById("studentAvatar");
  if (avatar) avatar.textContent = profile.name?.slice(0, 1) || "S";
  const photo = document.getElementById("studentPhoto");
  if (photo && profile.photoURL) {
    photo.src = profile.photoURL;
    photo.hidden = false;
    avatar.hidden = true;
  }
}

function watchCounts() {
  ["online", "personal", "academic"].forEach((category) => {
    onSnapshot(query(collection(db, "documents"), where("ownerUid", "==", user.uid), where("category", "==", category)), (snap) => {
      text(`${category}Count`, String(snap.size));
    });
  });
}

function watchDocuments(category) {
  const body = document.getElementById(`${category}Documents`);
  const empty = document.getElementById(`${category}Empty`);
  if (!body) return;

  onSnapshot(query(collection(db, "documents"), where("ownerUid", "==", user.uid), where("category", "==", category)), (snap) => {
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
    body.innerHTML = rows.map((item) => documentRow(item)).join("");
    if (empty) empty.hidden = rows.length > 0;
    if (category === "academic") refreshAcademicTitles();
  });
}

function documentRow(item) {
  return `
    <tr>
      <td><b>${item.title}</b></td>
      <td>${item.fileName}</td>
      <td>${dateText(item.uploadedAt)}</td>
      <td class="action-cell">
        <a class="small-btn" href="${item.fileURL}" target="_blank" rel="noopener">VIEW</a>
        <a class="small-btn" href="${item.fileURL}" download="${item.fileName}">DOWNLOAD</a>
        <button class="small-btn danger" data-delete-doc="${item.id}" data-path="${item.storagePath}">REMOVE</button>
      </td>
    </tr>`;
}

async function getAcademicTitles() {
  const snap = await getDocs(query(
    collection(db, "academicTitles"),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  ));
  return [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...snap.docs.map((item) => item.data())
  ].sort((a, b) => a.title.localeCompare(b.title));
}

async function refreshAcademicTitles() {
  const select = document.getElementById("academicTitleSelect");
  const list = document.getElementById("academicTitleList");
  if (!select && !list) return;

  const uploadedSnap = await getDocs(query(collection(db, "documents"), where("ownerUid", "==", user.uid), where("category", "==", "academic")));
  const uploaded = new Set(uploadedSnap.docs.map((item) => item.data().title));
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

  const title = category === "academic"
    ? normalizeTitle(form.elements.title.value)
    : normalizeTitle(form.elements.title.value);
  if (!title) throw new Error("Enter or select a document title.");

  const storagePath = `documents/${user.uid}/${category}/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { customMetadata: { ownerUid: user.uid, category } });
  const fileURL = await getDownloadURL(fileRef);
  await addDoc(collection(db, "documents"), {
    ownerUid: user.uid,
    ownerName: profile.name,
    ownerRegNo: profile.regNo,
    department: profile.department,
    departmentKey: profile.departmentKey,
    year: profile.year,
    category,
    title,
    fileName: file.name,
    fileURL,
    storagePath,
    uploadedAt: serverTimestamp()
  });
  form.reset();
}

async function uploadPhoto(form) {
  const file = form.elements.photo.files[0];
  const result = validatePhotoFile(file);
  if (!result.ok) throw new Error(result.message);
  const storagePath = `profilePhotos/${user.uid}/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { customMetadata: { ownerUid: user.uid } });
  const photoURL = await getDownloadURL(fileRef);
  await updateDoc(doc(db, "users", user.uid), { photoURL, photoStoragePath: storagePath });
  profile.photoURL = photoURL;
  fillProfile();
  form.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  protectPage("student", async (currentUser, currentProfile) => {
    const firebase = await getFirebase();
    db = firebase.db;
    storage = firebase.storage;
    user = currentUser;
    profile = currentProfile;
    fillProfile();
    watchCounts();
    ["online", "personal", "academic"].forEach(watchDocuments);
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

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-doc]");
    if (!button || !confirm("Remove this document?")) return;
    await deleteObject(ref(storage, button.dataset.path));
    await deleteDoc(doc(db, "documents", button.dataset.deleteDoc));
    showMessage("Document removed.", "success");
  });
});
