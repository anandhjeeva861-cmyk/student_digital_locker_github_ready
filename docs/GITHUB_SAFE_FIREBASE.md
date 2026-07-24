# GitHub-Safe Firebase Setup

This project is a normal HTML/CSS/JavaScript static project, not Vite. The repository also contains a Flask/static version inside `student_digital_locker/`.

That means `.env` is useful only as a local reference file. Browser JavaScript cannot read `.env` directly.

The GitHub Pages/static website uses:

```text
js/firebase-config.js
```

The Flask/static website uses:

```text
student_digital_locker/static/js/firebase-config.js
```

## Files That Are Safe To Commit

- `.env.example`
- `js/firebase-config.example.js`
- `js/firebase-config.js`
- `student_digital_locker/static/js/firebase-config.example.js`
- `README.md`
- `docs/FIREBASE_SETUP.md`
- `firestore.rules`
- `storage.rules`

## Files That Must Not Be Committed

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `student_digital_locker/static/js/firebase-config.js`
- uploaded files
- local database files
- `node_modules/`
- `dist/`
- `build/`

## Local Firebase Setup

For GitHub Pages/static mode:

```bash
cp js/firebase-config.example.js js/firebase-config.js
```

Windows:

```bat
copy js\firebase-config.example.js js\firebase-config.js
```

Paste real Firebase Console values only inside:

```text
js/firebase-config.js
```

Commit `js/firebase-config.js` so GitHub Pages can load Firebase.

For Flask/static mode:

```bat
copy student_digital_locker\static\js\firebase-config.example.js student_digital_locker\static\js\firebase-config.js
```

Paste real Firebase Console values only inside:

```text
student_digital_locker/static/js/firebase-config.js
```

Do not paste real values into:

```text
js/firebase-config.example.js
student_digital_locker/static/js/firebase-config.example.js
.env.example
```

## Why Not `.env`?

Normal static browser JavaScript cannot directly read `.env`, and this project is not Vite.

## Security Reminder

Firebase web config is visible in browser code. It is not a private password. For GitHub Pages, commit the root `js/firebase-config.js`; keep only the Flask local config ignored.

Real security must be enforced by:

- Firebase Authentication
- Firestore Security Rules
- Firebase Storage Rules
- Firebase App Check
