# Student Digital Locker

Student Digital Locker is a static HTML/CSS/JavaScript frontend powered by Firebase.

## Technology Stack

- Frontend: plain HTML, CSS, JavaScript modules
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- File uploads: Cloud Firestore document chunk subcollections
- Frontend hosting: GitHub Pages

GitHub Pages hosts the complete active app. No Node backend is required for login, register, dashboards, uploads, downloads, deletes, teacher student list, search, submission status, or academic title management.

Uploaded files are base64 encoded and split into Firestore chunk subcollections. This avoids Firebase Storage setup and keeps the static GitHub Pages app backend-free.

## Installation

```bash
npm install
npm.cmd run config:firebase
npm.cmd run build
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

On Windows PowerShell, use `npm.cmd` if plain `npm` is blocked by the execution policy.

## Environment Variables

See `.env.example`. Local real values belong in ignored `.env.local` and `.env.production`.

## GitHub Pages

The workflow `.github/workflows/pages.yml` generates `js/firebase-config.js`, verifies the static frontend, prepares a clean `dist/` artifact, and deploys only that artifact to GitHub Pages. It preserves every HTML page; it does not rewrite routes to `index.html`.

`js/firebase-config.js` exists only as ignored build output locally and in the GitHub Pages artifact. It must never be committed. Use GitHub Actions Pages deployment; branch/root Pages mode will not have Firebase config unless the generated artifact is deployed.

Local `.env.local` may supply the browser config with either `FIREBASE_CONFIG_JSON` or the individual values:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

In GitHub, add the API key as an Actions repository variable or secret named `FIREBASE_API_KEY`. Do not paste the API key into source files, docs, or workflow YAML.

## Firebase Setup

See `docs/FIREBASE_SETUP.md`.

## Academic Options

Department values are defined once in `js/options.js`. Registration forms require an Academic Year typed like `2025-2028`; client validation requires the end year to be 3 years after the start year, and Firestore rules enforce the `YYYY-YYYY` shape for new accounts.

Teacher registration also reserves one department + academic-year scope, so a second teacher cannot create another teacher account for the same class scope.

## Commands

```bash
npm run build
npm run deploy:firebase
npm run pages:artifact
git add .
git commit -m "Integrate Firebase for Student Digital Locker"
git push
```
