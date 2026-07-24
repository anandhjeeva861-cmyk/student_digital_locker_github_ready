# Firebase Setup

Use this guide to connect the Student Digital Locker frontend to Firebase without committing real project values to GitHub.

## 1. Create Firebase Project

1. Open the Firebase Console.
2. Click **Add project**.
3. Enter a project name, for example `student-digital-locker`.
4. Complete the project creation steps.

## 2. Add Web App

1. In Project Overview, click the Web icon.
2. Register the app.
3. Firebase will show a `firebaseConfig` object.
4. Copy the values from that object.

## 3. Enable Authentication

1. Go to **Authentication**.
2. Open **Sign-in method**.
3. Enable **Email/Password**.

## 4. Create Firestore Database

1. Go to **Firestore Database**.
2. Click **Create database**.
3. Start in production mode.
4. Choose a region.
5. Publish the rules from `firestore.rules`.

## 5. Enable Firebase Storage

1. Go to **Storage**.
2. Click **Get started**.
3. Start in production mode.
4. Publish the rules from `storage.rules`.

## 6. Create Local Firebase Config

This project keeps the real Firebase browser config out of GitHub.

Copy:

```bash
cp static/js/firebase-config.example.js static/js/firebase-config.js
```

Windows:

```bat
copy static\js\firebase-config.example.js static\js\firebase-config.js
```

Then paste your real Firebase Console values into:

```text
static/js/firebase-config.js
```

Do not push `static/js/firebase-config.js` to GitHub. It is ignored by `.gitignore`.

## 7. Browser JavaScript Import

For this normal HTML/browser project, JavaScript files should import Firebase like this:

```js
import { auth, db, storage } from "./firebase-config.js";
```

Normal browser JavaScript cannot directly read `.env` files. The real config must be placed in `static/js/firebase-config.js` for local browser use.

## 8. Flask/Static Setup Note

This project uses Flask templates and `static/`. Do not use `.env` or `import.meta.env` for browser Firebase config. Keep real Firebase values only in the ignored local file `static/js/firebase-config.js`.

## 9. Security Reminder

Firebase web config is not a private password, but real project config should still not be committed in open-source repositories because it identifies your Firebase project.

For real security, enable and maintain:

- Firebase Authentication
- Firestore Security Rules
- Firebase Storage Rules
- Firebase App Check
- Firebase Console usage quotas and monitoring
