# Firebase Backend Setup

## 1. Firebase Console

1. Create a Firebase project.
2. Add a Web App and copy the Firebase config.
3. Enable Authentication > Sign-in method > Email/Password.
4. Create Cloud Firestore in production mode.
5. Create Firebase Storage.
6. Paste your config into `static/js/firebase-config.js`.
7. Publish `firestore.rules` in Firestore Rules.
8. Publish `storage.rules` in Storage Rules.

## 2. Required Script Tags

`templates/base.html` already loads:

```html
<script src="{{ url_for('static', filename='js/app.js') }}"></script>
<script type="module" src="{{ url_for('static', filename='js/darkmode.js') }}"></script>
<script type="module" src="{{ url_for('static', filename='js/auth.js') }}"></script>
{% block firebase_scripts %}{% endblock %}
```

Student pages load:

```html
{% block firebase_scripts %}
<script type="module" src="{{ url_for('static', filename='js/student.js') }}"></script>
{% endblock %}
```

Teacher pages load:

```html
{% block firebase_scripts %}
<script type="module" src="{{ url_for('static', filename='js/teacher.js') }}"></script>
{% endblock %}
```

## 3. Page to JavaScript Mapping

- `templates/student/login.html`: `auth.js`
- `templates/student/register.html`: `auth.js`
- `templates/student/dashboard.html`: `auth.js`, `student.js`, `darkmode.js`
- `templates/student/profile.html`: `auth.js`, `student.js`, `darkmode.js`
- `templates/student/certificates.html`: `auth.js`, `student.js`, `darkmode.js`
- `templates/teacher/login.html`: `auth.js`
- `templates/teacher/register.html`: `auth.js`
- `templates/teacher/dashboard.html`: `auth.js`, `teacher.js`, `darkmode.js`
- `templates/teacher/profile.html`: `auth.js`, `teacher.js`, `darkmode.js`
- `templates/teacher/students.html`: `auth.js`, `teacher.js`, `darkmode.js`
- `templates/teacher/status.html`: `auth.js`, `teacher.js`, `darkmode.js`
- `templates/teacher/add_title.html`: `auth.js`, `teacher.js`, `darkmode.js`

## 4. IDs Added for Firebase Wiring

- Student auth: `studentLoginForm`, `studentRegisterForm`
- Teacher auth: `teacherLoginForm`, `teacherRegisterForm`
- Layout: `studentWelcomeName`, `teacherWelcomeName`, `themeToggle`, `data-firebase-logout`
- Student dashboard: `onlineCount`, `personalCount`, `academicCount`
- Student profile: `studentPhotoForm`, `studentPhoto`, `studentPhotoPlaceholder`, `studentName`, `studentRegNo`, `studentEmail`, `studentYear`, `studentDepartment`, `studentMobile`
- Student certificates: `certificateUploadForm`, `academicTitleSelect`, `academicUploadEmpty`, `academicTitleList`, `studentDocumentsCount`, `studentDocumentsBody`, `studentDocumentsEmpty`, `data-certificate-category`
- Teacher dashboard/profile: `teacherScope`, `teacherStudentCount`, `teacherAcademicCount`, `teacherTitleCount`, `teacherName`, `teacherEmail`, `teacherDepartment`, `teacherYear`, `teacherMobile`
- Teacher student list/search: `teacherSearchForm`, `teacherStudentsCount`, `teacherStudentsBody`, `teacherStudentsEmpty`, `teacherStudentDetail`, `teacherAcademicDocsBody`
- Teacher student detail: `detailStudentName`, `detailStudentRegNo`, `detailStudentEmail`, `detailStudentDepartment`, `detailStudentYear`, `detailStudentMobile`
- Teacher status/add title: `teacherStatusGrid`, `teacherAddTitleForm`, `customAcademicTitles`

## 5. Firestore Collections

- `users`
- `academicTitles`
- `documents`
- `uniqueMobiles`
- `uniqueRegNos`

`uniqueMobiles` and `uniqueRegNos` are small lock collections used during registration so duplicate mobile numbers and student register numbers cannot be created concurrently.

## 6. Important Flask Note

This project currently uses Flask templates. `app.py` now defaults to Firebase frontend mode with `FIREBASE_FRONTEND=1`, so protected templates render with placeholder server data and Firebase fills the real data in the browser. To use the old SQLite/session demo instead, set `FIREBASE_FRONTEND=0` before running Flask.

For production Firebase-only behavior, deploy the HTML/CSS/JS to Firebase Hosting and use the Firestore/Storage rules as the access boundary.
