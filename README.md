# Student Digital Locker

Student Digital Locker is a static HTML/CSS/JavaScript frontend powered by Firebase.

## Technology Stack

- Frontend: plain HTML, CSS, JavaScript modules
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- File uploads: Firebase Storage
- Frontend hosting: GitHub Pages

GitHub Pages hosts the complete active app. No Node backend is required for login, register, dashboards, uploads, downloads, deletes, teacher student list, search, submission status, or academic title management.

## Installation

```bash
npm install
npm run config:firebase
npm run build
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment Variables

See `.env.example`. Local real values belong in ignored `.env.local` and `.env.production`.

## GitHub Pages

The workflow `.github/workflows/pages.yml` deploys the root static frontend and generates `js/firebase-config.js` during the build.
It installs dependencies with `npm ci`, runs `npm run build`, prepares a clean `dist/` artifact, then deploys that artifact to GitHub Pages.

`js/firebase-config.js` is generated locally and during GitHub Actions, but it is ignored by Git so API keys are not committed. Use GitHub Actions Pages deployment; branch/root Pages mode will not have Firebase config unless the generated artifact is deployed.

Local `.env.local` may supply the browser config with either `FIREBASE_CONFIG_JSON` or the individual values:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

In GitHub, add the API key as an Actions repository variable named `FIREBASE_API_KEY`. Do not paste the API key into source files, docs, or workflow YAML.

## Firebase Setup

See `docs/FIREBASE_SETUP.md`.

## Academic Options

Department and year values are defined once in `js/options.js`. Registration forms use selects populated from that file, and Firestore rules enforce the same allowed values.

## Commands

```bash
npm run build
npm run pages:artifact
git add .
git commit -m "Integrate Firebase for Student Digital Locker"
git push
```
