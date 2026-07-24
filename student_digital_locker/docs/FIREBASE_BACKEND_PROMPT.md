# Firebase Backend Creation Prompt

Use this prompt if you want to convert this Student Digital Locker project from Flask + SQLite to Firebase.

---

I have a frontend project for a “Student Digital Locker” website using HTML, CSS, and JavaScript. Analyze my complete frontend code carefully and create a Firebase backend integration for it.

Project idea:
Students should store certificates digitally. Teachers should only access academic certificates of students who belong to the same department and same year as the teacher. Online certificates and personal certificates must be private to the student only.

Use Firebase as backend:

1. Firebase Authentication for student and teacher email/password login.
2. Cloud Firestore for storing student profiles, teacher profiles, academic document titles, and uploaded document metadata.
3. Firebase Storage for storing uploaded certificate files.
4. Firebase Security Rules must protect student private documents from teacher access.
5. Teachers must only access academic documents of students from the same department and year.
6. Registration should prevent duplicate accounts using email, mobile number, and student register number where applicable.

Student requirements:

- Student login should use email and password.
- Student registration should collect name in uppercase only, register number like `25BSC003`, year like `I`, department like `BSCCS`, mobile number, email, and create password.
- After login, show student dashboard with `WELCOME` and student name.
- Student menu should contain Profile, Online Certificate, Personal Certificate, Academic Certificate, and Logout.
- Profile should show registered details. Only profile photo should be editable.
- Online Certificate and Personal Certificate should allow student to add document title, upload document, save, view, download, and remove.
- Online and personal certificates must be accessible only by the same student.
- Academic Certificate should include these default titles:
  - AADHAR CARD
  - INCOME CERTIFICATE
  - COMMUNITY CERTIFICATE
  - 10TH MARKSHEET
  - 12TH MARKSHEET
  - BANK PASS BOOK
- Academic Certificate should also show extra document titles added by teachers.
- Once a student uploads a file for a selected academic title, that title should no longer appear in the upload select option for that student.
- Academic certificates should be viewable, downloadable, and removable by both the student and eligible teachers.

Teacher requirements:

- Teacher login should use email and password.
- Teacher registration should collect name in uppercase only, department like `BSC CS`, year like `I`, mobile number, email, and create password.
- After login, show teacher dashboard with `WELCOME` and teacher name.
- Teacher menu should contain Profile, Student List, Search Student, Document Submission Status, Add Student Document Title, and Logout.
- Student List should show only students from the same department and same year as the teacher.
- Teacher should be able to view and download eligible students’ academic documents only.
- Search Student should search students by name from the same department and same year.
- Document Submission Status should show each academic document title and split students into uploaded students and not uploaded students.
- Add Student Document Title should save a new academic title in Firestore, and that title should automatically appear in every matching student’s Academic Certificate upload option.

Firestore database design:

```text
users/{uid}
  role: "student" or "teacher"
  name
  email
  mobile
  department
  departmentKey
  year
  regNo only for students
  photoURL
  createdAt

academicTitles/{titleId}
  title
  department
  departmentKey
  year
  createdByTeacherUid
  createdAt
  isDefault

documents/{documentId}
  ownerUid
  ownerName
  ownerRegNo
  department
  departmentKey
  year
  category: "online", "personal", or "academic"
  title
  titleId
  fileName
  fileURL
  storagePath
  uploadedAt
  uploadedByUid
  uploadedByRole
```

Create these JavaScript files:

1. `firebase-config.js`
   - Initialize Firebase app.
   - Export `auth`, `db`, and `storage`.

2. `auth.js`
   - Student registration.
   - Teacher registration.
   - Student login.
   - Teacher login.
   - Logout.
   - Duplicate checking.
   - Auth state checking.

3. `student.js`
   - Load student profile.
   - Update profile photo only.
   - Upload online, personal, and academic certificates.
   - Hide already uploaded academic titles.
   - View, download, and delete own documents.

4. `teacher.js`
   - Load teacher profile.
   - Show same department/year student list.
   - Search student by name.
   - View, download, and delete academic documents only.
   - Show document submission status.
   - Add academic document title.

5. `validation.js`
   - Name uppercase validation.
   - Register number validation like `25BSC003`.
   - Mobile number validation.
   - File validation.

Also provide:

- Firebase setup steps.
- Complete Firebase config file.
- Complete Firestore security rules.
- Complete Firebase Storage security rules.
- Required HTML `<script type="module">` tags.
- Exact explanation of where to paste each code file.
- Do not remove existing UI animation or CSS.
- Keep UI DigiLocker-inspired, professional, and classic.
- Give complete working code, not pseudo code.

---

## Firebase Config Template

Create `static/js/firebase-config.js`:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };
```
