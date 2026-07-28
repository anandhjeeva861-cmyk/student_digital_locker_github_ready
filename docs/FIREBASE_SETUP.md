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

## GitHub Pages Config

GitHub Pages must use the GitHub Actions workflow in this repository. The workflow generates `js/firebase-config.js` during deployment and deploys it inside the clean `dist/` artifact. The generated config file is ignored by Git and must not be committed.

Local `.env.local` can override the public config with individual values:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

The GitHub Actions workflow requires the API key from an Actions repository variable named `FIREBASE_API_KEY`. Without that variable, config generation fails instead of deploying a broken or placeholder config.

## Firebase Console

1. Enable Authentication -> Sign-in method -> Email/Password.
2. Create Firestore Database.
3. Create Firebase Storage.
4. Publish `firebase/firestore.rules` in Firestore Rules.
5. Publish `firebase/storage.rules` in Storage Rules.
6. Import or create indexes from `firebase/firestore.indexes.json`.
7. Add authorized domain for GitHub Pages:

```text
anandhjeeva861-cmyk.github.io
```

Only add the host name, not the repository path. For a custom domain, add that host name too.

## Allowed Academic Values

Departments:

```text
BSC CS
BSC AI&ML
BSC IT
CSDA
BCOM
BCOM CA
BCOM PA
CS&HM
BCOM IT
MBA
BBA
```

Years:

```text
I
II
III
```

These values are shared from `js/options.js` in the frontend and enforced in `firebase/firestore.rules`.

## Firestore Collections

- `profiles`: student and teacher profile records keyed by Firebase Auth UID.
- `documents`: uploaded certificate metadata and Storage download URLs.
- `academicTitles`: teacher-added academic certificate requirements per department/year.
- `uniqueMobileNumbers`: mobile uniqueness guard.
- `uniqueRegisterNumbers`: student register number uniqueness guard.

## Uploaded File Metadata

Uploaded binary files stay in Firebase Storage. Firestore `documents/{documentId}` stores only metadata:

- `id`
- `ownerId`, `userId`, `uploadedUserId`
- `uploadedUserEmail`
- `ownerName`, `ownerRegNo`
- `department`, `departmentKey`, `year`
- `category`
- `title`
- `originalName`
- `fileName`
- `storagePath`
- `downloadURL`, `downloadUrl`
- `fileType`
- `mimeType`
- `size`
- `description`
- `accessLevel`
- `status`
- `uploadedAt`, `createdAt`, `updatedAt`

## Storage Paths

- `users/{uid}/profile/{file}` for student profile photos.
- `users/{uid}/documents/{documentId}/{file}` for online, personal, and academic certificates.

If a Storage upload succeeds but Firestore metadata saving fails, the frontend attempts to delete the uploaded Storage object before showing the error.
