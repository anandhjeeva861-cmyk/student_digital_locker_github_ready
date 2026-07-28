# Firebase Setup

Student Digital Locker now uses Firebase directly from the static GitHub Pages frontend.

## Services

- Firebase Authentication: student and teacher email/password login.
- Firestore: profiles, academic titles, and document metadata.
- Firebase Storage: profile photos and uploaded certificates.
- Analytics: initialized only when the browser supports it.

## Local Setup

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

`.env.local` and `.env.production` are ignored by Git. Keep only Firebase Web SDK values there. Do not add Admin SDK service account files.

## GitHub Pages Secrets

Add these repository secrets before deploying:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

The GitHub Actions workflow generates `js/firebase-config.js` during deployment. That generated file is ignored locally.

## Firebase Console

1. Enable Authentication -> Sign-in method -> Email/Password.
2. Create Firestore Database.
3. Create Firebase Storage.
4. Publish `firebase/firestore.rules` in Firestore Rules.
5. Publish `firebase/storage.rules` in Storage Rules.
6. Add authorized domain for GitHub Pages:

```text
anandhjeeva861-cmyk.github.io
```

## Firestore Collections

- `profiles`: student and teacher profile records keyed by Firebase Auth UID.
- `documents`: uploaded certificate metadata and Storage download URLs.
- `academicTitles`: teacher-added academic certificate requirements per department/year.
- `uniqueMobileNumbers`: mobile uniqueness guard.
- `uniqueRegisterNumbers`: student register number uniqueness guard.

## Storage Paths

- `profiles/{uid}/{file}` for student profile photos.
- `documents/{uid}/{category}/{file}` for online, personal, and academic certificates.
