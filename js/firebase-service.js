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
const batchesCollection = "batches";
const alumniConversionsCollection = "alumniConversions";
const batchGraduationsCollection = "batchGraduations";
const achievementsCollection = "achievements";
const documentCategories = ["online", "personal", "academic"];
const fileChunksCollection = "fileChunks";
const photoChunksCollection = "photoChunks";
const firestoreChunkChars = 700000;
const recoveryHashAlgorithm = "PBKDF2-SHA-256";
const recoveryHashIterations = 210000;

function firestoreContext(profile, extra = {}) {
  return {
    role: profile?.role || "unknown",
    teacherUid: profile?.role === "teacher" ? profile.uid || "unknown" : undefined,
    departmentKey: profile?.departmentKey || "unknown",
    year: profile?.year || "unknown",
    ...extra
  };
}

async function runFirestoreOperation(operation, context, task) {
  try {
    return await task();
  } catch (error) {
    error.operation = operation;
    console.error("Firestore operation failed", {
      operation,
      code: error?.code || "unknown",
      collection: context.collection || "unknown",
      ...context
    });
    throw error;
  }
}

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

function batchDocumentId(profile, batchLabel) {
  return `${safeSegment(profile.departmentKey).toUpperCase()}_${safeSegment(batchLabel).toUpperCase()}`;
}

function conversionDocumentId(batchId, studentUid) {
  return `${safeSegment(batchId)}_${safeSegment(studentUid)}`;
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

function requireOwnedLockerProfile(profile, action) {
  requireProfileScope(profile, null, action);
  if (!['student', 'alumni'].includes(profile.role)) {
    throw profileError(`Only Student or Alumni accounts can ${action}.`);
  }
  if (!profile.regNo) {
    throw profileError(`Your Firestore profile is missing register number for ${action}.`, ["regNo"]);
  }
  return profile;
}

function academicYears(value) {
  const match = String(value || "").match(/^(20\d{2})-(20\d{2})$/);
  if (!match) return null;
  const admissionYear = Number(match[1]);
  const graduationYear = Number(match[2]);
  if (graduationYear - admissionYear !== 3) return null;
  return { admissionYear, graduationYear, batchLabel: `${admissionYear}-${graduationYear}` };
}

function currentAcademicYear(batch) {
  const duration = Number(batch.graduationYear) - Number(batch.admissionYear);
  if (!Number.isInteger(duration) || duration <= 0) return null;
  const now = new Date();
  const academicStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  if (academicStartYear < Number(batch.admissionYear)) return null;
  return Math.min(duration, academicStartYear - Number(batch.admissionYear) + 1);
}

function isBatchGraduationEligible(batch) {
  return batch?.status === "active"
    && Number.isInteger(batch?.graduationYear)
    && new Date().getFullYear() >= batch.graduationYear;
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
    "permission-denied": "Your account is not authorized to access this data. Verify your account role and assigned scope.",
    "storage/unauthorized": "Firebase Storage permission denied. The app now stores files in Firestore; deploy the latest code.",
    "resource-exhausted": "The selected file is too large for Firestore. Choose a smaller file."
  };
  return map[code] || message || "Firebase request failed. Check the browser console.";
}

export async function registerStudent(payload) {
  await authReady;
  const email = normalizeEmail(payload.email);
  const recovery = await prepareRecoveryData(payload.recoveryQuestion, payload.recoveryAnswer);
  const years = academicYears(payload.year);
  const credential = await createUserWithEmailAndPassword(auth, email, payload.password);
  try {
    await updateProfile(credential.user, { displayName: payload.name });
    await createProfileWithUniqueKeys(credential.user.uid, {
      role: "student",
      name: payload.name,
      regNo: payload.regNo,
      email,
      year: payload.year,
      batch: years?.batchLabel || "",
      batchId: "",
      admissionYear: years?.admissionYear || null,
      graduationYear: years?.graduationYear || null,
      studentStatus: "active",
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

  if (["student", "alumni"].includes(accountProfile.role)) {
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
    const assignedBatches = await getDocs(query(
      collection(db, batchesCollection),
      where("assignedTeacherUid", "==", accountProfile.uid)
    ));
    if (!assignedBatches.empty) {
      throw new Error("This teacher account owns batch history and cannot be removed until an administrator securely reassigns those batches.");
    }
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
  if (["student", "alumni"].includes(accountProfile.role) && accountProfile.regNo) {
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
  requireOwnedLockerProfile(profile, "load documents");
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
  requireOwnedLockerProfile(profile, "upload documents");
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
      batchId: profile.batchId || "",
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
      batchId: profile.batchId || "",
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
  requireOwnedLockerProfile(profile, "delete documents");
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

function batchFromDoc(snapshot) {
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

async function requireAssignedBatch(profile, batchId, { activeOnly = false } = {}) {
  requireProfileScope(profile, "teacher", "manage batches");
  await requireCurrentUser(profile.uid);
  const snapshot = await getDoc(doc(db, batchesCollection, batchId));
  const batch = batchFromDoc(snapshot);
  if (!batch) throw new Error("Batch not found.");
  if (batch.assignedTeacherUid !== profile.uid) throw new Error("You are not authorized to manage this batch.");
  if (batch.departmentKey !== profile.departmentKey) throw new Error("This batch belongs to another department.");
  if (activeOnly && batch.status !== "active") throw new Error("This batch has already been graduated or archived.");
  return batch;
}

async function getBatchMembers(batchId) {
  const [students, alumni] = await runFirestoreOperation("list batch members", {
    collection: profileCollection,
    batchId
  }, () => Promise.all([
    getDocs(query(collection(db, profileCollection), where("batchId", "==", batchId), where("role", "==", "student"))),
    getDocs(query(collection(db, profileCollection), where("batchId", "==", batchId), where("role", "==", "alumni")))
  ]));
  return [...students.docs, ...alumni.docs].map(profileFromDoc);
}

export async function listTeacherBatches(profile) {
  requireProfileScope(profile, "teacher", "load batches");
  await requireCurrentUser(profile.uid);
  const snapshots = await getDocs(query(
    collection(db, batchesCollection),
    where("assignedTeacherUid", "==", profile.uid)
  ));
  const batches = snapshots.docs.map(batchFromDoc);
  const membersByBatch = await Promise.all(batches.map((batch) => getBatchMembers(batch.id)));
  return batches.map((batch, index) => {
    const members = membersByBatch[index];
    return {
      ...batch,
      currentAcademicYear: currentAcademicYear(batch),
      eligibleForGraduation: isBatchGraduationEligible(batch),
      studentCount: members.filter((item) => item.role === "student").length,
      alumniCount: members.filter((item) => item.role === "alumni").length,
      memberCount: members.length
    };
  }).sort((a, b) => Number(b.admissionYear || 0) - Number(a.admissionYear || 0));
}

export async function listTeacherCurrentBatches(profile) {
  return (await listTeacherBatches(profile)).filter((batch) => batch.status === "active");
}

export async function listTeacherPreviousBatches(profile) {
  return (await listTeacherBatches(profile)).filter((batch) => ["graduated", "archived"].includes(batch.status));
}

export async function createTeacherBatch(profile, values) {
  requireProfileScope(profile, "teacher", "create a batch");
  await requireCurrentUser(profile.uid);
  const batchLabel = String(values?.batchLabel || "").trim();
  const years = academicYears(batchLabel);
  if (!years || !isAcademicYear(batchLabel)) throw new Error("Batch must be a three-year range like 2023-2026.");
  const courseName = String(values?.courseName || profile.department).trim().replace(/\s+/g, " ").slice(0, 120);
  if (!courseName) throw new Error("Enter a course name.");
  const batchId = batchDocumentId(profile, batchLabel);
  const batchRef = doc(db, batchesCollection, batchId);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(batchRef)).exists()) throw new Error("This department batch already exists.");
    transaction.set(batchRef, {
      batchId,
      department: profile.department,
      departmentKey: profile.departmentKey,
      courseName,
      admissionYear: years.admissionYear,
      graduationYear: years.graduationYear,
      batchLabel: years.batchLabel,
      status: "active",
      assignedTeacherUid: profile.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  return batchId;
}

export async function listAssignableStudents(profile, batchId) {
  const batch = await requireAssignedBatch(profile, batchId, { activeOnly: true });
  const results = await Promise.allSettled([
    runFirestoreOperation("list unassigned students by department key", firestoreContext(profile, {
      collection: profileCollection,
      batchId,
      departmentKey: batch.departmentKey,
      year: batch.batchLabel
    }), () => getDocs(query(collection(db, profileCollection), where("role", "==", "student"), where("departmentKey", "==", batch.departmentKey), where("year", "==", batch.batchLabel), where("batchId", "==", "")))),
    runFirestoreOperation("list unassigned students by department", firestoreContext(profile, {
      collection: profileCollection,
      batchId,
      departmentKey: batch.departmentKey,
      year: batch.batchLabel
    }), () => getDocs(query(collection(db, profileCollection), where("role", "==", "student"), where("department", "==", batch.department), where("year", "==", batch.batchLabel), where("batchId", "==", ""))))
  ]);
  const snapshots = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!snapshots.length) throw results[0].reason;
  return uniqueById(snapshots.flatMap((snapshot) => snapshot.docs.map(profileFromDoc)))
    .filter((student) => !student.batchId)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function assignStudentToBatch(profile, studentUid, batchId) {
  const batch = await requireAssignedBatch(profile, batchId, { activeOnly: true });
  const student = await getProfile(studentUid);
  if (!student || student.role !== "student") throw new Error("Active student not found.");
  if (student.batchId) throw new Error("This student is already assigned to a batch.");
  if (student.departmentKey !== batch.departmentKey || student.year !== batch.batchLabel) {
    throw new Error("Student department and academic year must exactly match the selected batch.");
  }
  await updateDoc(doc(db, profileCollection, studentUid), {
    departmentKey: batch.departmentKey,
    batchId: batch.id,
    batch: batch.batchLabel,
    admissionYear: batch.admissionYear,
    graduationYear: batch.graduationYear,
    studentStatus: "active",
    updatedAt: serverTimestamp()
  });
}

export async function getTeacherBatchStudents(profile, batchId) {
  const batch = await requireAssignedBatch(profile, batchId);
  const members = await getBatchMembers(batchId);
  return {
    batch: {
      ...batch,
      currentAcademicYear: currentAcademicYear(batch),
      eligibleForGraduation: isBatchGraduationEligible(batch)
    },
    students: members.filter((item) => item.role === "student")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    alumni: members.filter((item) => item.role === "alumni")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
  };
}

function assertStudentEligibleForConversion(student, batch) {
  if (!student) throw new Error("Student not found.");
  if (student.role === "alumni") throw new Error("This account has already been converted to Alumni.");
  if (student.role !== "student") throw new Error("Only an active Student account can be converted.");
  if (student.batchId !== batch.id) throw new Error("Student is not assigned to this batch.");
  if (student.departmentKey !== batch.departmentKey) throw new Error("Student department does not match this batch.");
  if (Number(student.graduationYear) !== Number(batch.graduationYear)) {
    throw new Error("Student graduation year does not match this batch.");
  }
  if (!isBatchGraduationEligible(batch)) throw new Error("This batch is not yet eligible for graduation.");
}

function queueAlumniConversion(batchWrite, teacher, batch, student) {
  const profileRef = doc(db, profileCollection, student.uid);
  const auditId = conversionDocumentId(batch.id, student.uid);
  batchWrite.update(profileRef, {
    role: "alumni",
    studentStatus: "graduated",
    alumniStatus: "active",
    graduationYear: batch.graduationYear,
    batchId: batch.id,
    batch: batch.batchLabel,
    graduatedAt: serverTimestamp(),
    convertedBy: teacher.uid,
    careerStatus: "not_updated",
    updatedAt: serverTimestamp()
  });
  batchWrite.set(doc(db, alumniConversionsCollection, auditId), {
    studentUid: student.uid,
    batchId: batch.id,
    previousRole: "student",
    newRole: "alumni",
    graduationYear: batch.graduationYear,
    convertedBy: teacher.uid,
    convertedAt: serverTimestamp()
  });
}

export async function convertStudentToAlumni(profile, studentUid, batchId) {
  const batch = await requireAssignedBatch(profile, batchId, { activeOnly: true });
  const student = await getProfile(studentUid);
  assertStudentEligibleForConversion(student, batch);
  const batchWrite = writeBatch(db);
  queueAlumniConversion(batchWrite, profile, batch, student);
  await batchWrite.commit();
}

export async function graduateBatch(profile, batchId) {
  const batch = await requireAssignedBatch(profile, batchId, { activeOnly: true });
  if (!isBatchGraduationEligible(batch)) throw new Error("This batch is not yet in its final graduation year.");
  const members = await getBatchMembers(batchId);
  const students = members.filter((item) => item.role === "student");
  if (!students.length) throw new Error("No eligible students were found in this batch.");
  students.forEach((student) => assertStudentEligibleForConversion(student, batch));
  if (students.length > 200) {
    throw new Error("This batch is too large for a safe client-side atomic conversion. Use the trusted graduation backend described in the setup guide.");
  }

  const batchWrite = writeBatch(db);
  students.forEach((student) => queueAlumniConversion(batchWrite, profile, batch, student));
  batchWrite.update(doc(db, batchesCollection, batchId), {
    status: "graduated",
    graduatedAt: serverTimestamp(),
    graduatedBy: profile.uid,
    updatedAt: serverTimestamp()
  });
  batchWrite.set(doc(db, batchGraduationsCollection, batchId), {
    batchId,
    studentCount: students.length,
    graduationYear: batch.graduationYear,
    graduatedBy: profile.uid,
    graduatedAt: serverTimestamp()
  });
  await batchWrite.commit();
  return students.length;
}

export async function listTeacherAlumni(profile, filters = {}) {
  const batches = await listTeacherBatches(profile);
  const alumni = (await Promise.all(batches.map(async (batch) => {
    const members = await getBatchMembers(batch.id);
    return members.filter((item) => item.role === "alumni");
  }))).flat();
  const search = normalizeName(filters.search || "");
  return uniqueById(alumni)
    .filter((item) => !search || normalizeName(item.name).includes(search) || String(item.regNo || "").toUpperCase().includes(search))
    .filter((item) => !filters.batchId || item.batchId === filters.batchId)
    .filter((item) => !filters.graduationYear || String(item.graduationYear || "") === String(filters.graduationYear))
    .filter((item) => !filters.careerStatus || (item.careerStatus || "not_updated") === filters.careerStatus)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function getTeacherAlumniDetail(profile, alumniUid) {
  requireProfileScope(profile, "teacher", "view Alumni details");
  await requireCurrentUser(profile.uid);
  const alumni = await getProfile(alumniUid);
  if (!alumni || alumni.role !== "alumni") throw new Error("Alumni profile not found.");
  await requireAssignedBatch(profile, alumni.batchId);
  return alumni;
}

export async function getAlumniDashboardSummary(profile) {
  requireProfileScope(profile, "alumni", "load the Alumni dashboard");
  await requireCurrentUser(profile.uid);
  const documents = await listStudentDocuments(profile);
  return { documentCount: documents.length, careerStatus: profile.careerStatus || "not_updated" };
}

const careerStatuses = ["employed", "higher_studies", "entrepreneur", "seeking_opportunity", "other"];

function cleanCareerProfile(status, values = {}) {
  const clean = (key, max = 160) => String(values[key] || "").trim().replace(/\s+/g, " ").slice(0, max);
  const year = (key) => {
    const value = Number(values[key]);
    return Number.isInteger(value) && value >= 1950 && value <= 2100 ? value : null;
  };
  const profiles = {
    employed: { company: clean("company", 100), jobTitle: clean("jobTitle", 100), location: clean("location", 100), joiningYear: year("joiningYear") },
    higher_studies: { institution: clean("institution", 120), course: clean("course", 120), location: clean("location", 100), joiningYear: year("joiningYear") },
    entrepreneur: { businessName: clean("businessName", 120), role: clean("role", 100), location: clean("location", 100), startedYear: year("startedYear") },
    seeking_opportunity: { areaOfInterest: clean("areaOfInterest") },
    other: { description: clean("description", 500) }
  };
  const result = profiles[status];
  if (!result || Object.values(result).some((value) => value === "" || value === null)) {
    throw new Error("Complete all career fields for the selected status.");
  }
  return result;
}

export async function updateAlumniCareerProfile(profile, status, values) {
  requireProfileScope(profile, "alumni", "update a career profile");
  await requireCurrentUser(profile.uid);
  if (!careerStatuses.includes(status)) throw new Error("Select a career status.");
  await updateDoc(doc(db, profileCollection, profile.uid), {
    careerStatus: status,
    careerProfile: cleanCareerProfile(status, values),
    updatedAt: serverTimestamp()
  });
  return getProfile(profile.uid);
}

export async function updateAlumniContactProfile(profile, values) {
  requireProfileScope(profile, "alumni", "update contact links");
  await requireCurrentUser(profile.uid);
  const personalEmail = String(values?.personalEmail || "").trim().toLowerCase();
  const linkedin = String(values?.linkedin || "").trim();
  if (personalEmail.length > 160) throw new Error("Personal email is too long.");
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) throw new Error("Enter a valid personal email.");
  if (linkedin.length > 300) throw new Error("LinkedIn URL is too long.");
  if (linkedin) {
    let parsed;
    try { parsed = new URL(linkedin); } catch (_error) { throw new Error("Enter a valid LinkedIn URL."); }
    if (parsed.protocol !== "https:" || !/(^|\.)linkedin\.com$/i.test(parsed.hostname)) throw new Error("Use an HTTPS linkedin.com profile URL.");
  }
  await updateDoc(doc(db, profileCollection, profile.uid), {
    personalEmail,
    linkedin,
    updatedAt: serverTimestamp()
  });
  return getProfile(profile.uid);
}

export async function listAlumniAchievements(profile) {
  requireProfileScope(profile, "alumni", "load achievements");
  await requireCurrentUser(profile.uid);
  const snapshots = await getDocs(query(collection(db, achievementsCollection), where("ownerUid", "==", profile.uid)));
  return snapshots.docs.map((item) => ({ id: item.id, ...item.data(), created_at: timestampIso(item.data().createdAt) }))
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
}

export async function addAlumniAchievement(profile, values) {
  requireProfileScope(profile, "alumni", "add achievements");
  await requireCurrentUser(profile.uid);
  const types = ["Certification", "Award", "Higher Studies", "Professional Achievement", "Other"];
  const title = String(values?.title || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const description = String(values?.description || "").trim().replace(/\s+/g, " ").slice(0, 500);
  const type = String(values?.type || "");
  const year = Number(values?.year);
  if (!title) throw new Error("Enter an achievement title.");
  if (!types.includes(type)) throw new Error("Select a valid achievement type.");
  if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new Error("Enter a valid achievement year.");
  const id = `${profile.uid}_${nowId()}`;
  await setDoc(doc(db, achievementsCollection, id), { ownerUid: profile.uid, title, type, description, year, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function deleteAlumniAchievement(profile, achievementId) {
  requireProfileScope(profile, "alumni", "remove achievements");
  await requireCurrentUser(profile.uid);
  const achievementRef = doc(db, achievementsCollection, achievementId);
  const snapshot = await getDoc(achievementRef);
  if (!snapshot.exists() || snapshot.data().ownerUid !== profile.uid) throw new Error("Achievement not found.");
  await deleteDoc(achievementRef);
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
  const batches = await listTeacherBatches(profile);
  const memberGroups = await Promise.all(batches.map((batch) => getBatchMembers(batch.id)));
  return uniqueById(memberGroups.flat().filter((item) => item.role === "student"))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function getTeacherDashboardSummary(profile) {
  requireProfileScope(profile, "teacher", "load dashboard summary");
  const [students, documents, customTitles, batches] = await Promise.all([
    listTeacherStudentProfiles(profile),
    listTeacherAcademicDocuments(profile),
    listAcademicTitles(profile),
    listTeacherBatches(profile)
  ]);
  const titleCount = new Set([
    ...DEFAULT_ACADEMIC_TITLES,
    ...customTitles.map((item) => item.title)
  ]).size;
  return {
    studentCount: students.length,
    academicCount: documents.length,
    titleCount,
    currentBatchCount: batches.filter((batch) => batch.status === "active").length,
    previousBatchCount: batches.filter((batch) => ["graduated", "archived"].includes(batch.status)).length,
    alumniCount: batches.reduce((count, batch) => count + batch.alumniCount, 0)
  };
}

export async function getTeacherStudentDetail(profile, studentUid) {
  requireProfileScope(profile, "teacher", "load student details");
  const student = await getProfile(studentUid);
  if (!student || student.role !== "student") throw new Error("Student not found.");
  const legacyScope = student.departmentKey === profile.departmentKey && student.year === profile.year;
  const assignedScope = student.batchId
    ? (await requireAssignedBatch(profile, student.batchId).catch(() => null)) !== null
    : false;
  if (!legacyScope && !assignedScope) {
    throw new Error("You can view only students in your authorized scope or assigned batches.");
  }
  const documentResults = await Promise.allSettled([
    getDocs(query(collection(db, documentsCollection), where("category", "==", "academic"), where("departmentKey", "==", student.departmentKey), where("year", "==", student.year))),
    getDocs(query(collection(db, documentsCollection), where("category", "==", "academic"), where("department", "==", student.department), where("year", "==", student.year)))
  ]);
  const documentSnapshots = documentResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!documentSnapshots.length) throw documentResults[0].reason;
  const documents = uniqueById(documentSnapshots.flatMap((snapshot) => snapshot.docs.map(documentFromDoc)))
    .filter((item) => item.ownerId === studentUid)
    .sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
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
  const legacyScope = matchingDepartment && data.year === profile.year;
  const inferredBatchId = data.batchId || (data.departmentKey && data.year ? `${data.departmentKey}_${data.year}` : "");
  const assignedScope = inferredBatchId
    ? (await requireAssignedBatch(profile, inferredBatchId).catch(() => null)) !== null
    : false;
  if (data.category !== "academic" || (!legacyScope && !assignedScope)) {
    throw new Error("You can delete only academic documents from an authorized batch.");
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
