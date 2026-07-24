# Firebase Config Safety

This repository has two non-Vite modes:

- GitHub Pages/static mode at the repository root.
- Flask/static mode inside `student_digital_locker/`.

Browser JavaScript cannot read `.env` directly in either mode. Use the ignored Firebase config file for the mode you are running.

## Where To Paste Firebase Config

For the GitHub Pages/static website, paste real Firebase values in:

```text
js/firebase-config.js
```

For the Flask local website, paste real Firebase values in:

```text
student_digital_locker/static/js/firebase-config.js
```

## Files That Are Safe To Push

- `.env.example`
- `js/firebase-config.example.js`
- `student_digital_locker/static/js/firebase-config.example.js`
- `README.md`
- `docs/FIREBASE_SETUP.md`
- `firestore.rules`
- `storage.rules`

## Files That Must Never Be Pushed

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `js/firebase-config.js`
- `student_digital_locker/static/js/firebase-config.js`
- real Firebase project config values
- uploaded files
- local database files
- `node_modules/`
- `dist/`
- `build/`

## Local Setup

For GitHub Pages/static mode:

```bash
cp js/firebase-config.example.js js/firebase-config.js
```

Windows:

```bat
copy js\firebase-config.example.js js\firebase-config.js
```

For Flask/static mode:

```bat
copy student_digital_locker\static\js\firebase-config.example.js student_digital_locker\static\js\firebase-config.js
```

Paste real Firebase Console values only inside the copied local file for the mode you use.

Do not paste real values into:

```text
js/firebase-config.example.js
student_digital_locker/static/js/firebase-config.example.js
.env.example
```

## Security Reminder

Firebase web API keys are not passwords, but real Firebase project config identifies your project. This project avoids committing real config to prevent accidental public exposure and GitHub push warnings.

Real protection must come from:

- Firebase Authentication
- Firestore Security Rules
- Firebase Storage Rules
- Firebase App Check
