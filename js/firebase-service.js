import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { auth, authReady, db, storage } from "./firebase.js";
import {
  DEFAULT_ACADEMIC_TITLES,
  documentMimeType,
  isAcademicYear,
  isDepartment,
  photoMimeType
} from "./validation.js";

const profileCollection = "profiles";
const documentsCollection = "documents";
const titlesCollection = "academicTitles";
const documentCategories = ["online", "personal", "academic"];

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeSegment(value) {
  const safe = String(value || "file")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "file";
}

function titleId(profile, title) {
  return `${profile.departmentKey}_${profile.year}_${safeSegment(title).toUpperCase()}`;
}

function documentId(uid, category, title) {
  return `${uid}_${category}_${safeSegment(title).toUpperCase()}`;
}

function profileFromDoc(snapshot) {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    uid: snapshot.id,
    ...data,
    reg_no: data.regNo || "",
    photo_url: data.photoUrl || ""
  };
}

function documentFromDoc(snapshot) {
  const data = snapshot.data();
  const uploaded = data.uploadedAt?.toDate?.() || data.uploadedAt || null;
  return {
    id: snapshot.id,
    ...data,
    owner_id: data.ownerId,
    owner_name: data.ownerName,
    owner_reg_no: data.ownerRegNo,
    file_name: data.originalName || data.fileName,
    file_url: data.downloadURL || data.downloadUrl,
    uploaded_at: uploaded ? new Date(uploaded).toISOString() : ""
  };
}

function uploadWithProgress(fileRef, file, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file, metadata);
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      reject,
      () => resolve(task.snapshot)
    );
  });
}

async function requireCurrentUser(expectedUid) {
  await authReady;
  const user = auth.currentUser || await waitForUser();
  if (!user) throw new Error("You must be logged in to continue.");
  if (expectedUid && user.uid !== expectedUid) throw new Error("You can manage only your own files.");
  return user;
}

async function removeStorageObject(storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") throw error;
  }
}

export function firebaseErrorMessage(error) {
  console.error("Firebase operation failed", error);
  const code = error?.code || "";
  const message = error?.message || "";
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "No account found for this email.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/weak-password": "Password must contain at least 6 characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-api-key": "Firebase configuration is invalid. Check the deployed Firebase config.",
    "auth/operation-not-allowed": "Email/password login is not enabled in Firebase Authentication.",
    "auth/too-many-requests": "Too many failed attempts. Try again later.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "permission-denied": "Permission denied. Check Firebase security rules.",
    "storage/unauthorized": "Storage permission denied. Check Firebase Storage rules.",
    "storage/object-not-found": "File not found in Firebase Storage."
  };
  return map[code] || message || "Firebase request failed. Check the browser console.";
}

export async function registerStudent(payload) {
  await authReady;
  const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
  try {
    await updateProfile(credential.user, { displayName: payload.name });
    await createProfileWithUniqueKeys(credential.user.uid, {
      role: "student",
      name: payload.name,
      regNo: payload.regNo,
      email: payload.email,
      year: payload.year,
      department: payload.department,
      departmentKey: payload.departmentKey,
      mobile: payload.mobile
    });
    return getCurrentProfile();
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

export async function registerTeacher(payload) {
  await authReady;
  const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
  try {
    await updateProfile(credential.user, { displayName: payload.name });
    await createProfileWithUniqueKeys(credential.user.uid, {
      role: "teacher",
      name: payload.name,
      email: payload.email,
      year: payload.year,
      department: payload.department,
      departmentKey: payload.departmentKey,
      mobile: payload.mobile
    });
    return getCurrentProfile();
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

async function createProfileWithUniqueKeys(uid, profile) {
  if (!isDepartment(profile.department)) throw new Error("Invalid department selected.");
  if (!isAcademicYear(profile.year)) throw new Error("Invalid academic year selected.");
  if (!profile.departmentKey) throw new Error("Invalid department selected.");

  await runTransaction(db, async (transaction) => {
    const mobileRef = doc(db, "uniqueMobileNumbers", profile.mobile);
    const mobileSnap = await transaction.get(mobileRef);
    if (mobileSnap.exists()) throw new Error("This mobile number is already registered.");

    let regRef = null;
    if (profile.role === "student") {
      regRef = doc(db, "uniqueRegisterNumbers", profile.regNo);
      const regSnap = await transaction.get(regRef);
      if (regSnap.exists()) throw new Error("This register number is already registered.");
    }

    transaction.set(doc(db, profileCollection, uid), {
      uid,
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.set(mobileRef, { uid, role: profile.role, createdAt: serverTimestamp() });
    if (regRef) transaction.set(regRef, { uid, createdAt: serverTimestamp() });
  });
}

export async function loginWithEmail(email, password) {
  await authReady;
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getProfile(credential.user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error("Profile not found. Register again or check Firestore profiles collection.");
  }
  return profile;
}

export function logout() {
  return authReady.then(() => signOut(auth));
}

export async function waitForUser() {
  await authReady;
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getProfile(uid) {
  return profileFromDoc(await getDoc(doc(db, profileCollection, uid)));
}

export async function getCurrentProfile() {
  await authReady;
  const user = auth.currentUser || await waitForUser();
  if (!user) return null;
  return getProfile(user.uid);
}

export async function uploadProfilePhoto(profile, file) {
  await requireCurrentUser(profile.uid);
  const mimeType = photoMimeType(file);
  if (!mimeType) throw new Error("This file type is not supported.");
  const safeName = safeSegment(file.name);
  const path = `users/${profile.uid}/profile/${nowId()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadWithProgress(fileRef, file, {
    contentType: mimeType,
    customMetadata: { ownerId: profile.uid, category: "profile" }
  });
  const downloadUrl = await getDownloadURL(fileRef);
  try {
    await updateDoc(doc(db, profileCollection, profile.uid), {
      photoPath: path,
      photoUrl: downloadUrl,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    await removeStorageObject(path).catch((cleanupError) => {
      console.error("Profile photo rollback failed", cleanupError);
    });
    throw error;
  }
  if (profile.photoPath) {
    await removeStorageObject(profile.photoPath).catch((error) => {
      console.warn("Previous profile photo cleanup failed", error);
    });
  }
  return getProfile(profile.uid);
}

export async function listStudentDocuments(profile, category) {
  const docsQuery = query(
    collection(db, documentsCollection),
    where("ownerId", "==", profile.uid),
    where("category", "==", category)
  );
  const snapshots = await getDocs(docsQuery);
  return snapshots.docs.map(documentFromDoc).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
}

export async function uploadStudentDocument(profile, category, title, file) {
  await requireCurrentUser(profile.uid);
  if (!documentCategories.includes(category)) throw new Error("Invalid document category.");
  if (!file) throw new Error("Please select a file.");
  const mimeType = documentMimeType(file);
  if (!mimeType) throw new Error("This file type is not supported.");
  const id = documentId(profile.uid, category, title);
  const docRef = doc(db, documentsCollection, id);
  const existing = await getDoc(docRef);
  const safeName = `${nowId()}-${safeSegment(file.name)}`;
  const path = `users/${profile.uid}/documents/${id}/${safeName}`;
  const fileRef = ref(storage, path);
  await uploadWithProgress(fileRef, file, {
    contentType: mimeType,
    customMetadata: {
      ownerId: profile.uid,
      category,
      documentId: id,
      departmentKey: profile.departmentKey,
      year: profile.year
    }
  });
  const downloadUrl = await getDownloadURL(fileRef);
  try {
    await setDoc(docRef, {
      id,
      ownerId: profile.uid,
      userId: profile.uid,
      uploadedUserId: profile.uid,
      uploadedUserEmail: profile.email || "",
      ownerName: profile.name,
      ownerRegNo: profile.regNo || "",
      department: profile.department,
      departmentKey: profile.departmentKey,
      year: profile.year,
      category,
      title,
      originalName: file.name,
      fileName: safeName,
      storagePath: path,
      downloadURL: downloadUrl,
      downloadUrl,
      fileType: file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "",
      mimeType,
      size: file.size,
      description: "",
      accessLevel: category === "academic" ? "teacher-visible" : "private",
      status: "active",
      uploadedAt: serverTimestamp(),
      createdAt: existing.exists() && existing.data().createdAt ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    let cleanupFailed = false;
    await removeStorageObject(path).catch((cleanupError) => {
      cleanupFailed = true;
      console.error("Document upload rollback failed", cleanupError);
    });
    if (cleanupFailed) {
      throw new Error("Document upload failed and cleanup could not be completed. Please try again.");
    }
    throw error;
  }
  if (existing.exists() && existing.data().storagePath) {
    await removeStorageObject(existing.data().storagePath).catch((error) => {
      console.warn("Previous document cleanup failed", error);
    });
  }
}

export async function deleteStudentDocument(profile, documentIdValue) {
  await requireCurrentUser(profile.uid);
  const docRef = doc(db, documentsCollection, documentIdValue);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Document not found.");
  const data = snapshot.data();
  if (data.ownerId !== profile.uid) throw new Error("You can delete only your own documents.");
  await removeStorageObject(data.storagePath);
  await deleteDoc(docRef);
}

export async function listAcademicTitles(profile) {
  const titleQuery = query(
    collection(db, titlesCollection),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  );
  const snapshots = await getDocs(titleQuery);
  return snapshots.docs.map((item) => ({ id: item.id, title: item.data().title, custom: true }));
}

export async function addAcademicTitle(profile, title) {
  await setDoc(doc(db, titlesCollection, titleId(profile, title)), {
    title,
    department: profile.department,
    departmentKey: profile.departmentKey,
    year: profile.year,
    createdBy: profile.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listTeacherStudents(profile, filter = "") {
  const studentsQuery = query(
    collection(db, profileCollection),
    where("role", "==", "student"),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  );
  const snapshots = await getDocs(studentsQuery);
  const search = String(filter || "").trim().toUpperCase();
  const students = snapshots.docs.map(profileFromDoc);
  const academicDocs = await listTeacherAcademicDocuments(profile);
  return students
    .map((student) => ({
      ...student,
      academic_count: academicDocs.filter((item) => item.ownerId === student.uid).length
    }))
    .filter((student) => !search || student.name.includes(search) || student.reg_no.includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeacherStudentDetail(profile, studentUid) {
  const student = await getProfile(studentUid);
  if (!student || student.role !== "student") throw new Error("Student not found.");
  if (student.departmentKey !== profile.departmentKey || student.year !== profile.year) {
    throw new Error("You can view only matching department and year students.");
  }
  const documents = (await listTeacherAcademicDocuments(profile)).filter((item) => item.ownerId === studentUid);
  return { student, documents };
}

export async function listTeacherAcademicDocuments(profile) {
  const docsQuery = query(
    collection(db, documentsCollection),
    where("category", "==", "academic"),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  );
  const snapshots = await getDocs(docsQuery);
  return snapshots.docs.map(documentFromDoc).sort((a, b) => a.ownerName.localeCompare(b.ownerName));
}

export async function deleteTeacherAcademicDocument(profile, documentIdValue) {
  await requireCurrentUser(profile.uid);
  const docRef = doc(db, documentsCollection, documentIdValue);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Document not found.");
  const data = snapshot.data();
  if (data.category !== "academic" || data.departmentKey !== profile.departmentKey || data.year !== profile.year) {
    throw new Error("You can delete only matching academic documents.");
  }
  await removeStorageObject(data.storagePath);
  await deleteDoc(docRef);
}

export async function teacherStatus(profile) {
  const students = await listTeacherStudents(profile);
  const docs = await listTeacherAcademicDocuments(profile);
  const titles = [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...(await listAcademicTitles(profile))
  ].filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index);

  return titles.map((title) => {
    const uploadedIds = new Set(docs.filter((docItem) => docItem.title === title.title).map((docItem) => docItem.ownerId));
    return {
      title: title.title,
      uploaded: students.filter((student) => uploadedIds.has(student.uid)),
      pending: students.filter((student) => !uploadedIds.has(student.uid))
    };
  });
}
