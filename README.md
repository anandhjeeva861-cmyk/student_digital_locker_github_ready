# Student Digital Locker

Static GitHub Pages version of the Student Digital Locker website using Firebase Authentication, Cloud Firestore, and Firebase Storage.

Open after deployment:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

## GitHub Pages Structure

```text
student_digital_locker_github_ready/
├── index.html
├── student-login.html
├── teacher-login.html
├── student-register.html
├── teacher-register.html
├── student-dashboard.html
├── teacher-dashboard.html
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.example.js
│   ├── firebase-config.vite.example.js
│   ├── auth.js
│   ├── student.js
│   ├── teacher.js
│   ├── validation.js
│   ├── darkmode.js
│   └── app.js
├── firestore.rules
├── storage.rules
├── .gitignore
├── .nojekyll
├── .env.example
└── docs/
    ├── FIREBASE_SETUP.md
    ├── GITHUB_PAGES_FIX.md
    ├── GITHUB_PUSH_STEPS.md
    └── SECURITY_RULES.md
```

The original Flask project is still in `student_digital_locker/`, but GitHub Pages uses the root static files above.

## Firebase Config

Do not commit your real Firebase config file.

Copy:

```bash
cp js/firebase-config.example.js js/firebase-config.js
```

Windows:

```bat
copy js\firebase-config.example.js js\firebase-config.js
```

Paste your Firebase Console values into `js/firebase-config.js`.

Firebase web config is not a private password, but real project config should still not be committed in an open-source student project.

## Firebase Setup

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

Required Firebase services:

- Firebase Authentication with Email/Password enabled
- Cloud Firestore
- Firebase Storage
- Firestore Rules from `firestore.rules`
- Storage Rules from `storage.rules`
- App Check for real deployments

## GitHub Pages Settings

1. Repository Settings
2. Pages
3. Source: Deploy from a branch
4. Branch: `main`
5. Folder: `/root`
6. Save

Wait 1 to 5 minutes for deployment. If 404 still appears, open the repository Actions tab and check the Pages build/deploy logs.

## Push Commands

```bash
git add .
git commit -m "Fix GitHub Pages static Firebase deployment"
git push -u origin main
```

## Never Commit

- `.env`
- `.env.local`
- `js/firebase-config.js`
- real Firebase config values
- uploaded certificate files
- uploaded profile photos
- `locker.db`
- `node_modules/`

## Common 404 Causes Fixed

- `index.html` missing at repository root
- files nested inside `student_digital_locker/`
- Flask/Jinja templates used on GitHub Pages
- absolute `/static/...` paths
- GitHub Pages source not set to `main / root`
- missing `.nojekyll`
