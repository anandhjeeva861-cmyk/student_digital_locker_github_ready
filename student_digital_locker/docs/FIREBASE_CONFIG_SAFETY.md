# Firebase Config Safety

This project is a Flask/static project that uses `templates/` and `static/`. It is not Vite, so do not use `.env` or `import.meta.env` for browser Firebase config.

## Local-Only File

Use this file only on your computer:

```text
static/js/firebase-config.js
```

Paste your real Firebase Console config values only inside that file.

## GitHub-Safe Sample File

This file is safe to push:

```text
static/js/firebase-config.example.js
```

It contains placeholder values only. Other developers should copy it and rename the copy to `static/js/firebase-config.js`.

## Ignored Files

These files are ignored by Git:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `static/js/firebase-config.js`
- `firebase-config.js`

## Security Note

Firebase web API keys are not passwords, but real Firebase project config identifies your project. This repository avoids committing real config values to reduce accidental public exposure and GitHub push warnings.

Real security must come from:

- Firebase Authentication
- Firestore Security Rules
- Firebase Storage Rules
- Firebase App Check
