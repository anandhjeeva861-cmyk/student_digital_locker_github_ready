import { auth, db, storage } from "./firebase-config.js";
import { protectPage } from "./auth.js";
import {
    DEFAULT_ACADEMIC_TITLES,
    normalizeTitle,
    showMessage,
    validateDocumentFile,
    validatePhotoFile,
} from "./validation.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

protectPage("student");

let currentUser = null;
let currentProfile = null;

function currentCategory() {
    return document.body.dataset.category || document.querySelector("[data-certificate-category]")?.dataset.certificateCategory;
}

function formatDate(value) {
    const date = value?.toDate ? value.toDate() : null;
    return date ? date.toLocaleString() : "";
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "";
}

async function loadProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists() || snap.data().role !== "student") throw new Error("Student profile not found.");
    currentProfile = snap.data();
    setText("studentWelcomeName", currentProfile.name);
    setText("studentName", currentProfile.name);
    setText("studentRegNo", currentProfile.regNo);
    setText("studentEmail", currentProfile.email);
    setText("studentYear", currentProfile.year);
    setText("studentDepartment", currentProfile.department);
    setText("studentMobile", currentProfile.mobile);
    const photo = document.getElementById("studentPhoto");
    const placeholder = document.getElementById("studentPhotoPlaceholder");
    if (photo && currentProfile.photoURL) {
        photo.src = currentProfile.photoURL;
        photo.hidden = false;
        if (placeholder) placeholder.hidden = true;
    } else if (placeholder) {
        placeholder.textContent = currentProfile.name?.slice(0, 1) || "S";
    }
}

function watchCounts(uid) {
    ["online", "personal", "academic"].forEach((category) => {
        const q = query(collection(db, "documents"), where("ownerUid", "==", uid), where("category", "==", category));
        onSnapshot(q, (snap) => setText(`${category}Count`, String(snap.size)));
    });
}

async function academicTitles() {
    const custom = query(
        collection(db, "academicTitles"),
        where("departmentKey", "==", currentProfile.departmentKey),
        where("year", "==", currentProfile.year)
    );
    const snap = await getDocs(custom);
    return [
        ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ id: `default:${title}`, title, isDefault: true })),
        ...snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    ].sort((a, b) => a.title.localeCompare(b.title));
}

async function refreshAcademicSelect() {
    const select = document.getElementById("academicTitleSelect");
    const list = document.getElementById("academicTitleList");
    if (!select && !list) return;

    const titles = await academicTitles();
    const docs = await getDocs(query(
        collection(db, "documents"),
        where("ownerUid", "==", currentUser.uid),
        where("category", "==", "academic")
    ));
    const uploaded = new Set(docs.docs.map((d) => d.data().title));
    const available = titles.filter((item) => !uploaded.has(item.title));

    if (select) {
        select.innerHTML = '<option value="">Choose title</option>';
        available.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.title;
            option.textContent = item.title;
            select.appendChild(option);
        });
        const empty = document.getElementById("academicUploadEmpty");
        if (empty) empty.hidden = available.length > 0;
    }
    if (list) {
        list.innerHTML = titles.map((item) => `<span class="pill">${item.title}</span>`).join("");
    }
}

function renderDocuments(uid, category) {
    const body = document.getElementById("studentDocumentsBody");
    const empty = document.getElementById("studentDocumentsEmpty");
    const count = document.getElementById("studentDocumentsCount");
    if (!body) return;

    const q = query(
        collection(db, "documents"),
        where("ownerUid", "==", uid),
        where("category", "==", category),
        orderBy("uploadedAt", "desc")
    );

    onSnapshot(q, (snap) => {
        body.innerHTML = "";
        if (count) count.textContent = `${snap.size} files`;
        if (empty) empty.hidden = !snap.empty;
        snap.forEach((docSnap) => {
            const item = docSnap.data();
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><b>${item.title}</b></td>
                <td>${item.fileName}</td>
                <td>${formatDate(item.uploadedAt)}</td>
                <td class="action-cell">
                    <a class="small-btn" href="${item.fileURL}" target="_blank" rel="noopener">VIEW</a>
                    <a class="small-btn" href="${item.fileURL}" download="${item.fileName}">DOWNLOAD</a>
                    <button class="small-btn danger" data-delete-doc="${docSnap.id}" data-path="${item.storagePath}">REMOVE</button>
                </td>`;
            body.appendChild(tr);
        });
        refreshAcademicSelect();
    });
}

async function saveDocument(form, category) {
    const file = form.elements.document?.files?.[0];
    const result = validateDocumentFile(file);
    if (!result.ok) throw new Error(result.message);

    const title = category === "academic"
        ? normalizeTitle(form.elements.title_id?.value)
        : normalizeTitle(form.elements.title?.value);
    if (!title) throw new Error("Enter or select document title.");

    const path = `documents/${currentUser.uid}/${category}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file, { customMetadata: { ownerUid: currentUser.uid, category } });
    const fileURL = await getDownloadURL(fileRef);

    await addDoc(collection(db, "documents"), {
        ownerUid: currentUser.uid,
        ownerName: currentProfile.name,
        ownerRegNo: currentProfile.regNo,
        department: currentProfile.department,
        departmentKey: currentProfile.departmentKey,
        year: currentProfile.year,
        category,
        title,
        fileName: file.name,
        fileURL,
        storagePath: path,
        uploadedAt: serverTimestamp(),
    });
    form.reset();
}

async function updateProfilePhoto(form) {
    const file = form.elements.photo?.files?.[0];
    const result = validatePhotoFile(file);
    if (!result.ok) throw new Error(result.message);

    const path = `profilePhotos/${currentUser.uid}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file, { customMetadata: { ownerUid: currentUser.uid } });
    const photoURL = await getDownloadURL(fileRef);
    await updateDoc(doc(db, "users", currentUser.uid), { photoURL, photoStoragePath: path });
    await loadProfile(currentUser.uid);
    form.reset();
}

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        currentUser = user;
        await loadProfile(user.uid);
        watchCounts(user.uid);
        const category = currentCategory();
        if (category) renderDocuments(user.uid, category);
        if (category === "academic") await refreshAcademicSelect();
    });

    document.getElementById("studentPhotoForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await updateProfilePhoto(event.currentTarget);
            showMessage("Profile photo updated.", "success");
        } catch (error) {
            showMessage(error.message, "danger");
        }
    });

    document.getElementById("certificateUploadForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await saveDocument(event.currentTarget, currentCategory());
            showMessage("Document uploaded successfully.", "success");
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
