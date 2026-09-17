import { test, expect } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const projectId = "demo-digital-locker";
const password = " TestPassword123! ";
let env;
const errors = [];
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");

test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Run browser tests using npm run test:emulator. Only local demo Firebase data may be used.");
  }
  env = await initializeTestEnvironment({ projectId });
  await env.clearFirestore();
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
});
test.afterAll(async () => env?.cleanup());
test.beforeEach(async ({ context, page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/js/firebase-config.js*", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `export const firebaseConfig = ${JSON.stringify({ apiKey: "demo-test-key", authDomain: `${projectId}.firebaseapp.com`, projectId, messagingSenderId: "123456789", appId: "1:123456789:web:testing" })}; export const firebaseEmulators = true;`
  }));
});

async function navigate(page, view) {
  const menu = page.locator("[data-menu-toggle]");
  if (await menu.isVisible()) await menu.click();
  await page.locator(`.sidebar [data-open-view="${view}"]`).click();
  await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
}
async function login(page, role, email) {
  await page.goto(`/${role}-login.html`);
  await page.locator("[name=email]").fill(email);
  await page.locator("[name=password]").fill(password);
  await page.locator("button[type=submit]").first().click();
}
async function service(page, method, ...args) {
  return page.evaluate(async ({ method, args }) => {
    const api = await import("/js/firebase-service.js");
    const profile = await api.getCurrentProfile();
    return api[method](profile, ...args);
  }, { method, args });
}

test("student registration, teacher approval, graduation and alumni account lifecycle", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/student-register.html");
  for (const [name, value] of Object.entries({ name: "TEST STUDENT", regNo: "23BSC003", email: "student@college.test", year: "2023-2026", mobile: "9876500001", password })) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator("[name=department]").selectOption("BSC CS");
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/student-dashboard.html/);
  await expect(page.locator("#welcomeName")).toHaveText("TEST STUDENT");
  const studentUid = await page.evaluate(async () => (await import("/js/firebase-service.js")).getCurrentProfile().then((p) => p.uid));

  await page.evaluate(async (bytes) => {
    const api = await import("/js/firebase-service.js");
    const profile = await api.getCurrentProfile();
    for (const category of ["academic", "personal", "online"]) {
      await api.uploadStudentDocument(profile, category, category === "academic" ? "AADHAR CARD" : "CERTIFICATE", new File([new Uint8Array(bytes)], "record.pdf", { type: "application/pdf" }));
    }
  }, [...pdf]);
  await expect.poll(() => service(page, "listStudentDocuments").then((docs) => docs.length)).toBe(3);
  await page.evaluate(async () => (await import("/js/firebase-service.js")).logout());

  await page.goto("/teacher-register.html");
  for (const [name, value] of Object.entries({ name: "TEST TEACHER", email: "teacher@college.test", teachingBatch: "2023-2026", mobile: "9876500002", password })) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator("[name=department]").selectOption("BSC CS");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("alert")).toContainText("not approved");
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "approvedTeachers/teacher@college.test"), { enabled: true, departmentKey: "BSCCS", teachingBatch: "2023-2026" }));
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("status")).toContainText("Verify your email");
  await login(page, "teacher", "teacher@college.test");
  await expect(page.getByRole("alert")).toContainText("Verify your teacher email");
  const oob = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`).then((r) => r.json());
  const verification = oob.oobCodes.filter((code) => code.email === "teacher@college.test" && code.requestType === "VERIFY_EMAIL").at(-1);
  expect(verification).toBeTruthy();
  const verified = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-test-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oobCode: verification.oobCode }) });
  expect(verified.ok).toBeTruthy();
  await login(page, "teacher", "teacher@college.test");
  await expect(page).toHaveURL(/teacher-dashboard.html/);
  await expect(page.locator("#studentCount")).toHaveText("1");

  await navigate(page, "add-title");
  await page.locator("#academicRequirementTitle").fill("TRANSFER CERTIFICATE");
  await page.locator("#addTitleForm button").click();
  await expect(page.locator("#customTitleRows")).toContainText("TRANSFER CERTIFICATE");
  await navigate(page, "status");
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#downloadStatusReportButton").click();
  expect((await downloadEvent).suggestedFilename()).toMatch(/\.xlsx$/);

  await navigate(page, "batches");
  await page.locator("#createBatchForm button").click();
  await expect(page.locator("#currentBatchGrid")).toContainText("Computer").catch(async () => expect(page.locator("#currentBatchGrid")).toContainText("BSC CS"));
  await page.locator("#assignmentBatch").selectOption("BSCCS_2023-2026");
  await expect(page.locator("#assignmentStudent option")).toHaveCount(2);
  await page.locator("#assignmentStudent").selectOption(studentUid);
  await page.locator("#assignBatchForm button").click();
  await expect(page.locator("#currentBatchGrid")).toContainText("Students: 1");

  // Add enough matching students to exercise multiple rule-budget-sized conversion groups.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const original = (await getDoc(doc(ctx.firestore(), "profiles", studentUid))).data();
    for (let i = 0; i < 11; i++) await setDoc(doc(ctx.firestore(), "profiles", `cohort-${i}`), { ...original, uid: `cohort-${i}`, name: `COHORT STUDENT`, regNo: `23BSC${String(i + 100).padStart(3, "0")}`, createdAt: serverTimestamp() });
  });
  await page.locator("[data-graduate-batch]").click();
  await expect(page.locator("#confirmStudentCount")).toHaveText("12");
  await page.locator("#confirmGraduationButton").click();
  await expect(page.locator("#previousBatchGrid")).toContainText("Alumni: 12");
  await expect(page.locator("#studentCount")).toHaveText("0");
  await page.screenshot({ path: "test-results/teacher-batches-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page, "alumni");
  await expect(page.locator("#alumniRows tr")).toHaveCount(12);
  await page.locator("#alumniSearch").fill("TEST STUDENT");
  await page.locator("#alumniSearchForm button").click();
  await expect(page.locator("#alumniRows tr")).toHaveCount(1);
  await page.locator("[data-alumni-id]").click();
  await expect(page.locator("#alumniDetailName")).toHaveText("TEST STUDENT");
  await page.screenshot({ path: "test-results/teacher-alumni-mobile.png", fullPage: true });
  await page.evaluate(async () => (await import("/js/firebase-service.js")).logout());

  await login(page, "student", "student@college.test");
  await expect(page.getByRole("alert")).toContainText("converted to an Alumni");
  await expect(page.locator(".portal-action a")).toHaveAttribute("href", "./alumni-login.html");
  await login(page, "alumni", "student@college.test");
  await expect(page).toHaveURL(/alumni-dashboard.html/);
  await expect(page.locator("#dashboardDocumentCount")).toHaveText("3");
  await navigate(page, "career");
  await page.locator("#careerStatus").selectOption("employed");
  for (const [name, value] of Object.entries({ company: "Example Company", jobTitle: "Software Engineer", employmentLocation: "Coimbatore", joiningYear: "2026" })) await page.locator(`[name=${name}]`).fill(value);
  await page.locator("#careerForm button").click();
  await expect(page.getByRole("status")).toContainText("Career profile updated");
  await navigate(page, "achievements");
  await page.locator("#achievementTitle").fill("Cloud Certification");
  await page.locator("#achievementYear").fill("2026");
  await page.locator("#achievementForm button").click();
  await expect(page.locator("#achievementList")).toContainText("Cloud Certification");
  await navigate(page, "documents");
  await expect(page.locator("#alumniDocumentRows tr")).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page.locator("[data-alumni-download-doc]").first().click();
  expect((await download).suggestedFilename()).toBe("record.pdf");
  await page.screenshot({ path: "test-results/alumni-documents-mobile.png", fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test("public pages, password reset, and local server file boundaries", async ({ page, request }) => {
  for (const path of ["/.env", "/.git/config", "/server/data/locker.db", "/package.json", "/tests/firestore.rules.test.mjs"]) expect((await request.get(path)).status()).toBe(403);
  expect((await request.post("/student-login.html", { data: "password=test" })).status()).toBe(405);
  for (const role of ["student", "teacher", "alumni"]) {
    await page.goto(`/${role}-login.html`);
    await page.getByRole("button", { name: "Forgot Password?" }).click();
    await page.locator("[name=recoveryEmail]").fill("student@college.test");
    await page.locator("[data-recovery-email-form] button").click();
    await expect(page.getByRole("status")).toContainText("password reset link");
    await expect(page.locator("dialog")).not.toBeVisible();
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/student-login.html", "/student-register.html", "/teacher-login.html", "/teacher-register.html", "/alumni-login.html"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator("img").evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
