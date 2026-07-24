# GitHub-Safe Firebase Setup

This project is a normal HTML/CSS/JavaScript static project, not Vite.

That means `.env` is useful only as a local reference file. Browser JavaScript cannot read `.env` directly. The working Firebase connection file for this project is:

```text
js/firebase-config.js
```

## Files That Are Safe To Commit

- `.env.example`
- `js/firebase-config.example.js`
- `js/firebase-config.vite.example.js`
- `README.md`
- `docs/FIREBASE_SETUP.md`
- `firestore.rules`
- `storage.rules`

## Files That Must Not Be Committed

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `js/firebase-config.js`
- real Firebase project config values
- uploaded files
- local database files
- `node_modules/`
- `dist/`
- `build/`

## Local Firebase Setup

Copy:

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

Do not paste real values into:

```text
js/firebase-config.example.js
.env.example
```

## Why Not `.env`?

Normal static browser JavaScript cannot directly read `.env`.

Vite can read `.env` through `import.meta.env`, but this project is not Vite. If you convert it later, use `js/firebase-config.vite.example.js`.

## Security Reminder

Firebase web config is visible in browser code. It is not a private password, but it identifies your project, so this repository keeps the real config ignored.

Real security must be enforced by:

- Firebase Authentication
- Firestore Security Rules
- Firebase Storage Rules
- Firebase App Check
