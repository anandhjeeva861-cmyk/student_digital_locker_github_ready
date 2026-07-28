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

The workflow `.github/workflows/pages.yml` deploys the root static frontend and generates `js/firebase-config.js` from GitHub Repository Secrets.

Add these secrets:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

## Firebase Setup

See `docs/FIREBASE_SETUP.md`.

## Commands

```bash
npm run build
git add .
git commit -m "Integrate Firebase for Student Digital Locker"
git push
```
