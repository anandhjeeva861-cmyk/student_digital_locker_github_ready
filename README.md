# Student + Teacher + Alumni Digital Locker

Student Digital Locker is a static HTML/CSS/JavaScript frontend powered by Firebase. Students retain the same Firebase account, UID, profile, and documents when an assigned teacher graduates their batch and changes their profile role to `alumni`.

## Technology Stack

- Frontend: plain HTML, CSS, JavaScript modules
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- File uploads: Cloud Firestore document chunk subcollections
- Frontend hosting: GitHub Pages

GitHub Pages hosts the complete active app. No Node backend is required for login, registration, dashboards, uploads, downloads, deletes, teacher batch/student/Alumni lists, career profiles, achievements, submission status, or academic title management.

## Alumni and Batch Lifecycle

- Teachers create department batches and explicitly assign students whose department and `YYYY-YYYY` academic range match.
- Active assigned batches appear under **Current Batches**. Graduated batches remain under **Previous Batches**.
- Graduation uses one atomic Firestore write for up to 200 students: each existing `profiles/{uid}` role changes from `student` to `alumni`, audit records are created, and the batch becomes `graduated`.
- Authentication accounts and document `ownerId` values are never changed or migrated.
- Alumni use `alumni-login.html` with the same email/password and can manage their career profile, achievements, contact links, and documents.
- Firestore rules authorize batch reads and conversions by `assignedTeacherUid`; they prevent self-graduation and protected Alumni-field edits.

Existing students without `batchId` are not guessed into a batch. An assigned teacher must use the Batch Management assignment form, which requires an exact department and academic-range match.

The browser implementation is capped at 200 students per atomic graduation. Larger cohorts, multi-teacher batches, institutional approval workflows, or server-controlled claims should use a trusted Cloud Function/Admin SDK endpoint rather than weakening client rules.

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

The Firebase browser API key is not stored in tracked files. Before deploying, create a GitHub Actions repository secret named `FIREBASE_API_KEY`; the workflow uses it to generate the ignored `js/firebase-config.js` build output. Local development can supply the same value through `.env.local`. Keep all real keys and service-account credentials out of commits.

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
