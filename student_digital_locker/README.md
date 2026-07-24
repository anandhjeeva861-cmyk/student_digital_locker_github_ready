# Student Digital Locker

A DigiLocker-inspired certificate management website for students and teachers.

Students can store online, personal, and academic certificates. Teachers can access only academic certificates of students from the same department and same year.

## Features

- Student and teacher email/password login with Firebase Authentication
- Student profile storage in Cloud Firestore
- Teacher profile storage in Cloud Firestore
- Certificate metadata in Cloud Firestore
- Certificate files and profile photos in Firebase Storage
- Student-only access for online and personal certificates
- Same department/year teacher access for academic certificates only
- Dark mode preference saved in browser localStorage

## Tech Stack

- HTML
- CSS
- JavaScript browser modules
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Flask templates for the current local app shell

## Project Tree

```text
student_digital_locker/
├── app.py
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── firestore.rules
├── storage.rules
├── requirements.txt
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── firebase-config.example.js
│       ├── auth.js
│       ├── student.js
│       ├── teacher.js
│       ├── validation.js
│       ├── darkmode.js
│       └── app.js
├── templates/
│   ├── base.html
│   ├── login.html
│   ├── student/
│   └── teacher/
├── uploads/
└── docs/
    ├── FIREBASE_SETUP.md
    ├── SECURITY_RULES.md
    └── GITHUB_PUSH_STEPS.md
```

For a fully static HTML version, the equivalent frontend structure is:

```text
student-digital-locker/
├── index.html
├── student-login.html
├── teacher-login.html
├── student-dashboard.html
├── teacher-dashboard.html
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.example.js
│   ├── auth.js
│   ├── student.js
│   ├── teacher.js
│   ├── validation.js
│   └── darkmode.js
├── .gitignore
├── .env.example
├── README.md
└── docs/
    ├── FIREBASE_SETUP.md
    ├── SECURITY_RULES.md
    └── GITHUB_PUSH_STEPS.md
```

## Firebase Config Setup

The real Firebase config file is intentionally ignored by GitHub.

Copy the example file:

```bash
cp static/js/firebase-config.example.js static/js/firebase-config.js
```

Windows:

```bat
copy static\js\firebase-config.example.js static\js\firebase-config.js
```

Then open:

```text
static/js/firebase-config.js
```

Paste your Firebase Console values into:

```js
const firebaseConfig = {
  apiKey: "PASTE_YOUR_FIREBASE_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_FIREBASE_APP_ID"
};
```

Do not commit `static/js/firebase-config.js`.

### GitHub-Safe Firebase Config Checklist

This project uses Flask templates and `static/`, so it is not Vite. Do not use `.env` or `import.meta.env` for browser Firebase config.

Use this workflow:

```bash
cp static/js/firebase-config.example.js static/js/firebase-config.js
```

Windows:

```bat
copy static\js\firebase-config.example.js static\js\firebase-config.js
```

Paste your real Firebase Console values only inside:

```text
static/js/firebase-config.js
```

Never commit `static/js/firebase-config.js`. Before pushing, run:

```bash
git status
```

Confirm `static/js/firebase-config.js` is not listed as a file to commit. Push only the public sample:

```text
static/js/firebase-config.example.js
```

More details are in [`docs/FIREBASE_CONFIG_SAFETY.md`](docs/FIREBASE_CONFIG_SAFETY.md).

## Environment File

`.env.example` contains placeholder Firebase variables for reference only.

Normal Flask/static browser JavaScript cannot directly read `.env` files. Use `static/js/firebase-config.js` for local Firebase browser config.

Firebase web config is not a private password, but real project config should still not be committed in open-source repositories.

## Firebase Setup

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

Short version:

1. Create Firebase project.
2. Add Web App.
3. Enable Email/Password Authentication.
4. Create Firestore Database.
5. Enable Firebase Storage.
6. Copy `static/js/firebase-config.example.js` to `static/js/firebase-config.js`.
7. Paste Firebase Console config values.
8. Publish `firestore.rules`.
9. Publish `storage.rules`.
10. Enable App Check before real production use.

## Local Run

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## GitHub Push

See [docs/GITHUB_PUSH_STEPS.md](docs/GITHUB_PUSH_STEPS.md).

Commands:

```bash
git init
git add .
git commit -m "Initial commit - Student Digital Locker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-digital-locker.git
git push -u origin main
```

## Never Commit

- `.env`
- `.env.local`
- `static/js/firebase-config.js`
- real Firebase project config values
- uploaded certificate files
- uploaded profile photos
- local database files like `locker.db`
- `node_modules/`

## Security Notes

Firestore Rules, Storage Rules, Firebase Authentication, and App Check are mandatory for real security.

The frontend can validate forms and hide buttons, but frontend code is not a security boundary. Firebase rules must enforce the actual access rules.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
