import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Alumni portal has login protection and no registration path", async () => {
  const [index, login, dashboard, auth, alumni] = await Promise.all([
    read("index.html"), read("alumni-login.html"), read("alumni-dashboard.html"), read("js/auth.js"), read("js/alumni.js")
  ]);
  assert.match(index, /ALUMNI LOGIN/);
  assert.match(login, /id="alumniLoginForm"/);
  assert.doesNotMatch(login, /Register as (?:an )?Alumni/i);
  assert.match(dashboard, /ALUMNI\s*<\/b><small>DIGITAL LOCKER/);
  assert.match(auth, /alumni:\s*"\.\/alumni-dashboard\.html"/);
  assert.match(alumni, /protectPage\("alumni"/);
});

test("wrong-portal messages preserve successful authentication semantics", async () => {
  const auth = await read("js/auth.js");
  assert.match(auth, /Your student account has been converted to an Alumni account\. Please use the Alumni Login to continue\./);
  assert.match(auth, /This account is still registered as a Student\. Please use the Student Login\./);
  assert.match(auth, /This account belongs to the Teacher Portal\. Please use Teacher Login\./);
  assert.match(auth, /await logout\(\);[\s\S]*app\/wrong-portal/);
});

test("batch conversion is atomic, audited, and does not mutate document ownership", async () => {
  const service = await read("js/firebase-service.js");
  const graduation = service.slice(service.indexOf("export async function graduateBatch"), service.indexOf("export async function listTeacherAlumni"));
  const conversion = service.slice(service.indexOf("function queueAlumniConversion"), service.indexOf("export async function convertStudentToAlumni"));
  assert.match(graduation, /const batchWrite = writeBatch\(db\)/);
  assert.match(graduation, /batchWrite\.commit\(\)/);
  assert.match(graduation, /status:\s*"graduated"/);
  assert.match(conversion, /role:\s*"alumni"/);
  assert.match(conversion, /alumniConversionsCollection/);
  assert.doesNotMatch(conversion, /deleteDoc|deleteUser|ownerId|documentsCollection/);
});

test("Firestore rules enforce assigned-batch role conversion and deny open access", async () => {
  const rules = await read("firebase/firestore.rules");
  assert.match(rules, /function teacherAssignedToBatch/);
  assert.match(rules, /validTeacherAlumniConversion/);
  assert.match(rules, /resource\.data\.role == "student"/);
  assert.match(rules, /request\.resource\.data\.role == "alumni"/);
  assert.match(rules, /timestamp\.date\(graduationYear, 1, 1\)/);
  assert.match(rules, /allow delete: if false;/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|create|update|delete)(?:\s*,\s*\w+)*:\s*if\s+true/);
});

test("batch assignment uses an explicit unassigned marker", async () => {
  const [service, rules] = await Promise.all([read("js/firebase-service.js"), read("firebase/firestore.rules")]);
  const assignment = service.slice(service.indexOf("export async function listAssignableStudents"), service.indexOf("export async function assignStudentToBatch"));
  assert.match(service, /batchId:\s*""/);
  assert.match(assignment, /where\("batchId",\s*"==",\s*""\)/);
  assert.match(rules, /request\.resource\.data\.batchId == ""/);
});

test("teacher and Alumni pages expose required workflow sections", async () => {
  const [teacher, alumni] = await Promise.all([read("teacher-dashboard.html"), read("alumni-dashboard.html")]);
  for (const text of ["BATCH MANAGEMENT", "Previous Batches", "REMOVE BATCH STUDENT", "ALUMNI DETAILS", "REMOVE ACCOUNT"]) {
    assert.ok(teacher.includes(text), `teacher dashboard missing ${text}`);
  }
  for (const text of ["MY DOCUMENTS", "CAREER PROFILE", "ACHIEVEMENTS", "MY PROFILE", "LOGOUT"]) {
    assert.ok(alumni.includes(text), `Alumni dashboard missing ${text}`);
  }
});
