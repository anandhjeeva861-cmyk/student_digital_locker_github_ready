# Student Digital Locker

Static HTML/CSS/JavaScript version of the Student Digital Locker website for GitHub Pages, using Firebase Authentication, Cloud Firestore, and Firebase Storage.

This deployable root project is **not Vite**. It has no `package.json` or `vite.config.*`, so browser JavaScript cannot read `.env` directly. Firebase is loaded through an ignored local file:

```text
js/firebase-config.js
```

## Updated File Tree

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
│   ├── firebase-config.js      # local only, ignored
│   ├── auth.js
│   ├── student.js
│   ├── teacher.js
│   ├── validation.js
│   ├── darkmode.js
│   └── app.js
├── firestore.rules
├── storage.rules
├── .env.example
├── .env                    # local only, ignored
├── .gitignore
├── .nojekyll
├── README.md
└── docs/
    ├── FIREBASE_SETUP.md
    ├── GITHUB_PAGES_FIX.md
    ├── GITHUB_PUSH_STEPS.md
    └── SECURITY_RULES.md
```

The original Flask version remains in `student_digital_locker/`, but GitHub Pages serves the root static files.

## Firebase Config Setup

### Normal HTML/CSS/JS Setup

Copy the safe example:

```bash
cp js/firebase-config.example.js js/firebase-config.js
```

Windows:

```bat
copy js\firebase-config.example.js js\firebase-config.js
```

Paste your real Firebase Console values only into:

```text
js/firebase-config.js
```

Do not commit `js/firebase-config.js`.

The project imports Firebase with:

```js
import("./firebase-config.js")
```

The import path is relative, so it works on GitHub Pages under:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

### Vite Note

If you convert this project to Vite later:

1. Copy `.env.example` to `.env`.
2. Paste real Firebase values only inside `.env`.
3. Use `js/firebase-config.vite.example.js` as your Vite `firebase-config.js`.
4. Restart the Vite dev server after changing `.env`.

Even with Vite, Firebase web config is visible in the final browser bundle. Real security must come from Firebase Authentication, Firestore Rules, Storage Rules, and App Check.

## Correct `.env.example`

```env
VITE_FIREBASE_API_KEY=PASTE_YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=PASTE_YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=PASTE_YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=PASTE_YOUR_PROJECT.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=PASTE_YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=PASTE_YOUR_FIREBASE_APP_ID
```

## Local Run Commands

Because this is a normal static browser project, run it with any local static server.

Python:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

VS Code Live Server also works.

## GitHub Pages

Use these settings:

1. Repository **Settings**
2. **Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`
5. Folder: `/root`
6. Save

After pushing, wait 1 to 5 minutes and open:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

If 404 still appears, check the repository **Actions** tab and Pages deployment logs.

## Never Push

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `js/firebase-config.js`
- real Firebase config values
- uploaded certificate/profile photo files
- `*.db`, `*.sqlite`, `*.sqlite3`
- `node_modules/`
- `dist/`
- `build/`

## Security

Firebase web config is not a private password, but it identifies your Firebase project. Keep real values out of an open-source student repository.

For real security, configure:

- Firebase Authentication
- Firestore Security Rules from `firestore.rules`
- Storage Rules from `storage.rules`
- Firebase App Check
