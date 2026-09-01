import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
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
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { auth, authReady, db } from "./firebase.js";
import {
  DEFAULT_ACADEMIC_TITLES,
  departmentKey,
  documentMimeType,
  isAcademicYear,
  isDepartment,
  isRecoveryQuestion,
  normalizeName,
  photoMimeType
} from "./validation.js";

const profileCollection = "profiles";
const documentsCollection = "documents";
const titlesCollection = "academicTitles";
const uniqueMobileCollection = "uniqueMobileNumbers";
const uniqueRegisterCollection = "uniqueRegisterNumbers";
const uniqueTeacherScopeCollection = "uniqueTeacherScopes";
const passwordRecoveryCollection = "passwordRecovery";
const documentCategories = ["online", "personal", "academic"];
const fileChunksCollection = "fileChunks";
const photoChunksCollection = "photoChunks";
const firestoreChunkChars = 700000;
const recoveryHashAlgorithm = "PBKDF2-SHA-256";
const recoveryHashIterations = 210000;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes("/")) {
    const error = new Error("Enter a valid email address.");
    error.code = "auth/invalid-email";
    throw error;
  }
  return email;
}

export function normalizeRecoveryAnswer(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function hashRecoveryAnswer(answer, salt, iterations = recoveryHashIterations) {
  const normalized = normalizeRecoveryAnswer(answer);
  if (normalized.length < 2 || normalized.length > 100) {
    throw new Error("Recovery answer must contain between 2 and 100 characters.");
  }
  if (!/^[a-f0-9]{32}$/.test(String(salt || ""))) {
    throw new Error("Recovery answer security data is invalid.");
  }
  if (!Number.isInteger(iterations) || iterations < recoveryHashIterations) {
    throw new Error("Recovery answer security settings are invalid.");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: encoder.encode(salt),
    iterations
  }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function createRecoverySalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function prepareRecoveryData(question, answer) {
  if (!isRecoveryQuestion(question)) throw new Error("Please select a valid recovery question.");
  const salt = createRecoverySalt();
  return {
    recoveryQuestion: question,
    recoveryAnswerHash: await hashRecoveryAnswer(answer, salt),
    recoveryAnswerSalt: salt,
    recoveryHashAlgorithm,
    recoveryHashIterations
  };
}

async function getRecoveryRecord(email) {
  await authReady;
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await getDoc(doc(db, passwordRecoveryCollection, normalizedEmail));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (!isRecoveryQuestion(data.recoveryQuestion)
    || !/^[a-f0-9]{32}$/.test(data.recoveryAnswerSalt || "")
    || data.recoveryHashAlgorithm !== recoveryHashAlgorithm
    || data.recoveryHashIterations !== recoveryHashIterations) {
    return null;
  }
  return { email: normalizedEmail, ...data };
}

export async function getRecoveryQuestionByEmail(email) {
  const record = await getRecoveryRecord(email);
  return record?.recoveryQuestion || null;
}

export async function verifyRecoveryAnswer(email, answer) {
  const normalizedEmail = normalizeEmail(email);
  const record = await getRecoveryRecord(normalizedEmail);
  const salt = record?.recoveryAnswerSalt || "00000000000000000000000000000000";
  const normalizedAnswer = normalizeRecoveryAnswer(answer);
  const answerIsValid = normalizedAnswer.length >= 2 && normalizedAnswer.length <= 100;
  const answerHash = await hashRecoveryAnswer(
    answerIsValid ? normalizedAnswer : "invalid recovery answer",
    salt,
    recoveryHashIterations
  );
  if (!record || !answerIsValid) return false;
  const verifier = await getDoc(doc(
    db,
    passwordRecoveryCollection,
    normalizedEmail,
    "verifiers",
    answerHash
  ));
  return verifier.exists();
}

export async function sendRecoveryPasswordReset(email) {
  await authReady;
  try {
    return await sendPasswordResetEmail(auth, normalizeEmail(email));
  } catch (error) {
    if (error?.code === "auth/user-not-found") return;
    throw error;
  }
}

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

function teacherScopeId(profile) {
  return `${profile.departmentKey}_${safeSegment(profile.year).toUpperCase()}`;
}

function documentId(uid, category, title) {
  return `${uid}_${category}_${safeSegment(title).toUpperCase()}`;
}

function tagFirebaseError(error, operation) {
  if (error && typeof error === "object") error.operation = operation;
  return error;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id || item?.uid;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function profileError(message, missingFields = []) {
  const error = new Error(message);
  error.code = "app/profile-incomplete";
  error.missingProfileFields = missingFields;
  return error;
}

function requireProfileScope(profile, expectedRole, action) {
  const missing = [];
  if (!profile?.uid) missing.push("uid");
  if (!profile?.role) missing.push("role");
  if (expectedRole && profile?.role && profile.role !== expectedRole) {
    throw profileError(`Only ${expectedRole} accounts can ${action}.`);
  }
  if (!profile?.name) missing.push("name");
  if (!profile?.email) missing.push("email");
  if (!profile?.department || !isDepartment(profile.department)) missing.push("department");
  if (!profile?.departmentKey) missing.push("departmentKey");
  if (!profile?.year || !isAcademicYear(profile.year)) missing.push("year");
  if (expectedRole === "student" && !profile?.regNo) missing.push("regNo");
  if (missing.length) {
    throw profileError(
      `Your Firestore profile is missing required ${expectedRole || "dashboard"} fields for ${action}: ${missing.join(", ")}. ` +
        "Fix profiles/{your-user-id} in Firestore or register the account again.",
      missing
    );
  }
  return profile;
}

function profileFromDoc(snapshot) {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const regNo = data.regNo || data.reg_no || "";
  const normalizedDepartmentKey = data.departmentKey || departmentKey(data.department);
  return {
    id: snapshot.id,
    uid: snapshot.id,
    ...data,
    regNo,
    reg_no: regNo,
    departmentKey: normalizedDepartmentKey
  };
}

function safeExternalUrl(value, { throwOnInvalid = false } = {}) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol === "https:" || localHttp) return url.href;
  } catch (_error) {
    // Invalid legacy URLs are handled below.
  }
  if (throwOnInvalid) {
    const error = new Error("The stored file URL is invalid or insecure. Upload the file again.");
    error.code = "app/stored-file-url-invalid";
    throw error;
  }
  return "";
}

function documentFromDoc(snapshot) {
  const data = snapshot.data();
  const uploadedAt = timestampIso(data.uploadedAt);
  return {
    id: snapshot.id,
    ...data,
    file_name: data.originalName || data.fileName,
    file_url: data.downloadURL || data.downloadUrl || "",
    uploaded_at: uploadedAt
  };
}

function timestampIso(value) {
  try {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  } catch (_error) {
    return "";
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("Unable to read file.")));
    reader.readAsDataURL(file);
  });
}

function chunkString(value) {
  const chunks = [];
  for (let index = 0; index < value.length; index += firestoreChunkChars) {
    chunks.push(value.slice(index, index + firestoreChunkChars));
  }
  return chunks;
}

function chunkId(version, index) {
  return `${version}_${String(index).padStart(4, "0")}`;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function storedFileError() {
  const error = new Error("Stored file data is incomplete. Upload the file again.");
  error.code = "app/stored-file-incomplete";
  return error;
}

async function commitBatches(operations) {
  for (let index = 0; index < operations.length; index += 10) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(index, index + 10)) {
      operation(batch);
    }
    await batch.commit();
  }
}

async function deleteSnapshots(snapshots) {
  await commitBatches(snapshots.map((snapshot) => (batch) => batch.delete(snapshot.ref)));
}

async function listChunkSnapshots(parentRef, collectionName) {
  const snapshot = await getDocs(collection(parentRef, collectionName));
  return snapshot.docs;
}

async function deleteChunks(parentRef, collectionName, filter = () => true) {
  const chunks = (await listChunkSnapshots(parentRef, collectionName)).filter((snapshot) => filter(snapshot.data()));
  await deleteSnapshots(chunks);
}

async function writeChunks(parentRef, collectionName, chunks, metadata) {
  const operations = chunks.map((data, index) => (batch) => {
    batch.set(doc(parentRef, collectionName, chunkId(metadata.fileDataVersion, index)), {
      ...metadata,
      chunkIndex: index,
      chunkCount: chunks.length,
      data,
      createdAt: serverTimestamp()
    });
  });
  await commitBatches(operations);
}

async function buildObjectUrl(parentRef, collectionName, metadata) {
  if (metadata.downloadURL || metadata.downloadUrl) {
    return safeExternalUrl(metadata.downloadURL || metadata.downloadUrl, { throwOnInvalid: true });
  }
  if (!metadata.fileDataVersion || !Number.isInteger(metadata.chunkCount) || metadata.chunkCount <= 0) {
    throw storedFileError();
  }
  const snapshots = await listChunkSnapshots(parentRef, collectionName);
  const chunks = snapshots
    .map((snapshot) => snapshot.data())
    .filter((item) => item.fileDataVersion === metadata.fileDataVersion)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  const chunksAreComplete = chunks.length === metadata.chunkCount
    && chunks.every((item, index) => (
      item.chunkIndex === index
      && item.chunkCount === metadata.chunkCount
      && typeof item.data === "string"
      && item.data.length > 0
    ));
  if (!chunksAreComplete) {
    throw storedFileError();
  }

  const base64 = chunks.map((item) => item.data).join("");
  let blob = null;
  try {
    const bytes = base64ToUint8Array(base64);
    if (Number.isFinite(metadata.size) && metadata.size > 0 && bytes.length !== metadata.size) {
      throw storedFileError();
    }
    blob = new Blob([bytes], {
      type: metadata.mimeType || metadata.photoMimeType || "application/octet-stream"
    });
  } catch (_error) {
    throw storedFileError();
  }
  return URL.createObjectURL(blob);
}

async function requireCurrentUser(expectedUid) {
  await authReady;
  const user = auth.currentUser || await waitForUser();
  if (!user) throw new Error("You must be logged in to continue.");
  if (expectedUid && user.uid !== expectedUid) throw new Error("You can manage only your own files.");
  return user;
}

function requireRecentAccountLogin(user) {
  const lastSignIn = Date.parse(user?.metadata?.lastSignInTime || "");
  if (!lastSignIn || Date.now() - lastSignIn > 4 * 60 * 1000) {
    const error = new Error("For safety, log out and log in again, then remove the account within 4 minutes.");
    error.code = "auth/requires-recent-login";
    throw error;
  }
}

async function getOwnedDocumentForReplace(docRef, ownerId) {
  try {
    const snapshot = await getDoc(docRef);
    if (snapshot.exists() && snapshot.data().ownerId !== ownerId) {
      throw new Error("You can replace only your own documents.");
    }
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    if (error?.code === "permission-denied") return null;
    throw error;
  }
}

export function firebaseErrorMessage(error) {
  console.error("Firebase operation failed", error);
  const code = error?.code || "";
  const message = error?.message || "";
  if (code === "app/profile-incomplete") {
    return message || "Your Firestore profile is incomplete. Fix the profiles collection document for this account.";
  }
  const operationMessages = {
    "firestore-chunks": "Firestore file chunk save denied. Publish Firestore rules and check the logged-in student profile.",
    "firestore-metadata": "Firestore metadata save denied. Publish Firestore rules and check the logged-in student profile.",
    "firestore-photo": "Firestore profile photo metadata save denied. Publish Firestore rules and check the logged-in student profile."
  };
  if (error?.operation && (code === "permission-denied" || code === "storage/unauthorized")) {
    return operationMessages[error.operation] || operationMessages["firestore-metadata"];
  }
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "No account found for this email.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/weak-password": "Password must contain at least 6 characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/missing-password": "Enter your password.",
    "auth/invalid-login-credentials": "Invalid email or password.",
    "auth/invalid-api-key": "Firebase configuration is invalid. Check the deployed Firebase config.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase configuration is invalid. Check the deployed Firebase config.",
    "auth/operation-not-allowed": "Email/password login is not enabled in Firebase Authentication.",
    "auth/requires-recent-login": "For safety, log out and log in again, then remove the account within 4 minutes.",
    "auth/too-many-requests": "Too many failed attempts. Try again later.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "permission-denied": "Permission denied. Deploy the latest Firebase Firestore rules.",
    "storage/unauthorized": "Firebase Storage permission denied. The app now stores files in Firestore; deploy the latest code.",
    "resource-exhausted": "The selected file is too large for Firestore. Choose a smaller file."
  };
  return map[code] || message || "Firebase request failed. Check the browser console.";
}

export async function registerStudent(payload) {
  await authReady;
  const email = normalizeEmail(payload.email);
  const recovery = await prepareRecoveryData(payload.recoveryQuestion, payload.recoveryAnswer);
  const credential = await createUserWithEmailAndPassword(auth, email, payload.password);
  try {
    await updateProfile(credential.user, { displayName: payload.name });
    await createProfileWithUniqueKeys(credential.user.uid, {
      role: "student",
      name: payload.name,
      regNo: payload.regNo,
      email,
      year: payload.year,
      department: payload.department,
      departmentKey: payload.departmentKey,
      mobile: payload.mobile,
      ...recovery
    });
    return getCurrentProfile();
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

export async function registerTeacher(payload) {
  await authReady;
  const email = normalizeEmail(payload.email);
  const recovery = await prepareRecoveryData(payload.recoveryQuestion, payload.recoveryAnswer);
  const credential = await createUserWithEmailAndPassword(auth, email, payload.password);
  try {
    await updateProfile(credential.user, { displayName: payload.name });
    await createProfileWithUniqueKeys(credential.user.uid, {
      role: "teacher",
      name: payload.name,
      email,
      year: payload.year,
      department: payload.department,
      departmentKey: payload.departmentKey,
      mobile: payload.mobile,
      ...recovery
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
  if (!isRecoveryQuestion(profile.recoveryQuestion)) throw new Error("Invalid recovery question selected.");
  if (!/^[a-f0-9]{64}$/.test(profile.recoveryAnswerHash || "")) {
    throw new Error("Recovery answer could not be secured.");
  }

  await runTransaction(db, async (transaction) => {
    const mobileRef = doc(db, uniqueMobileCollection, profile.mobile);
    const mobileSnap = await transaction.get(mobileRef);
    if (mobileSnap.exists()) throw new Error("This mobile number is already registered.");
    const recoveryRef = doc(db, passwordRecoveryCollection, profile.email);
    const recoverySnap = await transaction.get(recoveryRef);
    if (recoverySnap.exists()) throw new Error("Recovery details already exist for this email.");

    let regRef = null;
    let teacherScopeRef = null;
    if (profile.role === "student") {
      regRef = doc(db, uniqueRegisterCollection, profile.regNo);
      const regSnap = await transaction.get(regRef);
      if (regSnap.exists()) throw new Error("This register number is already registered.");
    }
    if (profile.role === "teacher") {
      teacherScopeRef = doc(db, uniqueTeacherScopeCollection, teacherScopeId(profile));
      const teacherScopeSnap = await transaction.get(teacherScopeRef);
      if (teacherScopeSnap.exists()) {
        throw new Error("A teacher is already registered for this department and academic year.");
      }
    }

    transaction.set(doc(db, profileCollection, uid), {
      uid,
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.set(recoveryRef, {
      recoveryQuestion: profile.recoveryQuestion,
      recoveryAnswerSalt: profile.recoveryAnswerSalt,
      recoveryHashAlgorithm: profile.recoveryHashAlgorithm,
      recoveryHashIterations: profile.recoveryHashIterations,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.set(doc(recoveryRef, "verifiers", profile.recoveryAnswerHash), {
      createdAt: serverTimestamp()
    });
    transaction.set(mobileRef, { uid, role: profile.role, createdAt: serverTimestamp() });
    if (regRef) transaction.set(regRef, { uid, createdAt: serverTimestamp() });
    if (teacherScopeRef) {
      transaction.set(teacherScopeRef, {
        uid,
        department: profile.department,
        departmentKey: profile.departmentKey,
        year: profile.year,
        createdAt: serverTimestamp()
      });
    }
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

export async function deleteCurrentAccount(profile = null) {
  await authReady;
  const user = await requireCurrentUser(profile?.uid);
  const accountProfile = profile || await getProfile(user.uid);
  if (!accountProfile) throw new Error("Profile not found. Log in again before removing the account.");
  requireRecentAccountLogin(user);

  if (accountProfile.role === "student") {
    const ownedDocs = await getDocs(query(
      collection(db, documentsCollection),
      where("ownerId", "==", accountProfile.uid)
    ));
    for (const snapshot of ownedDocs.docs) {
      await deleteChunks(snapshot.ref, fileChunksCollection).catch((error) => {
        console.warn("Document file chunk cleanup failed", error);
      });
      await deleteDoc(snapshot.ref);
    }
  }

  if (accountProfile.role === "teacher") {
    const titles = await getDocs(query(
      collection(db, titlesCollection),
      where("createdBy", "==", accountProfile.uid)
    ));
    await deleteSnapshots(titles.docs);
    await deleteDoc(doc(db, uniqueTeacherScopeCollection, teacherScopeId(accountProfile))).catch((error) => {
      console.warn("Teacher scope cleanup failed", error);
    });
  }

  const profileRef = doc(db, profileCollection, accountProfile.uid);
  await deleteChunks(profileRef, photoChunksCollection).catch((error) => {
    console.warn("Profile photo chunk cleanup failed", error);
  });
  if (accountProfile.mobile) {
    await deleteDoc(doc(db, uniqueMobileCollection, accountProfile.mobile)).catch((error) => {
      console.warn("Mobile uniqueness cleanup failed", error);
    });
  }
  if (accountProfile.role === "student" && accountProfile.regNo) {
    await deleteDoc(doc(db, uniqueRegisterCollection, accountProfile.regNo)).catch((error) => {
      console.warn("Register number uniqueness cleanup failed", error);
    });
  }
  if (accountProfile.email && accountProfile.recoveryAnswerHash) {
    const recoveryRef = doc(db, passwordRecoveryCollection, accountProfile.email);
    await deleteDoc(doc(recoveryRef, "verifiers", accountProfile.recoveryAnswerHash));
    await deleteDoc(recoveryRef);
  }
  await deleteDoc(profileRef);
  await deleteUser(user);
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
  requireProfileScope(profile, null, "upload a profile photo");
  await requireCurrentUser(profile.uid);
  const mimeType = photoMimeType(file);
  if (!mimeType) throw new Error("This file type is not supported.");
  const profileRef = doc(db, profileCollection, profile.uid);
  const version = nowId();
  const chunks = chunkString(await readFileAsBase64(file));
  try {
    await writeChunks(profileRef, photoChunksCollection, chunks, {
      ownerId: profile.uid,
      fileDataVersion: version
    });
  } catch (error) {
    await deleteChunks(profileRef, photoChunksCollection, (item) => item.fileDataVersion === version).catch((cleanupError) => {
      console.warn("Partial profile photo cleanup failed", cleanupError);
    });
    throw tagFirebaseError(error, "firestore-chunks");
  }
  try {
    await updateDoc(profileRef, {
      photoPath: "",
      photoUrl: "",
      photoProvider: "firestore",
      photoFileDataVersion: version,
      photoChunkCount: chunks.length,
      photoMimeType: mimeType,
      photoOriginalName: file.name,
      photoSize: file.size,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    await deleteChunks(profileRef, photoChunksCollection, (item) => item.fileDataVersion === version).catch((cleanupError) => {
      console.error("Profile photo rollback failed", cleanupError);
    });
    throw tagFirebaseError(error, "firestore-photo");
  }
  await deleteChunks(profileRef, photoChunksCollection, (item) => item.fileDataVersion !== version).catch((error) => {
    console.warn("Previous profile photo cleanup failed", error);
  });
  return getProfile(profile.uid);
}

export async function getProfilePhotoUrl(profile) {
  if (profile.photoProvider === "firestore" || profile.photoFileDataVersion) {
    if (!profile.photoFileDataVersion || !profile.photoChunkCount) return "";
    return buildObjectUrl(doc(db, profileCollection, profile.uid), photoChunksCollection, {
      fileDataVersion: profile.photoFileDataVersion,
      chunkCount: profile.photoChunkCount,
      mimeType: profile.photoMimeType,
      size: profile.photoSize
    });
  }
  return safeExternalUrl(profile.photoUrl);
}

export async function listStudentDocuments(profile, category = null) {
  requireProfileScope(profile, "student", "load student documents");
  if (category !== null && !documentCategories.includes(category)) {
    throw new Error("Invalid document category.");
  }
  const constraints = [where("ownerId", "==", profile.uid)];
  if (category) constraints.push(where("category", "==", category));
  const docsQuery = query(collection(db, documentsCollection), ...constraints);
  const snapshots = await getDocs(docsQuery);
  return snapshots.docs.map(documentFromDoc).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
}

export async function uploadStudentDocument(profile, category, title, file) {
  requireProfileScope(profile, "student", "upload documents");
  await requireCurrentUser(profile.uid);
  if (!documentCategories.includes(category)) throw new Error("Invalid document category.");
  if (!file) throw new Error("Please select a file.");
  const mimeType = documentMimeType(file);
  if (!mimeType) throw new Error("This file type is not supported.");
  const id = documentId(profile.uid, category, title);
  const docRef = doc(db, documentsCollection, id);
  const existingData = await getOwnedDocumentForReplace(docRef, profile.uid);
  const safeName = `${nowId()}-${safeSegment(file.name)}`;
  const version = nowId();
  const chunks = chunkString(await readFileAsBase64(file));
  try {
    await writeChunks(docRef, fileChunksCollection, chunks, {
      documentId: id,
      ownerId: profile.uid,
      category,
      departmentKey: profile.departmentKey,
      year: profile.year,
      fileDataVersion: version
    });
  } catch (error) {
    await deleteChunks(docRef, fileChunksCollection, (item) => item.fileDataVersion === version).catch((cleanupError) => {
      console.warn("Partial document upload cleanup failed", cleanupError);
    });
    throw tagFirebaseError(error, "firestore-chunks");
  }
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
      storageProvider: "firestore",
      fileDataVersion: version,
      chunkCount: chunks.length,
      fileType: file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "",
      mimeType,
      size: file.size,
      description: "",
      accessLevel: category === "academic" ? "teacher-visible" : "private",
      status: "active",
      uploadedAt: serverTimestamp(),
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    await deleteChunks(docRef, fileChunksCollection, (item) => item.fileDataVersion === version).catch((cleanupError) => {
      console.error("Document upload rollback failed", cleanupError);
    });
    throw tagFirebaseError(error, "firestore-metadata");
  }
  await deleteChunks(docRef, fileChunksCollection, (item) => item.fileDataVersion !== version).catch((error) => {
    console.warn("Previous document cleanup failed", error);
  });
}

export async function getDocumentObjectUrl(documentItem) {
  if (documentItem.file_url) return safeExternalUrl(documentItem.file_url, { throwOnInvalid: true });
  return buildObjectUrl(doc(db, documentsCollection, documentItem.id), fileChunksCollection, {
    fileDataVersion: documentItem.fileDataVersion,
    chunkCount: documentItem.chunkCount,
    mimeType: documentItem.mimeType,
    size: documentItem.size
  });
}

export async function deleteStudentDocument(profile, documentIdValue) {
  requireProfileScope(profile, "student", "delete documents");
  await requireCurrentUser(profile.uid);
  const docRef = doc(db, documentsCollection, documentIdValue);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Document not found.");
  const data = snapshot.data();
  if (data.ownerId !== profile.uid) throw new Error("You can delete only your own documents.");
  await deleteChunks(docRef, fileChunksCollection);
  await deleteDoc(docRef);
}

export async function listAcademicTitles(profile) {
  requireProfileScope(profile, null, "load academic titles");
  const titleQuery = query(
    collection(db, titlesCollection),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  );
  const snapshots = await getDocs(titleQuery);
  return snapshots.docs.map((item) => ({ id: item.id, title: item.data().title, custom: true }));
}

export async function addAcademicTitle(profile, title) {
  requireProfileScope(profile, "teacher", "add document titles");
  await requireCurrentUser(profile.uid);
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

export async function deleteAcademicTitle(profile, titleIdValue) {
  requireProfileScope(profile, "teacher", "remove document titles");
  await requireCurrentUser(profile.uid);
  const titleRef = doc(db, titlesCollection, titleIdValue);
  const snapshot = await getDoc(titleRef);
  if (!snapshot.exists()) throw new Error("Document title not found.");
  const data = snapshot.data();
  if (data.createdBy !== profile.uid || data.departmentKey !== profile.departmentKey || data.year !== profile.year) {
    throw new Error("You can remove only your own matching document titles.");
  }
  await deleteDoc(titleRef);
}

export async function listTeacherStudents(profile, filter = "") {
  requireProfileScope(profile, "teacher", "load students");
  const [students, academicDocs] = await Promise.all([
    listTeacherStudentProfiles(profile),
    listTeacherAcademicDocuments(profile)
  ]);
  const search = String(filter || "").trim().toUpperCase();
  return students
    .map((student) => ({
      ...student,
      academic_count: academicDocs.filter((item) => item.ownerId === student.uid).length
    }))
    .filter((student) => !search || normalizeName(student.name).includes(search) || student.reg_no.includes(search))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

async function listTeacherStudentProfiles(profile) {
  requireProfileScope(profile, "teacher", "load students");
  const byDepartmentKeyQuery = query(
    collection(db, profileCollection),
    where("role", "==", "student"),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  );
  const byDepartmentQuery = query(
    collection(db, profileCollection),
    where("role", "==", "student"),
    where("department", "==", profile.department),
    where("year", "==", profile.year)
  );
  const [departmentKeySnapshots, departmentSnapshots] = await Promise.all([
    getDocs(byDepartmentKeyQuery),
    getDocs(byDepartmentQuery)
  ]);
  return uniqueById([
    ...departmentKeySnapshots.docs.map(profileFromDoc),
    ...departmentSnapshots.docs.map(profileFromDoc)
  ]).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function getTeacherDashboardSummary(profile) {
  requireProfileScope(profile, "teacher", "load dashboard summary");
  const [students, documents, customTitles] = await Promise.all([
    listTeacherStudentProfiles(profile),
    listTeacherAcademicDocuments(profile),
    listAcademicTitles(profile)
  ]);
  const titleCount = new Set([
    ...DEFAULT_ACADEMIC_TITLES,
    ...customTitles.map((item) => item.title)
  ]).size;
  return {
    studentCount: students.length,
    academicCount: documents.length,
    titleCount
  };
}

export async function getTeacherStudentDetail(profile, studentUid) {
  requireProfileScope(profile, "teacher", "load student details");
  const student = await getProfile(studentUid);
  if (!student || student.role !== "student") throw new Error("Student not found.");
  if (student.departmentKey !== profile.departmentKey || student.year !== profile.year) {
    throw new Error("You can view only matching department and year students.");
  }
  const documents = (await listTeacherAcademicDocuments(profile)).filter((item) => item.ownerId === studentUid);
  return { student, documents };
}

export async function listTeacherAcademicDocuments(profile) {
  requireProfileScope(profile, "teacher", "load academic documents");
  const byDepartmentKeyQuery = query(
    collection(db, documentsCollection),
    where("category", "==", "academic"),
    where("departmentKey", "==", profile.departmentKey),
    where("year", "==", profile.year)
  );
  const byDepartmentQuery = query(
    collection(db, documentsCollection),
    where("category", "==", "academic"),
    where("department", "==", profile.department),
    where("year", "==", profile.year)
  );
  const [departmentKeySnapshots, departmentSnapshots] = await Promise.all([
    getDocs(byDepartmentKeyQuery),
    getDocs(byDepartmentQuery)
  ]);
  return uniqueById([
    ...departmentKeySnapshots.docs.map(documentFromDoc),
    ...departmentSnapshots.docs.map(documentFromDoc)
  ]).sort((a, b) => String(a.ownerName || "").localeCompare(String(b.ownerName || "")));
}

export async function deleteTeacherAcademicDocument(profile, documentIdValue) {
  requireProfileScope(profile, "teacher", "delete academic documents");
  await requireCurrentUser(profile.uid);
  const docRef = doc(db, documentsCollection, documentIdValue);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Document not found.");
  const data = snapshot.data();
  const matchingDepartment = data.departmentKey === profile.departmentKey || data.department === profile.department;
  if (data.category !== "academic" || !matchingDepartment || data.year !== profile.year) {
    throw new Error("You can delete only matching academic documents.");
  }
  await deleteChunks(docRef, fileChunksCollection);
  await deleteDoc(docRef);
}

export async function teacherStatus(profile) {
  requireProfileScope(profile, "teacher", "load document submission status");
  const [students, docs, customTitles] = await Promise.all([
    listTeacherStudentProfiles(profile),
    listTeacherAcademicDocuments(profile),
    listAcademicTitles(profile)
  ]);
  const titles = [
    ...DEFAULT_ACADEMIC_TITLES.map((title) => ({ title })),
    ...customTitles
  ].filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index);

  return titles.map((title) => {
    const docsForTitle = docs.filter((docItem) => docItem.title === title.title);
    const uploadedIds = new Set(docsForTitle.map((docItem) => docItem.ownerId));
    return {
      title: title.title,
      uploaded: students
        .filter((student) => uploadedIds.has(student.uid))
        .map((student) => ({
          ...student,
          documents: docsForTitle.filter((docItem) => docItem.ownerId === student.uid)
        })),
      pending: students.filter((student) => !uploadedIds.has(student.uid))
    };
  });
}
