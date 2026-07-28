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
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { auth, db, storage } from "./firebase.js";
import { DEFAULT_ACADEMIC_TITLES } from "./validation.js";

const profileCollection = "profiles";
const documentsCollection = "documents";
const titlesCollection = "academicTitles";

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeSegment(value) {
  return String(value || "file").replace(/[^a-z0-9._-]/gi, "_");
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
    file_name: data.fileName,
    file_url: data.downloadUrl,
    uploaded_at: uploaded ? new Date(uploaded).toISOString() : ""
  };
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
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "permission-denied": "Permission denied. Check Firebase security rules.",
    "storage/unauthorized": "Storage permission denied. Check Firebase Storage rules.",
    "storage/object-not-found": "File not found in Firebase Storage."
  };
  return map[code] || message || "Firebase request failed. Check the browser console.";
}

export async function registerStudent(payload) {
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
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.set(mobileRef, { uid, role: profile.role, createdAt: serverTimestamp() });
    if (regRef) transaction.set(regRef, { uid, createdAt: serverTimestamp() });
  });
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getProfile(credential.user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error("Profile not found. Register again or check Firestore profiles collection.");
  }
  return profile;
}

export function logout() {
  return signOut(auth);
}

export function waitForUser() {
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
  const user = auth.currentUser || await waitForUser();
  if (!user) return null;
  return getProfile(user.uid);
}

export async function uploadProfilePhoto(profile, file) {
  const path = `profiles/${profile.uid}/${nowId()}-${safeSegment(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, {
    contentType: file.type,
    customMetadata: { ownerId: profile.uid, category: "profile" }
  });
  const downloadUrl = await getDownloadURL(fileRef);
  await updateDoc(doc(db, profileCollection, profile.uid), {
    photoPath: path,
    photoUrl: downloadUrl,
    updatedAt: serverTimestamp()
  });
  if (profile.photoPath) await deleteObject(ref(storage, profile.photoPath)).catch(() => {});
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
  const path = `documents/${profile.uid}/${category}/${nowId()}-${safeSegment(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, {
    contentType: file.type,
    customMetadata: {
      ownerId: profile.uid,
      category,
      departmentKey: profile.departmentKey,
      year: profile.year
    }
  });
  const downloadUrl = await getDownloadURL(fileRef);
  const docRef = doc(db, documentsCollection, documentId(profile.uid, category, title));
  const existing = await getDoc(docRef);
  if (existing.exists() && existing.data().storagePath) {
    await deleteObject(ref(storage, existing.data().storagePath)).catch(() => {});
  }
  await setDoc(docRef, {
    ownerId: profile.uid,
    ownerName: profile.name,
    ownerRegNo: profile.regNo || "",
    department: profile.department,
    departmentKey: profile.departmentKey,
    year: profile.year,
    category,
    title,
    fileName: file.name,
    storagePath: path,
    downloadUrl,
    uploadedAt: serverTimestamp()
  });
}

export async function deleteStudentDocument(profile, documentIdValue) {
  const docRef = doc(db, documentsCollection, documentIdValue);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Document not found.");
  const data = snapshot.data();
  if (data.ownerId !== profile.uid) throw new Error("You can delete only your own documents.");
  await deleteDoc(docRef);
  if (data.storagePath) await deleteObject(ref(storage, data.storagePath)).catch(() => {});
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
    createdAt: serverTimestamp()
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
  const docRef = doc(db, documentsCollection, documentIdValue);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Document not found.");
  const data = snapshot.data();
  if (data.category !== "academic" || data.departmentKey !== profile.departmentKey || data.year !== profile.year) {
    throw new Error("You can delete only matching academic documents.");
  }
  await deleteDoc(docRef);
  if (data.storagePath) await deleteObject(ref(storage, data.storagePath)).catch(() => {});
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
