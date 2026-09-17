import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const batchId = "BSCCS_2023-2026";
const student = (uid = "student") => ({ uid, role: "student", name: "TEST STUDENT", email: `${uid}@example.com`, regNo: "23BSC001", mobile: "9876543210", department: "BSC CS", departmentKey: "BSCCS", year: "2023-2026", batch: "2023-2026", batchId: "", admissionYear: 2023, graduationYear: 2026, studentStatus: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const teacher = { uid: "teacher", role: "teacher", name: "TEST TEACHER", email: "teacher@example.com", mobile: "9876543211", department: "BSC CS", departmentKey: "BSCCS", teachingBatch: "2023-2026", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

test("Firestore authorization and lifecycle", { skip: !enabled }, async (t) => {
  const env = await initializeTestEnvironment({ projectId: "demo-digital-locker", firestore: { rules: await readFile(new URL("../firebase/firestore.rules", import.meta.url), "utf8") } });
  const dbFor = (uid, verified = true) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();
  const staffDb = dbFor("teacher");
  const studentDb = dbFor("student");
  const seed = async (entries) => env.withSecurityRulesDisabled(async (ctx) => {
    for (const [path, value] of entries) await setDoc(doc(ctx.firestore(), path), value);
  });
  try {
    await env.clearFirestore();
    await seed([["profiles/teacher", teacher], ["profiles/student", student()], ["profiles/outsider", { ...teacher, uid: "outsider", email: "outsider@example.com", department: "BCOM", departmentKey: "BCOM" }]]);

    await t.test("teacher title creation uses teachingBatch, without a legacy year field", async () => {
      await assertSucceeds(setDoc(doc(staffDb, "academicTitles/BSCCS_2023-2026_TC"), { title: "TC", department: "BSC CS", departmentKey: "BSCCS", year: "2023-2026", createdBy: "teacher", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
      await assertSucceeds(getDocs(query(collection(studentDb, "academicTitles"), where("departmentKey", "==", "BSCCS"), where("year", "==", "2023-2026"))));
    });
    await t.test("approved teachers can read their scope and other departments cannot read student profiles", async () => {
      await assertSucceeds(getDoc(doc(dbFor("teacher", false), "profiles/student")));
      await assertFails(getDoc(doc(dbFor("outsider"), "profiles/student")));
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "profiles/student")));
    });
    await t.test("student self-promotion and identity changes are denied", async () => {
      await assertFails(updateDoc(doc(studentDb, "profiles/student"), { role: "teacher" }));
      await assertFails(updateDoc(doc(studentDb, "profiles/student"), { role: "alumni" }));
      await assertFails(updateDoc(doc(studentDb, "profiles/student"), { regNo: "23BSC999" }));
    });
    await t.test("registration requires atomic mobile and register-number reservations", async () => {
      const db = dbFor("newstudent");
      const data = { ...student("newstudent"), regNo: "23BSC002", mobile: "9876543212" };
      await assertFails(setDoc(doc(db, "profiles/newstudent"), data));
      const registration = writeBatch(db);
      registration.set(doc(db, "profiles/newstudent"), data);
      registration.set(doc(db, "uniqueMobileNumbers", data.mobile), { uid: data.uid, role: "student", createdAt: serverTimestamp() });
      registration.set(doc(db, "uniqueRegisterNumbers", data.regNo), { uid: data.uid, createdAt: serverTimestamp() });
      await assertSucceeds(registration.commit());
      const release = writeBatch(db);
      release.delete(doc(db, "uniqueMobileNumbers", data.mobile));
      await assertFails(release.commit());
    });
    await t.test("teacher registration requires an administrator approval matching both scope fields", async () => {
      const db = dbFor("newteacher", false);
      const data = { ...teacher, uid: "newteacher", email: "newteacher@example.com", mobile: "9876543213" };
      const register = () => {
        const write = writeBatch(db);
        write.set(doc(db, "profiles/newteacher"), data);
        write.set(doc(db, "uniqueMobileNumbers", data.mobile), { uid: data.uid, role: "teacher", createdAt: serverTimestamp() });
        write.set(doc(db, "uniqueTeacherScopes", batchId), { uid: data.uid, department: data.department, departmentKey: data.departmentKey, teachingBatch: data.teachingBatch, createdAt: serverTimestamp() });
        return write.commit();
      };
      await assertFails(register());
      await assertFails(setDoc(doc(db, "approvedTeachers", data.email), { enabled: true, departmentKey: "BSCCS", teachingBatch: "2023-2026" }));
      await seed([[`approvedTeachers/${data.email}`, { enabled: true, departmentKey: "BCOM", teachingBatch: "2023-2026" }]]);
      await assertFails(register());
      await seed([[`approvedTeachers/${data.email}`, { enabled: true, departmentKey: "BSCCS", teachingBatch: "2023-2026" }]]);
      await assertSucceeds(register());
    });
    await t.test("teacher can create only their approved batch and assign a matching student", async () => {
      await assertSucceeds(getDoc(doc(staffDb, "batches", batchId)));
      const batch = { batchId, department: "BSC CS", departmentKey: "BSCCS", courseName: "Computer Science", admissionYear: 2023, graduationYear: 2026, batchLabel: "2023-2026", status: "active", assignedTeacherUid: "teacher", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      await assertSucceeds(setDoc(doc(staffDb, "batches", batchId), batch));
      await assertFails(setDoc(doc(staffDb, "batches/BSCCS_2024-2027"), { ...batch, batchId: "BSCCS_2024-2027", batchLabel: "2024-2027", admissionYear: 2024, graduationYear: 2027 }));
      await assertSucceeds(updateDoc(doc(staffDb, "profiles/student"), { batchId, updatedAt: serverTimestamp() }));
    });
    await t.test("conversion needs an audit and audit needs the matching profile transition", async () => {
      const conversion = { studentUid: "student", batchId, previousRole: "student", newRole: "alumni", graduationYear: 2026, convertedBy: "teacher", convertedAt: serverTimestamp() };
      const update = { role: "alumni", studentStatus: "graduated", alumniStatus: "active", graduatedAt: serverTimestamp(), convertedBy: "teacher", careerStatus: "not_updated", updatedAt: serverTimestamp() };
      await assertFails(updateDoc(doc(staffDb, "profiles/student"), update));
      await assertFails(setDoc(doc(staffDb, "alumniConversions", `${batchId}_student`), conversion));
      const write = writeBatch(staffDb);
      write.update(doc(staffDb, "profiles/student"), update);
      write.set(doc(staffDb, "alumniConversions", `${batchId}_student`), conversion);
      await assertSucceeds(write.commit());
      assert.equal((await getDoc(doc(studentDb, "profiles/student"))).data().role, "alumni");
    });
    await t.test("alumni can update career and contact links but cannot restore student role", async () => {
      await assertSucceeds(updateDoc(doc(studentDb, "profiles/student"), { careerStatus: "employed", careerProfile: { company: "Example", jobTitle: "Developer", location: "Coimbatore", joiningYear: 2026 }, updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(studentDb, "profiles/student"), { role: "student" }));
      await assertFails(updateDoc(doc(studentDb, "profiles/student"), { personalEmail: "valid@example.com", linkedin: "javascript:alert(1)", updatedAt: serverTimestamp() }));
    });
    await t.test("teachers can read academic documents only, including after graduation", async () => {
      for (const category of ["academic", "personal", "online"]) {
        await seed([[`documents/student_${category}_test`, { ownerId: "student", category, department: "BSC CS", departmentKey: "BSCCS", year: "2023-2026", batchId }]]);
        const ref = doc(staffDb, `documents/student_${category}_test`);
        await (category === "academic" ? assertSucceeds(getDoc(ref)) : assertFails(getDoc(ref)));
        await assertSucceeds(getDoc(doc(studentDb, `documents/student_${category}_test`)));
      }
    });
    await t.test("recovery questions and verifiers are no longer public", async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, "passwordRecovery/student@example.com")));
      await assertFails(getDoc(doc(db, "passwordRecovery/student@example.com/verifiers/test")));
    });
  } finally {
    await env.cleanup();
  }
});
